import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      // Truncate in dependency-safe order
      try { await conn.query('TRUNCATE TABLE answers'); } catch {}
      try { await conn.query('TRUNCATE TABLE survey_aadhar'); } catch {}
      try { await conn.query('TRUNCATE TABLE surveys'); } catch {}
      try { await conn.query('TRUNCATE TABLE users'); } catch {}
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      return NextResponse.json({ ok: true, message: 'Truncated users and related tables' });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}


