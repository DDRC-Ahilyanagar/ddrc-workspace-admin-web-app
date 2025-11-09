import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/admin/surveys/{id}:
 *   get:
 *     summary: Get survey details with all answers
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Survey details retrieved successfully
 *       404:
 *         description: Survey not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Next.js 15+ (Promise) and older versions (object)
    const resolvedParams = params instanceof Promise ? await params : params;
    const surveyId = parseInt(resolvedParams.id || '0');
    if (!surveyId || surveyId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid survey ID' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      // Get survey basic info
      const [surveyRows]: any = await conn.query(
        `SELECT 
          sa.id,
          sa.aadhar_no,
          sa.user_id,
          sa.front_image,
          sa.back_image,
          sa.holder_name,
          sa.address_text,
          sa.pincode,
          sa.taluka,
          sa.district,
          sa.gender,
          sa.dob,
          sa.created_at,
          sa.updated_at,
          u.name AS user_name,
          u.contact_number AS user_phone
        FROM survey_aadhar sa
        LEFT JOIN users u ON u.id = sa.user_id
        WHERE sa.id = ? LIMIT 1`,
        [surveyId]
      );

      if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Survey not found' },
          { status: 404 }
        );
      }

      const survey = surveyRows[0];

      // Get all answers for this survey
      // Detect answer column name
      let answerCol = 'answer';
      try {
        const [cols]: any = await conn.query("SHOW COLUMNS FROM answers");
        const colNames = Array.isArray(cols) ? cols.map((c: any) => c.Field?.toLowerCase() || '') : [];
        if (colNames.includes('answer_text')) answerCol = 'answer_text';
        else if (colNames.includes('answer_value')) answerCol = 'answer_value';
        else if (colNames.includes('answer')) answerCol = 'answer';
      } catch {}

      const [answerRows]: any = await conn.query(
        `SELECT 
          a.id,
          a.question_id,
          a.section_id,
          a.${answerCol} AS answer,
          a.created_at,
          a.updated_at,
          q.question AS question_marathi,
          NULL AS question_english,
          q.question_type,
          q.options,
          COALESCE(s.name, CONCAT('Section ', a.section_id)) AS section_name
        FROM answers a
        LEFT JOIN questions q ON q.id = a.question_id
        LEFT JOIN sections s ON s.id = COALESCE(a.section_id, q.section_id)
        WHERE (a.aadhar_id = ? OR a.aadhaar_id = ?)
        ORDER BY COALESCE(a.section_id, q.section_id, 0) ASC, a.question_id ASC`,
        [surveyId, surveyId]
      );

      const answers = Array.isArray(answerRows) ? answerRows : [];

      // Get answer count
      const answerCount = answers.length;

      // Determine status
      const status = answerCount > 0 ? 'Completed' : 'Pending';

      // Group answers by section name (string) for Flutter compatibility
      const answersBySection: Record<string, any[]> = {};
      answers.forEach((ans: any) => {
        const sectionName = ans.section_name || `Section ${ans.section_id || 'Unknown'}`;
        if (!answersBySection[sectionName]) {
          answersBySection[sectionName] = [];
        }
        answersBySection[sectionName].push(ans);
      });

      Logger.info('survey_details_fetched', {
        survey_id: surveyId,
        answer_count: answerCount,
      });

      return NextResponse.json({
        ok: true,
        data: {
          survey: {
            id: survey.id,
            aadhar_no: survey.aadhar_no,
            user_id: survey.user_id,
            user_name: survey.user_name,
            user_phone: survey.user_phone,
            front_image: survey.front_image,
            back_image: survey.back_image,
            holder_name: survey.holder_name,
            address_text: survey.address_text,
            pincode: survey.pincode,
            taluka: survey.taluka,
            district: survey.district,
            gender: survey.gender,
            dob: survey.dob,
            status,
            answer_count: answerCount,
            created_at: survey.created_at,
            updated_at: survey.updated_at,
          },
          answers,
          answersBySection,
        },
      });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    Logger.error('survey_details_get_error', { error: e.message });
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}

