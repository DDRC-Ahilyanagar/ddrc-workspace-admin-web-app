import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function ensureTable() {
  const pool = getDbPool();
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sections (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        status VARCHAR(32) DEFAULT 'Active',
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Add is_active column if it doesn't exist
    try {
      await conn.query('ALTER TABLE sections ADD COLUMN is_active TINYINT(1) DEFAULT 1');
    } catch {}
  } finally {
    conn.release();
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      // Order by ID in ascending order
      const orderClause = 'ORDER BY id ASC';
      // Only fetch active sections
      const [rows] = await conn.query(`SELECT * FROM sections WHERE (is_active = 1 OR is_active IS NULL) ${orderClause}`);
      const sections = Array.isArray(rows) ? JSON.parse(JSON.stringify(rows)) : [];
      return NextResponse.json({ ok: true, data: sections });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    Logger.error('sections_get_error', { error: e.message });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { name, description, status } = body;
    
    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: 'Section name is required' }, { status: 422 });
    }
    
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      const [r] = await conn.query(
        'INSERT INTO sections (name, description, status) VALUES (?, ?, ?)',
        [name.trim(), description || null, status || 'Active']
      );
      const id = (r as any).insertId;
      return NextResponse.json({ ok: true, id });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    Logger.error('sections_post_error', { error: e.message });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { id, name, description, status } = body;
    
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 422 });
    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: 'Section name is required' }, { status: 422 });
    }
    
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      await conn.query(
        'UPDATE sections SET name=?, description=?, status=? WHERE id=?',
        [name.trim(), description || null, status || 'Active', id]
      );
      return NextResponse.json({ ok: true });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    Logger.error('sections_put_error', { error: e.message });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureTable();
    const url = new URL(req.url);
    const id = parseInt(url.searchParams.get('id') || '0');
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 422 });
    
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      // Read body for reason if provided
      let reason = '';
      try { const body = await req.json(); reason = (body?.reason || '').toString(); } catch {}
      // Soft delete: set is_active = 0
      await conn.query('UPDATE sections SET is_active=0, updated_at=NOW() WHERE id=?', [id]);
      // Optional: store reason in a simple log table if exists
      try {
        await conn.query(
          'CREATE TABLE IF NOT EXISTS section_delete_logs (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, section_id BIGINT UNSIGNED NOT NULL, reason TEXT NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
        );
        await conn.query('INSERT INTO section_delete_logs (section_id, reason) VALUES (?, ?)', [id, reason || null]);
      } catch {}
      return NextResponse.json({ ok: true, softDeleted: true });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    Logger.error('sections_delete_error', { error: e.message });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

