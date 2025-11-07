import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

/**
 * @swagger
 * /api/get-questions:
 *   get:
 *     summary: Get all questions
 *     tags: [Questions]
 *     responses:
 *       200:
 *         description: Questions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
export async function GET(request: NextRequest) {
  try {
    const rows = await dbQuery('SELECT * FROM questions ORDER BY id ASC');

    // If question 69 (Disability Type) has no options, populate from disability_types
    // This keeps Flutter clients in sync without code changes.
    try {
      const pool = getDbPool();
      const conn = await pool.getConnection();
      try {
        await conn.query(`CREATE TABLE IF NOT EXISTS disability_types (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          label_marathi VARCHAR(255) NOT NULL,
          label_english VARCHAR(255) NOT NULL,
          aliases JSON NULL,
          UNIQUE KEY uniq_labels (label_marathi, label_english)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        const [types]: any = await conn.query(
          'SELECT label_marathi FROM disability_types ORDER BY id ASC'
        );
        const options = Array.isArray(types)
          ? (types as any[])
              .map((t: any) => String(t.label_marathi || '').trim())
              .filter((s: string) => s.length > 0)
              .join(',')
          : '';

        if (options) {
          for (const r of rows as any[]) {
            if (parseInt(r.id || '0') === 69) {
              r.options = options; // inject Marathi options list
            }
          }
        }
      } finally {
        // always release
        // @ts-ignore
        conn?.release?.();
      }
    } catch (e) {
      Logger.info('get_questions_disability_options_skip', { error: (e as any)?.message });
    }

    const sectionSummary: Record<number, number> = {};
    rows.forEach((r: any) => {
      const sid = parseInt(r.section_id || '0');
      sectionSummary[sid] = (sectionSummary[sid] || 0) + 1;
    });

    Logger.info('get_questions_ok', {
      count: rows.length,
      sections: sectionSummary,
    });

    return NextResponse.json(
      { ok: true, data: rows },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    Logger.error('get_questions_fail', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

