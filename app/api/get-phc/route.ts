import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taluka = searchParams.get('taluka')?.trim() || '';

    if (!taluka) {
      return NextResponse.json(
        { ok: false, error: 'taluka required' },
        { status: 400 }
      );
    }

    // Check if table exists
    const pool = await import('@/lib/db').then(m => m.getDbPool());
    const [tables] = await pool.execute("SHOW TABLES LIKE 'tbl_all_phc'");
    const tableExists = Array.isArray(tables) && tables.length > 0;

    if (!tableExists) {
      // Return empty array if table doesn't exist
      Logger.info('get_phc_table_missing', { taluka });
      return NextResponse.json(
        { ok: true, phc: [] },
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const rows = await dbQuery(
      `SELECT DISTINCT phc 
       FROM tbl_all_phc 
       WHERE taluka = ? AND (status IS NULL OR status = 'Active') 
       ORDER BY phc`,
      [taluka]
    );
    const phc = rows
      .map((r: any) => (r.phc || '').toString().trim())
      .filter(Boolean);

    return NextResponse.json(
      { ok: true, phc },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    Logger.error('get_phc_failed', { error: error?.message });
    // Return empty array on error instead of failing
    return NextResponse.json(
      { ok: true, phc: [] },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}


