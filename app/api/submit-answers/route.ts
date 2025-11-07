import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { requireAuth, verifyAuth } from '@/lib/auth';

/**
 * @swagger
 * /api/submit-answers:
 *   post:
 *     summary: Submit survey answers
 *     tags: [Answers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - aadhar_id
 *               - items
 *             properties:
 *               user_id:
 *                 type: numberR
 *               aadhar_id:
 *                 type: number
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     question_id:
 *                       type: number
 *                     section_id:
 *                       type: number
 *                     answer:
 *                       type: string
 *     responses:
 *       200:
 *         description: Answers submitted successfully
 *       422:
 *         description: Invalid data
 */
async function handleSubmit(request: NextRequest, user: any) {
  try {
    // Robust body parsing for various clients/shells
    const contentType = request.headers.get('content-type') || '';
    let body: any = {};
    try {
      if (contentType.includes('application/json')) {
        // Prefer native JSON parser when declared
        body = await request.json();
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const raw = await request.text();
        const params = new URLSearchParams(raw);
        const obj: Record<string, any> = {};
        params.forEach((v, k) => { obj[k] = v; });
        // Allow a 'json' field to carry the whole payload
        if (obj.json) {
          body = JSON.parse(String(obj.json));
        } else {
          body = obj;
        }
      } else {
        // Fallback: try text->JSON, else attempt URLSearchParams
        const raw = await request.text();
        const sanitized = (raw || '').replace(/^\uFEFF/, '').trim();
        try {
          body = sanitized ? JSON.parse(sanitized) : {};
        } catch {
          const params = new URLSearchParams(sanitized);
          const obj: Record<string, any> = {};
          params.forEach((v, k) => { obj[k] = v; });
          body = obj;
        }
      }
    } catch (e: any) {
      Logger.error('submit_answers_parse_failed', {
        error: e?.message || String(e),
        contentType,
      });
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }
    let userId = Number(user?.id || 0);
    // Fallbacks: accept explicit user_id or user_phone if auth not present
    if (!userId || userId <= 0) {
      if (body.user_id) {
        userId = parseInt(String(body.user_id));
      } else if (body.user_phone) {
        const phone = String(body.user_phone).replace(/\D/g, '');
        if (phone) {
          try {
            const pool0 = getDbPool();
            const [u] = await pool0.query(`SELECT id FROM users WHERE contact_number = ? LIMIT 1`, [phone]);
            if (Array.isArray(u) && (u as any[]).length > 0) {
              userId = (u as any[])[0].id as number;
            }
          } catch {}
        }
      }
    }
    // Accept both spellings from clients; prefer aadhaar_id
    const aadhaarId = parseInt(body.aadhaar_id || body.aadhar_id || '0');
    const items = body.items || [];
    const campIdRaw = body.camp_id !== undefined && body.camp_id !== null
      ? parseInt(String(body.camp_id))
      : NaN;
    const campId = Number.isFinite(campIdRaw) ? campIdRaw : 0;

    if (userId <= 0 || aadhaarId <= 0 || !Array.isArray(items)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid data' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    const connection = await pool.getConnection();

    try {
      // Ensure table exists with required columns; add any missing columns/indexes
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS answers (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NULL,
          aadhaar_id BIGINT UNSIGNED NULL,
          camp_id BIGINT UNSIGNED NULL,
          section_id BIGINT UNSIGNED NULL,
          question_id BIGINT UNSIGNED NULL,
          answer TEXT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // Add columns if they don't exist (for existing deployments)
      await connection.execute(`ALTER TABLE answers ADD COLUMN IF NOT EXISTS user_id BIGINT UNSIGNED NULL`);
      await connection.execute(`ALTER TABLE answers ADD COLUMN IF NOT EXISTS aadhaar_id BIGINT UNSIGNED NULL`);
      await connection.execute(`ALTER TABLE answers ADD COLUMN IF NOT EXISTS camp_id BIGINT UNSIGNED NULL`);
      await connection.execute(`ALTER TABLE answers ADD COLUMN IF NOT EXISTS section_id BIGINT UNSIGNED NULL`);
      await connection.execute(`ALTER TABLE answers ADD COLUMN IF NOT EXISTS question_id BIGINT UNSIGNED NULL`);
      await connection.execute(`ALTER TABLE answers ADD COLUMN IF NOT EXISTS answer TEXT NULL`);
      await connection.execute(`ALTER TABLE answers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP`);

      // Ensure helpful indexes exist
      await connection.execute(`ALTER TABLE answers ADD KEY IF NOT EXISTS idx_aadhaar (aadhaar_id)`);
      // Drop deprecated column if present to avoid confusion
      try {
        await connection.execute(`ALTER TABLE answers DROP COLUMN aadhar_id`);
      } catch {}

      // Validate parent Aadhaar exists
      try {
        const [aadhaarRows] = await pool.query(
          'SELECT id FROM aadhaars WHERE id = ? LIMIT 1',
          [aadhaarId]
        );
        if (!Array.isArray(aadhaarRows) || (aadhaarRows as any[]).length === 0) {
          return NextResponse.json(
            { ok: false, error: 'Aadhaar entry not found. Insert Aadhaar first.' },
            { status: 422 }
          );
        }
      } catch (e: any) {
        Logger.error('aadhaar_lookup_failed', { error: e?.message || String(e) });
        return NextResponse.json(
          { ok: false, error: 'Aadhaar lookup failed' },
          { status: 500 }
        );
      }
      await connection.execute(`ALTER TABLE answers ADD KEY IF NOT EXISTS idx_question (question_id)`);
      await connection.execute(`ALTER TABLE answers ADD KEY IF NOT EXISTS idx_section (section_id)`);

      // Ensure camp_id is nullable to allow "no camp" submissions
      try {
        await connection.execute(`
          ALTER TABLE answers 
          MODIFY COLUMN camp_id BIGINT UNSIGNED NULL
        `);
      } catch {}

      // Detect if camp_id column exists (may be present with FK in existing DB)
      const [cols] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'answers'`
      );
      const columnNames = Array.isArray(cols) ? (cols as any[]).map(c => c.COLUMN_NAME) : [];
      const hasCampId = columnNames.includes('camp_id');

      let count = 0;
      const insertSql = hasCampId
        ? 'INSERT INTO answers (user_id, aadhaar_id, camp_id, section_id, question_id, answer) VALUES (?, ?, ?, ?, ?, ?)'
        : 'INSERT INTO answers (user_id, aadhaar_id, section_id, question_id, answer) VALUES (?, ?, ?, ?, ?)';
      const stmt = await connection.prepare(insertSql);

      for (const item of items) {
        const qid = parseInt(item.question_id || '0');
        const sid = item.section_id ? parseInt(item.section_id) : null;
        const ans = Array.isArray(item.answer) 
          ? JSON.stringify(item.answer) 
          : String(item.answer || '');

        if (qid <= 0) continue;

        // If no camp selected (0), store NULL to satisfy FK constraint
        const campIdForInsert = (campId && campId > 0) ? campId : null;
        const params = hasCampId
          ? [userId, aadhaarId, campIdForInsert, sid, qid, ans]
          : [userId, aadhaarId, sid, qid, ans];
        await stmt.execute(params as any);
        count++;
      }

      await stmt.close();

      Logger.info('submit_answers', { count, aadhaar_id: aadhaarId });
      return NextResponse.json({ ok: true, saved: count });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    Logger.error('submit_answers_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// Accept either authenticated requests (Authorization header / session cookie)
// or fallback to explicit identifiers in the JSON body (user_id or user_phone).
export const POST = async (request: NextRequest) => {
  const { user } = await verifyAuth(request);
  return handleSubmit(request, user as any);
};

