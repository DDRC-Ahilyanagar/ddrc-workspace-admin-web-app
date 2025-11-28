import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

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

    // Inject dynamic options from database tables
    try {
      const pool = getDbPool();
      const conn = await pool.getConnection();
      try {
        // Inject disability types for question 69
        await conn.query(`CREATE TABLE IF NOT EXISTS disability_types (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          label_marathi VARCHAR(255) NOT NULL,
          label_english VARCHAR(255) NOT NULL,
          aliases JSON NULL,
          UNIQUE KEY uniq_labels (label_marathi, label_english)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        const [types]: any = await conn.query(
          'SELECT label_english FROM disability_types ORDER BY id ASC'
        );
        const options = Array.isArray(types)
          ? (types as any[])
              .map((t: any) => String(t.label_english || '').trim())
              .filter((s: string) => s.length > 0)
              .join(',')
          : '';

        if (options) {
          for (const r of rows as any[]) {
            if (parseInt(r.id || '0') === 69) {
              r.options = options; // inject English options list
            }
          }
        }

        // Inject sports data for sports questions (22 = खेळ प्रकार, 23 = खेळ)
        // Build sports map: { "मैदानी खेळ": ["धावणे", ...], "सांघिक खेळ": [...], ... }
        const [sportsTypes]: any = await conn.query(
          `SELECT id, name_marathi FROM sports_types WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`
        );

        const [sportNames]: any = await conn.query(
          `SELECT sn.sports_type_id, sn.name_marathi 
           FROM sport_names sn
           INNER JOIN sports_types st ON sn.sports_type_id = st.id
           WHERE sn.is_active = 1 AND st.is_active = 1
           ORDER BY sn.sports_type_id ASC, sn.sort_order ASC, sn.id ASC`
        );

        if (Array.isArray(sportsTypes) && Array.isArray(sportNames)) {
          const sportsMap: Record<string, string[]> = {};
          
          for (const type of sportsTypes) {
            const names = sportNames
              .filter((n: any) => n.sports_type_id === type.id)
              .map((n: any) => String(n.name_marathi || '').trim())
              .filter((s: string) => s.length > 0);
            if (names.length > 0) {
              sportsMap[String(type.name_marathi || '').trim()] = names;
            }
          }

          // Inject sports map as JSON string for questions 22 and 23
          const sportsMapJson = JSON.stringify(sportsMap);
          
          for (const r of rows as any[]) {
            const qid = parseInt(r.id || '0');
            // Question 22: "खेळ प्रकार" - inject comma-separated types
            if (qid === 22) {
              r.options = Object.keys(sportsMap).join(',');
            }
            // Question 23: "खेळ" - inject JSON map
            if (qid === 23) {
              r.options = sportsMapJson;
            }
          }
        }
      } finally {
        // always release
        // @ts-ignore
        conn?.release?.();
      }
    } catch (e) {
      Logger.info('get_questions_dynamic_options_skip', { error: (e as any)?.message });
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

