import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/get-answers:
 *   get:
 *     summary: Get saved answers for a specific Aadhaar ID and optional section ID
 *     tags: [Answers]
 *     parameters:
 *       - name: aadhar_id
 *         in: query
 *         required: true
 *         schema:
 *           type: integer
 *       - name: section_id
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Answers retrieved successfully
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const aadharId = parseInt(searchParams.get('aadhar_id') || '0');

    if (aadharId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid aadhar_id' },
        { status: 422 }
      );
    }

    const sectionId = searchParams.get('section_id');
    const sectionIdNum = sectionId ? parseInt(sectionId) : null;

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // 1. Fetch answers from the dedicated 'answers' table
      let query = `
        SELECT 
          a.id,
          a.question_id,
          a.section_id,
          a.answer,
          q.question,
          q.question_type,
          s.name as section_name
        FROM answers a
        LEFT JOIN questions q ON a.question_id = q.id
        LEFT JOIN sections s ON a.section_id = s.id
        WHERE a.aadhar_id = ?
      `;
      const params: any[] = [aadharId];

      if (sectionIdNum !== null && sectionIdNum > 0) {
        query += ' AND a.section_id = ?';
        params.push(sectionIdNum);
      }

      query += ' ORDER BY a.question_id ASC';

      const [rows]: any = await conn.query(query, params);

      let answers = Array.isArray(rows)
        ? rows.map((r: any) => ({
          question_id: r.question_id,
          section_id: r.section_id,
          answer: r.answer,
          question: r.question,
          question_type: r.question_type,
          section_name: r.section_name,
        }))
        : [];

      // 2. Fallback/Merge: Fetch answers from 'surveys' table survey_json (important for public submissions)
      // If we don't have many answers in the dedicated table, check the monolithic survey_json
      try {
        const [surveyRows]: any = await conn.query(
          'SELECT survey_json FROM surveys WHERE aadhaar_id = ? LIMIT 1',
          [aadharId]
        );

        if (Array.isArray(surveyRows) && surveyRows.length > 0 && surveyRows[0].survey_json) {
          const surveyData = JSON.parse(surveyRows[0].survey_json);
          const jsonAnswers = surveyData.answers || [];

          if (Array.isArray(jsonAnswers)) {
            // Find existing question IDs to avoid duplicates (prefer 'answers' table)
            const existingQids = new Set(answers.map(a => Number(a.question_id)));

            // Get question details for the ones in JSON
            const jsonQids = jsonAnswers
              .map(a => Number(a.question_id || a.questionId))
              .filter(id => id > 0 && !existingQids.has(id));

            if (jsonQids.length > 0) {
              const [qDetails]: any = await conn.query(
                `SELECT id, question, question_type, section_id FROM questions WHERE id IN (${jsonQids.join(',')})`
              );

              const qMap = new Map();
              if (Array.isArray(qDetails)) {
                qDetails.forEach(q => qMap.set(Number(q.id), q));
              }

              jsonAnswers.forEach((ja: any) => {
                const qid = Number(ja.question_id || ja.questionId);
                if (qid > 0 && !existingQids.has(qid) && qMap.has(qid)) {
                  const qInfo = qMap.get(qid);
                  // Filter by section if requested
                  if (sectionIdNum === null || Number(qInfo.section_id) === sectionIdNum) {
                    answers.push({
                      question_id: qid,
                      section_id: qInfo.section_id,
                      answer: ja.answer || ja.value || '',
                      question: qInfo.question,
                      question_type: qInfo.question_type,
                      section_name: '', // We could fetch this if needed
                    });
                  }
                }
              });
            }
          }
        }
      } catch (jsonErr) {
        Logger.error('get_answers_json_parse_fail', { error: (jsonErr as Error).message });
      }

      Logger.info('get_answers_ok', {
        aadhar_id: aadharId,
        section_id: sectionIdNum,
        count: answers.length,
      });

      return NextResponse.json({
        ok: true,
        data: answers,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('get_answers_fail', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch answers' },
      { status: 500 }
    );
  }
}

