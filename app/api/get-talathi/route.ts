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

    const rows = await dbQuery(
      `SELECT DISTINCT talathi 
       FROM tbl_all_talathi 
       WHERE taluka = ? AND (status IS NULL OR status = 'Active') 
       ORDER BY talathi`,
      [taluka]
    );
    const talathi = rows
      .map((r: any) => (r.talathi || '').toString().trim())
      .filter(Boolean);

    return NextResponse.json(
      { ok: true, talathi },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    Logger.error('get_talathi_failed', { error: error?.message });
    return NextResponse.json(
      { ok: false, error: error?.message || 'failed to load talathi offices' },
      { status: 500 }
    );
  }
}


