import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function ensureView(conn: any) {
  try {
    // Check if the user's custom view exists
    const [viewCheck]: any = await conn.query("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
    const allViews = Array.isArray(viewCheck) ? viewCheck.map((v: any) => Object.values(v)[0] as string) : [];
    const viewExists = allViews.includes('view_sections_with_questions');
    
    if (!viewExists) {
      Logger.error('custom_view_not_found', { view: 'view_sections_with_questions', availableViews: allViews });
      throw new Error('Custom view view_sections_with_questions does not exist');
    }
    
    Logger.info('custom_view_found', { view: 'view_sections_with_questions' });
  } catch (e: any) {
    Logger.error('view_check_error', { error: e.message, stack: e.stack });
    throw e;
  }
}

async function ensureTable() {
  // Table already exists with actual structure - no need to create
  // Actual columns: id, section_id, question_marathi, question_english, question_type, options, regex, is_required, is_active, sort_order, rendering_condition, created_at, updated_at, title
}

function normalizeRow(b: any) {
  // Map to actual DB columns - accept 'question' and map to 'question_marathi'
  return {
    question_marathi: b.question || b.question_marathi || '',
    question_english: b.question_english || null,
    question_type: b.question_type || 'short_answer',
    options: b.options || null,
    regex: b.regex || null,
    valid_input: b.valid_input || null,
    max_length: b.max_length !== undefined && b.max_length !== null ? parseInt(b.max_length) : null,
    is_required: b.is_required !== undefined ? (b.is_required ? 1 : 0) : 1,
    is_active: b.is_active !== undefined ? (b.is_active ? 1 : 0) : 1,
    sort_order: b.sort_order || 0,
    rendering_condition: b.rendering_condition || null,
    title: b.title || null,
    section_id: b.section_id || 1,
  };
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      // Verify database connection
      const [dbInfo]: any = await conn.query('SELECT DATABASE() as db');
      const dbName = Array.isArray(dbInfo) && dbInfo[0] ? dbInfo[0].db : 'unknown';
      Logger.info('questions_db_connected', { database: dbName });
      
      // Ensure the view exists
      await ensureView(conn);
      
      const url = new URL(req.url);
      const q = url.searchParams.get('q');
      const section = url.searchParams.get('title');
      
      // Fetch from the user's custom view
      let sql = `SELECT * FROM view_sections_with_questions`;
      const where: string[] = [];
      const params: any[] = [];
      
      if (q) {
        where.push('(question_marathi LIKE ? OR question_english LIKE ? OR question_title LIKE ?)');
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      if (section) {
        where.push('(section_title_marathi = ? OR section_title_english = ? OR question_title = ? OR section_id = ?)');
        params.push(section, section, section, section);
      }
      
      // Always fetch only active questions
      where.push('question_is_active = 1');
      sql += ' WHERE ' + where.join(' AND ');
      sql += ' ORDER BY question_sort_order ASC, question_id ASC';
      
      Logger.info('questions_query', { sql, params });
      const [rows] = await conn.query(sql, params);
      
      // MySQL returns RowDataPacket objects, need to serialize them properly
      const questions = Array.isArray(rows) ? JSON.parse(JSON.stringify(rows)) : [];
      
      Logger.info('questions_fetched', { 
        count: questions.length,
        sample: questions.length > 0 ? {
          question_id: (questions[0] as any).question_id,
          question_marathi: (questions[0] as any).question_marathi,
          section_id: (questions[0] as any).section_id,
          section_title_marathi: (questions[0] as any).section_title_marathi,
          question_type: (questions[0] as any).question_type,
          allKeys: Object.keys(questions[0] || {})
        } : null,
        sectionTitles: questions.slice(0, 5).map((q: any) => ({ 
          question_id: q.question_id, 
          section_id: q.section_id, 
          section_title_marathi: q.section_title_marathi 
        }))
      });
      
      return NextResponse.json({ ok: true, data: questions });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    Logger.error('questions_get_error', { error: e.message });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
      const body = await req.json();
      const row = normalizeRow(body);
      if (!row.question_marathi) return NextResponse.json({ ok: false, error: 'question_marathi required' }, { status: 422 });
      const pool = getDbPool();
      const conn = await pool.getConnection();
      try {
        // Map to actual table columns
        const [r] = await conn.query(
          `INSERT INTO questions (question_marathi, question_english, question_type, options, regex, valid_input, max_length, is_required, is_active, sort_order, rendering_condition, title, section_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) FROM questions q), 0) + 1, ?, ?, ?, NOW(), NOW())`,
          [row.question_marathi, row.question_english, row.question_type, row.options, row.regex, row.valid_input, row.max_length, row.is_required, row.is_active, row.rendering_condition, row.title, row.section_id]
        );
      const id = (r as any).insertId;
      return NextResponse.json({ ok: true, id });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    Logger.error('questions_post_error', { error: e.message });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureTable();
      const body = await req.json();
      const id = parseInt(body.question_id || body.id || '0');
      if (!id) return NextResponse.json({ ok: false, error: 'question_id required' }, { status: 422 });
      const row = normalizeRow(body);
      const pool = getDbPool();
      const conn = await pool.getConnection();
      try {
        // Map to actual table columns
        await conn.query(
          `UPDATE questions SET
           question_marathi=?, question_english=?, question_type=?, options=?, regex=?, valid_input=?, max_length=?, is_required=?, is_active=?, sort_order=?, rendering_condition=?, title=?, section_id=?, updated_at=NOW()
         WHERE id=?`,
          [row.question_marathi, row.question_english, row.question_type, row.options, row.regex, row.valid_input, row.max_length, row.is_required, row.is_active, row.sort_order, row.rendering_condition, row.title, row.section_id, id]
        );
      return NextResponse.json({ ok: true });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    Logger.error('questions_put_error', { error: e.message });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureTable();
    const url = new URL(req.url);
    const id = parseInt(url.searchParams.get('id') || url.searchParams.get('question_id') || '0');
    if (!id) return NextResponse.json({ ok: false, error: 'question_id required' }, { status: 422 });
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      // Read body for reason if provided
      let reason = '';
      try { const body = await req.json(); reason = (body?.reason || '').toString(); } catch {}
      // Soft delete: set is_active = 0
      await conn.query('UPDATE questions SET is_active=0, updated_at=NOW() WHERE id=?', [id]);
      // Optional: store reason in a simple log table if exists
      try {
        await conn.query(
          'CREATE TABLE IF NOT EXISTS question_delete_logs (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, question_id BIGINT UNSIGNED NOT NULL, reason TEXT NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
        );
        await conn.query('INSERT INTO question_delete_logs (question_id, reason) VALUES (?, ?)', [id, reason || null]);
      } catch {}
      return NextResponse.json({ ok: true, softDeleted: true });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    Logger.error('questions_delete_error', { error: e.message });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}



