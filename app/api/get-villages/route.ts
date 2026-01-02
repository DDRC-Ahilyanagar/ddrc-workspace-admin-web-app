import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

/**
 * @swagger
 * /api/get-villages:
 *   get:
 *     summary: Get villages by taluka
 *     tags: [Location]
 *     parameters:
 *       - in: query
 *         name: taluka
 *         required: true
 *         schema:
 *           type: string
 *         example: "Pune"
 *     responses:
 *       200:
 *         description: Villages retrieved successfully
 *       400:
 *         description: Taluka parameter required
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taluka = searchParams.get('taluka')?.trim() || '';

    if (!taluka) {
      return NextResponse.json(
        { ok: false, error: 'taluka required' },
        { status: 400 }
      );
    }

    const pool = await import('@/lib/db').then(m => m.getDbPool());
    const [tables] = await pool.execute("SHOW TABLES LIKE 'tbl_all_villages'");
    const useVillagesTable = Array.isArray(tables) && tables.length > 0;

    let sql: string;
    if (useVillagesTable) {
      sql = `SELECT DISTINCT villages FROM tbl_all_villages 
             WHERE taluka = ? AND (status IS NULL OR status = 'Active') 
             ORDER BY villages`;
    } else {
      sql = `SELECT DISTINCT village AS villages FROM tbl_all_grams 
             WHERE taluka = ? AND (status IS NULL OR status = 'Active') 
             ORDER BY village`;
    }

    const rows = await dbQuery(sql, [taluka]);
    const villages = rows.map((r: any) => {
      const value = r.villages || r.village;
      return Array.isArray(value) ? value[0] : value;
    }).filter(Boolean);

    return NextResponse.json(
      { ok: true, villages },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    // Return empty array on error instead of failing
    console.error('Error fetching villages:', error);
    return NextResponse.json(
      { ok: true, villages: [] },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

