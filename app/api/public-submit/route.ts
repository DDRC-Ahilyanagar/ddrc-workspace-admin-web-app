import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

/**
 * Public form submission endpoint - no authentication required
 * Allows anyone to submit survey answers after uploading Aadhaar card
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const aadharId = parseInt(String(body.aadhar_id || 0));
    const items = body.items || [];

    if (!aadharId || aadharId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Valid aadhar_id is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'At least one answer item is required' },
        { status: 400 }
      );
    }

    Logger.info('PUBLIC_SUBMIT_START', {
      aadhar_id: aadharId,
      item_count: items.length,
    });

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Verify Aadhaar record exists
      const [aadharRows]: any = await conn.query(
        'SELECT id FROM survey_aadhar WHERE id = ? LIMIT 1',
        [aadharId]
      );

      if (!Array.isArray(aadharRows) || aadharRows.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Aadhaar record not found. Please upload Aadhaar card first.' },
          { status: 404 }
        );
      }

      // Get or create survey record
      let [surveyRows]: any = await conn.query(
        'SELECT id FROM surveys WHERE aadhar_id = ? LIMIT 1',
        [aadharId]
      );

      let surveyId: number;
      if (Array.isArray(surveyRows) && surveyRows.length > 0) {
        surveyId = surveyRows[0].id;
      } else {
        // Create new survey record
        const [insertResult]: any = await conn.query(
          `INSERT INTO surveys (aadhar_id, user_id, created_at, updated_at)
           VALUES (?, 1, NOW(), NOW())`,
          [aadharId]
        );
        surveyId = insertResult.insertId;
      }

      // Insert or update answers
      let answeredCount = 0;
      let requiredCount = 0;

      for (const item of items) {
        const questionId = parseInt(String(item.question_id || 0));
        const sectionId = parseInt(String(item.section_id || 0));
        const answer = String(item.answer || '').trim();

        if (!questionId || questionId <= 0) continue;

        // Check if question is required
        const [qRows]: any = await conn.query(
          'SELECT is_required FROM questions WHERE id = ? LIMIT 1',
          [questionId]
        );
        const isRequired = qRows?.[0]?.is_required === 1;

        if (isRequired) {
          requiredCount++;
          if (answer) answeredCount++;
        }

        // Insert or update answer
        await conn.query(
          `INSERT INTO answers (survey_id, question_id, section_id, answer, aadhar_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             answer = VALUES(answer),
             updated_at = NOW()`,
          [surveyId, questionId, sectionId, answer, aadharId]
        );
      }

      // Update survey statistics
      const totalQuestions = items.length;
      const answeredQuestions = items.filter(item => item.answer && String(item.answer).trim()).length;
      const unansweredQuestions = totalQuestions - answeredQuestions;

      await conn.query(
        `UPDATE surveys 
         SET no_of_questions_answered = ?,
             no_of_questions_unanswered = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [answeredQuestions, unansweredQuestions, surveyId]
      );

      Logger.info('PUBLIC_SUBMIT_SUCCESS', {
        survey_id: surveyId,
        aadhar_id: aadharId,
        total_answers: items.length,
        answered: answeredQuestions,
        required_answered: answeredCount,
        required_total: requiredCount,
      });

      return NextResponse.json({
        ok: true,
        survey_id: surveyId,
        message: 'Survey submitted successfully',
        answered: answeredQuestions,
        total: totalQuestions,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('PUBLIC_SUBMIT_FAILED', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to submit survey' },
      { status: 500 }
    );
  }
}

