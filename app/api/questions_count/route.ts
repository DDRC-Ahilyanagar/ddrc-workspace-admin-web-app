import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM questions 
         WHERE (is_active = 1) OR (status = 'Active')`
      );
      const count = (rows as any[])[0]?.cnt ?? 0;
      return NextResponse.json({ count });
    } finally {
      conn.release();
    }
  } catch (e) {
    // Fallback to zero if table not present
    return NextResponse.json({ count: 0 });
  }
}


