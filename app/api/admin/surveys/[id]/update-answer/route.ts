import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/surveys/[id]/update-answer
 * Verification officer updates a single answer in a survey
 */
export const PUT = requireAuth(async (request: NextRequest, user) => {
  // Only verification officer can update answers
  const userType = user.user_type?.toLowerCase() || '';
  if (userType !== 'verification_officer') {
    return NextResponse.json(
      { ok: false, error: 'Only verification officer can update survey answers' },
      { status: 403 }
    );
  }

  const surveyId = request.nextUrl.pathname.split('/').filter(Boolean).slice(-2)[0];
  if (!surveyId) {
    return NextResponse.json({ ok: false, error: 'Survey ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { question_id, answer } = body;

    if (!question_id) {
      return NextResponse.json({ ok: false, error: 'Question ID required' }, { status: 400 });
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Check if survey exists and is assigned to this verification officer
      const [surveyRows]: any = await conn.query(
        `SELECT id, aadhaar_id, assigned_to, survey_json FROM surveys WHERE id = ? LIMIT 1`,
        [surveyId]
      );

      if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
        return NextResponse.json({ ok: false, error: 'Survey not found' }, { status: 404 });
      }

      const survey = surveyRows[0];
      if (survey.assigned_to !== user.id) {
        return NextResponse.json(
          { ok: false, error: 'Survey is not assigned to you' },
          { status: 403 }
        );
      }

      // Parse existing survey_json
      let surveyJson: any = {};
      if (survey.survey_json) {
        try {
          surveyJson = typeof survey.survey_json === 'string'
            ? JSON.parse(survey.survey_json)
            : survey.survey_json;
        } catch (parseError: any) {
          Logger.error('SURVEY_JSON_PARSE_ERROR', { error: parseError.message, survey_id: surveyId });
          return NextResponse.json(
            { ok: false, error: 'Failed to parse survey data' },
            { status: 500 }
          );
        }
      }

      // Ensure answers array exists
      if (!surveyJson.answers || !Array.isArray(surveyJson.answers)) {
        surveyJson.answers = [];
      }

      // Find and update the answer
      const answerIndex = surveyJson.answers.findIndex((a: any) => a.question_id === question_id);
      const answerValue = answer !== null && answer !== undefined ? String(answer).trim() : '';

      if (answerIndex >= 0) {
        // Update existing answer
        surveyJson.answers[answerIndex].answer = answerValue;
        surveyJson.answers[answerIndex].updated_at = new Date().toISOString();
      } else {
        // Add new answer (find section_id from question)
        const [qRows]: any = await conn.query(
          'SELECT section_id FROM questions WHERE id = ? LIMIT 1',
          [question_id]
        );
        const sectionId = qRows?.[0]?.section_id || 0;

        surveyJson.answers.push({
          question_id: parseInt(question_id),
          section_id: sectionId,
          answer: answerValue,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Update survey_json
      surveyJson.updated_at = new Date().toISOString();

      // Recalculate totals
      const allAnswers = surveyJson.answers || [];
      const totalAnswered = allAnswers.filter((a: any) => {
        const ans = String(a.answer || '').trim();
        return ans !== '' && ans !== '--';
      }).length;
      const totalUnanswered = allAnswers.filter((a: any) => {
        const ans = String(a.answer || '').trim();
        return ans === '' || ans === '--';
      }).length;

      // Update survey record
      await conn.query(
        `UPDATE surveys 
         SET survey_json = ?,
             no_of_questions_answered = ?,
             no_of_questions_unanswered = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(surveyJson), totalAnswered, totalUnanswered, surveyId]
      );

      // Mark clarification as resolved if it exists for this question
      try {
        await conn.query(
          `UPDATE question_clarifications 
           SET status = 'resolved', 
               resolved_at = NOW(),
               updated_at = NOW()
           WHERE survey_id = ? AND question_id = ? AND status = 'pending'`,
          [surveyId, question_id]
        );
      } catch (clarError: any) {
        // Non-blocking error - log but don't fail the request
        Logger.error('CLARIFICATION_RESOLVE_ERROR', {
          error: clarError.message,
          survey_id: surveyId,
          question_id: question_id
        });
      }

      Logger.info('SURVEY_ANSWER_UPDATED', {
        survey_id: surveyId,
        question_id: question_id,
        verification_officer_id: user.id,
      });

      return NextResponse.json({
        ok: true,
        message: 'Answer updated successfully',
        answer: answerValue,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('SURVEY_ANSWER_UPDATE_ERROR', { error: error?.message || String(error) });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to update answer' },
      { status: 500 }
    );
  }
});


