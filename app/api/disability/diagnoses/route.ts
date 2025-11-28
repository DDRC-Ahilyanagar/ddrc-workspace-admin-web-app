import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

/**
 * GET /api/disability/diagnoses
 * Optional query params:
 *  - disabilityId: number (filters diagnoses for a specific disability)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const disabilityId = searchParams.get('disabilityId');

    let sql = `
      SELECT id, disability_id AS disabilityId, diagnosis
      FROM tbl_disability_diagnoses
      WHERE status IS NULL OR status = 'Active'
    `;
    const params: Array<string | number> = [];

    if (disabilityId) {
      sql += ' AND disability_id = ?';
      params.push(disabilityId);
    }

    sql += ' ORDER BY diagnosis ASC';

    const rows = await dbQuery<any>(sql, params);

    const diagnoses = rows
      .map((row: any) => ({
        id: row.id,
        disabilityId: row.disabilityId,
        diagnosis: (row.diagnosis || '').toString().trim(),
      }))
      .filter((row) => row.diagnosis.length > 0);

    return NextResponse.json(
      { ok: true, diagnoses },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message ?? 'Failed to fetch diagnoses' },
      { status: 500 }
    );
  }
}


