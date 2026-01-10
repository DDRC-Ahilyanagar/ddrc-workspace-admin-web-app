import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import ExcelJS from 'exceljs';
import { requireAuth } from '@/lib/auth';
import { autoAssignSurveys } from '@/lib/auto-assign-surveys';

export const dynamic = 'force-dynamic';

/**
 * Import Excel file with columns matching public form structure
 * Maps Excel columns to question IDs and stores answers in survey_json
 */
export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    // Check if user is verification officer
    const userType = (user?.user_type || '').toLowerCase().trim();
    if (userType !== 'verification_officer' && userType !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Only verification officers can import data' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json(
        { ok: false, error: 'Excel file is empty' },
        { status: 400 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Get header row to map columns
      const headerRow = worksheet.getRow(1);
      const columnMap: Map<number, { key: string; questionId?: number }> = new Map();
      
      headerRow.eachCell((cell, colNumber) => {
        const header = cell.value?.toString() || '';
        if (!header) return;

        // Extract question ID from header if present (format: "Question Text (Q123)")
        const questionIdMatch = header.match(/\(Q(\d+)\)/);
        const questionId = questionIdMatch ? parseInt(questionIdMatch[1]) : undefined;

        // Create key from header
        const key = questionId ? `q_${questionId}` : header.toLowerCase().replace(/[^a-z0-9]/g, '_');

        columnMap.set(colNumber, { key, questionId });
      });

      // Fetch question mappings from database
      const [questionRows]: any = await conn.query(`
      SELECT q.id, q.question, q.section_id, s.name AS section_name
      FROM questions q
      LEFT JOIN sections s ON s.id = q.section_id
      WHERE (
        (s.name = 'वैयक्तिक माहिती' OR q.section_id = 1)
        OR
        (s.name = 'पत्ता' AND q.question LIKE 'सध्याचा%')
        OR
        (s.name = 'दिव्यांगता तपशील' AND (
          q.question LIKE '%दिव्यांगता प्रकार%' OR
          q.question LIKE '%दिव्यांगता टक्केवारी%' OR
          q.question LIKE '%वैश्विक कार्ड (UDID)%' OR
          q.question = 'वैश्विक कार्ड (UDID)'
        ))
      )
      AND (q.status = 'Active' OR q.status IS NULL)
    `);

    const questionMap = new Map<number, { question: string; section_id: number }>();
    if (Array.isArray(questionRows)) {
      questionRows.forEach((q: any) => {
        questionMap.set(q.id, { question: q.question, section_id: q.section_id });
      });
    }

    // Parse rows (skip header row)
    const rows: Array<{ aadhaar: string; name: string; answers: Map<number, string> }> = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const rowData: { aadhaar?: string; name?: string; answers: Map<number, string> } = {
        answers: new Map(),
      };

      row.eachCell((cell, colNumber) => {
        const columnInfo = columnMap.get(colNumber);
        if (!columnInfo) return;

        const value = cell.value?.toString() || '';
        if (!value.trim()) return;

        const { key, questionId } = columnInfo;

        // Map special columns
        if (key.includes('aadhaar') || key.includes('aadhar') || key.includes('आधार')) {
          rowData.aadhaar = value.replace(/\D/g, ''); // Extract only digits
        } else if (key.includes('name') || key.includes('नाव')) {
          rowData.name = value.trim();
        } else if (questionId && questionMap.has(questionId)) {
          // Map to question ID
          rowData.answers.set(questionId, value.trim());
        }
      });

      // Only add row if it has at least name and aadhaar
      if (rowData.name && rowData.aadhaar && rowData.aadhaar.length >= 12) {
        rows.push({
          aadhaar: rowData.aadhaar,
          name: rowData.name,
          answers: rowData.answers,
        });
      }
    });

      if (rows.length === 0) {
        conn.release();
        return NextResponse.json(
          { ok: false, error: 'No valid data found in Excel file' },
          { status: 400 }
        );
      }
      const processedRows: any[] = [];
      const errors: string[] = [];

      // Process each row
      for (const row of rows) {
        try {
          await conn.beginTransaction();

          // Create or update survey_aadhar record
          // Note: survey_aadhar table uses aadhar_no column, and also needs user_id
          const [aadharResult]: any = await conn.query(
            `INSERT INTO survey_aadhar (aadhar_no, user_id, holder_name, created_at, updated_at)
             VALUES (?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE 
               holder_name = VALUES(holder_name),
               updated_at = NOW()`,
            [row.aadhaar, user.id, row.name]
          );

          let aadharId = aadharResult.insertId;
          
          // If insertId is not available, query for existing record
          if (!aadharId) {
            const [existingRows]: any = await conn.query(
              `SELECT id FROM survey_aadhar WHERE aadhar_no = ? LIMIT 1`,
              [row.aadhaar]
            );
            if (Array.isArray(existingRows) && existingRows.length > 0) {
              aadharId = existingRows[0]?.id;
            }
          }

          if (!aadharId) {
            await conn.rollback();
            errors.push(`Failed to create/update Aadhaar record for ${row.name}`);
            continue;
          }

          // Build answers array from Excel data
          const answersArray = Array.from(row.answers.entries()).map(([questionId, answerValue]) => ({
            question_id: questionId,
            answer: answerValue,
          }));

          const answeredQuestions = answersArray.length;
          const surveyJson = JSON.stringify({ answers: answersArray });

          // Create or update survey record
          let surveyId: number | null = null;
          const [existingSurvey]: any = await conn.query(
            `SELECT id, survey_json FROM surveys WHERE aadhaar_id = ? LIMIT 1`,
            [aadharId]
          );

          if (Array.isArray(existingSurvey) && existingSurvey.length > 0) {
            surveyId = existingSurvey[0]?.id;
            
            // Merge with existing answers if any
            let existingJson: any = {};
            try {
              if (existingSurvey[0]?.survey_json) {
                existingJson = typeof existingSurvey[0].survey_json === 'string'
                  ? JSON.parse(existingSurvey[0].survey_json)
                  : existingSurvey[0].survey_json;
              }
            } catch (e) {
              // If JSON parse fails, use empty object
            }

            // Merge answers (Excel data takes precedence)
            const existingAnswers = existingJson.answers || [];
            const mergedAnswers = [...existingAnswers];
            
            // Update or add answers from Excel
            for (const newAnswer of answersArray) {
              const existingIndex = mergedAnswers.findIndex(
                (a: any) => (a.question_id || a.questionId) === newAnswer.question_id
              );
              if (existingIndex >= 0) {
                mergedAnswers[existingIndex] = newAnswer;
              } else {
                mergedAnswers.push(newAnswer);
              }
            }

            const mergedJson = JSON.stringify({ answers: mergedAnswers });
            const totalAnswered = mergedAnswers.length;

            // Update survey
            await conn.query(
              `UPDATE surveys 
               SET survey_json = ?, 
                   no_of_questions_answered = ?,
                   updated_at = NOW()
               WHERE id = ?`,
              [mergedJson, totalAnswered, surveyId]
            );
          } else {
            // Create new survey with system user_id (1) initially
            // Will be assigned to field officer based on village below
            const [surveyResult]: any = await conn.query(
              `INSERT INTO surveys (user_id, aadhaar_id, no_of_questions_answered, no_of_questions_unanswered, survey_json, source, created_at, updated_at)
               VALUES (1, ?, ?, 0, ?, 'Excel Import', NOW(), NOW())`,
              [aadharId, answeredQuestions, surveyJson]
            );
            surveyId = surveyResult.insertId;
          }

          if (!surveyId) {
            await conn.rollback();
            errors.push(`Failed to create/update survey for ${row.name}`);
            continue;
          }

          // Check if survey is already assigned to a field officer
          const [surveyCheck]: any = await conn.query(
            `SELECT user_id FROM surveys WHERE id = ? LIMIT 1`,
            [surveyId]
          );
          const currentUserId = Array.isArray(surveyCheck) && surveyCheck.length > 0 
            ? Number(surveyCheck[0].user_id) 
            : null;

          // Extract village from answers (look for village question) for logging
          let village: string | null = null;
          for (const [questionId, answerValue] of row.answers.entries()) {
            const questionInfo = questionMap.get(questionId);
            if (questionInfo) {
              const questionText = questionInfo.question.toLowerCase();
              // Check if this is a village question (गाव, village, ग्राम)
              if (questionText.includes('गाव') || 
                  questionText.includes('village') || 
                  questionText.includes('ग्राम') ||
                  questionText.includes('ग्रामपंचायत')) {
                village = answerValue.trim();
                break;
              }
            }
          }

          // Note: Auto-assignment will be called after transaction commit
          // This ensures data consistency and uses the shared auto-assignment logic
          let assignedOfficerId: number | null = null;
          
          // If survey is already assigned, use existing assignment
          if (currentUserId && currentUserId !== 1) {
            assignedOfficerId = currentUserId;
            Logger.info('EXCEL_IMPORT_SURVEY_ALREADY_ASSIGNED', {
              surveyId,
              existingOfficerId: currentUserId,
            });
          }

          await conn.commit();

          // Call auto-assignment after transaction is committed
          // This ensures data consistency and uses the shared auto-assignment logic
          if (surveyId && (!currentUserId || currentUserId === 1)) {
            // Call auto-assign asynchronously (fire and forget) so it doesn't delay the import
            autoAssignSurveys(surveyId).then((assignResult) => {
              if (assignResult.ok && assignResult.assigned > 0 && assignResult.details.length > 0) {
                assignedOfficerId = assignResult.details[0].officer_id;
                Logger.info('EXCEL_IMPORT_SURVEY_AUTO_ASSIGNED', {
                  surveyId,
                  officerId: assignedOfficerId,
                  village: village,
                  assignmentDetails: assignResult.details[0],
                });
              } else {
                Logger.info('EXCEL_IMPORT_NO_MATCHING_OFFICER', {
                  surveyId,
                  village: village,
                  assignResult: assignResult.message,
                });
              }
            }).catch((assignError: any) => {
              // Log error but don't fail the import
              Logger.error('EXCEL_IMPORT_AUTO_ASSIGN_ERROR', {
                surveyId,
                error: assignError.message,
                village: village,
              });
            });
          }

          processedRows.push({
            aadharId,
            surveyId,
            name: row.name,
            aadhaar: row.aadhaar,
            questionsAnswered: answeredQuestions,
            village: village || null,
            assignedToOfficer: assignedOfficerId || null,
          });

          Logger.info('EXCEL_IMPORT_ROW_PROCESSED', {
            aadharId,
            surveyId,
            name: row.name,
            questionsAnswered: answeredQuestions,
          });
        } catch (rowError: any) {
          await conn.rollback();
          errors.push(`Error processing ${row.name}: ${rowError.message}`);
          Logger.error('EXCEL_IMPORT_ROW_ERROR', {
            error: rowError.message,
            row: row.name,
          });
        }
      }

      return NextResponse.json({
        ok: true,
        message: `Successfully imported ${processedRows.length} records`,
        processed: processedRows.length,
        errors: errors.length,
        errorDetails: errors.length > 0 ? errors : undefined,
        data: processedRows,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('EXCEL_IMPORT_ERROR', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to import Excel file' },
      { status: 500 }
    );
  }
});

