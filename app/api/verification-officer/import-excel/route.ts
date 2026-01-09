import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import ExcelJS from 'exceljs';
import { requireAuth } from '@/lib/auth';

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

          // Assign survey to field officer based on village/GAV
          // Only assign if survey is not already assigned to a field officer (user_id = 1 means system/unassigned)
          let assignedOfficerId: number | null = null;
          
          // Extract village from answers (look for village question)
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

          // If village found and survey is not already assigned, find matching field officer
          if (village && village.length > 0 && (!currentUserId || currentUserId === 1)) {
            const villageLower = village.toLowerCase().trim();
            
            // Find field officers whose primary_gaav or additional_gaavs matches
            // Get all field officers and check their villages
            const [allOfficers]: any = await conn.query(`
              SELECT u.id, u.name, fop.primary_gaav, fop.additional_gaavs
              FROM users u
              INNER JOIN field_officer_profiles fop ON fop.user_id = u.id
              WHERE u.user_type = 'field_officer'
              AND u.status = 'active'
              AND u.is_active = 1
              ORDER BY u.id ASC
            `);

            let matchingOfficer: any = null;
            
            if (Array.isArray(allOfficers)) {
              for (const officer of allOfficers) {
                const primaryGaav = (officer.primary_gaav || '').toLowerCase().trim();
                
                // Check primary_gaav
                if (primaryGaav === villageLower || 
                    primaryGaav.includes(villageLower) ||
                    villageLower.includes(primaryGaav)) {
                  matchingOfficer = officer;
                  break;
                }
                
                // Check additional_gaavs (JSON array)
                if (officer.additional_gaavs) {
                  try {
                    const additionalGaavs = typeof officer.additional_gaavs === 'string'
                      ? JSON.parse(officer.additional_gaavs)
                      : officer.additional_gaavs;
                    
                    if (Array.isArray(additionalGaavs)) {
                      for (const gaav of additionalGaavs) {
                        const gaavLower = String(gaav || '').toLowerCase().trim();
                        if (gaavLower === villageLower ||
                            gaavLower.includes(villageLower) ||
                            villageLower.includes(gaavLower)) {
                          matchingOfficer = officer;
                          break;
                        }
                      }
                    }
                  } catch (e) {
                    // Skip invalid JSON
                  }
                }
                
                if (matchingOfficer) break;
              }
            }

            if (matchingOfficer) {
              assignedOfficerId = Number(matchingOfficer.id);
              
              // Update survey with assigned field officer
              await conn.query(
                `UPDATE surveys 
                 SET user_id = ?,
                     source = COALESCE(source, 'Excel Import'),
                     updated_at = NOW()
                 WHERE id = ?`,
                [assignedOfficerId, surveyId]
              );

              Logger.info('EXCEL_IMPORT_SURVEY_ASSIGNED', {
                surveyId,
                officerId: assignedOfficerId,
                officerName: matchingOfficer.name,
                village: village,
              });
            } else {
              // No matching officer found - keep survey unassigned (user_id = 1 for system)
              Logger.info('EXCEL_IMPORT_NO_MATCHING_OFFICER', {
                surveyId,
                village: village,
              });
            }
          }

          await conn.commit();

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

