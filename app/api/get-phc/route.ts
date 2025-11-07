import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taluka = searchParams.get('taluka');

  try {
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        'SELECT name FROM phc WHERE taluka = ? ORDER BY name ASC',
        [taluka]
      );
      const data = (rows as any[]).map(r => r.name);
      return NextResponse.json(data);
    } finally {
      conn.release();
    }
  } catch {
    return NextResponse.json([]);
  }
}


