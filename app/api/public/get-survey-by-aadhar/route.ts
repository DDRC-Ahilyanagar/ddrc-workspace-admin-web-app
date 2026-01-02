import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Get existing survey data by Aadhar number for prefilling form
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const aadharNo = (body.aadhar_no || '').toString().replace(/\D/g, ''); // Remove non-digits

    if (aadharNo.length !== 12) {
      return NextResponse.json(
        { ok: false, error: 'Invalid Aadhar number' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();
    
    try {
      // Check if survey_aadhar record exists
      const [aadharRows]: any = await conn.query(
        `SELECT id, aadhar_no, holder_name, front_image, back_image, created_at
         FROM survey_aadhar
         WHERE aadhar_no = ?
         LIMIT 1`,
        [aadharNo]
      );

      if (!Array.isArray(aadharRows) || aadharRows.length === 0) {
        return NextResponse.json({
          ok: true,
          exists: false,
          data: null,
        });
      }

      const aadharRecord = aadharRows[0];
      const aadharId = aadharRecord.id;

      // Check if survey data exists
      const [surveyRows]: any = await conn.query(
        `SELECT 
          id,
          survey_json,
          no_of_questions_answered,
          no_of_questions_unanswered,
          source,
          created_at,
          updated_at
         FROM surveys
         WHERE aadhaar_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
        [aadharId]
      );

      let surveyData = null;
      let answers: Record<number, any> = {};

      if (Array.isArray(surveyRows) && surveyRows.length > 0) {
        const survey = surveyRows[0];
        surveyData = {
          id: survey.id,
          answer_count: survey.no_of_questions_answered || 0,
          unanswered_count: survey.no_of_questions_unanswered || 0,
          source: survey.source,
          created_at: survey.created_at,
          updated_at: survey.updated_at,
        };

        // Parse survey_json to get answers
        try {
          const surveyJson = typeof survey.survey_json === 'string' 
            ? JSON.parse(survey.survey_json) 
            : survey.survey_json;
          
          if (surveyJson && Array.isArray(surveyJson.answers)) {
            surveyJson.answers.forEach((ans: any) => {
              const questionId = parseInt(ans.question_id || ans.questionId || '0', 10);
              if (questionId > 0) {
                answers[questionId] = ans.answer || ans.value || '';
              }
            });
          }
        } catch (parseError) {
          Logger.error('parse_survey_json_error', { 
            error: parseError,
            aadhar_id: aadharId 
          });
        }
      }

      return NextResponse.json({
        ok: true,
        exists: true,
        data: {
          aadhar_id: aadharId,
          aadhar_no: aadharRecord.aadhar_no,
          holder_name: aadharRecord.holder_name,
          front_image: aadharRecord.front_image,
          back_image: aadharRecord.back_image,
          survey: surveyData,
          answers: answers,
        },
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('get_survey_by_aadhar_error', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch survey data' },
      { status: 500 }
    );
  }
}

