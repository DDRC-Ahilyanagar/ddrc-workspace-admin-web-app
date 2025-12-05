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
      
      const answers = Array.isArray(rows)
        ? rows.map((r: any) => ({
            question_id: r.question_id,
            section_id: r.section_id,
            answer: r.answer,
            question: r.question,
            question_type: r.question_type,
            section_name: r.section_name,
          }))
        : [];

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

