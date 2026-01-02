import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

/**
 * @swagger
 * /api/get-grams:
 *   get:
 *     summary: Get grams by taluka
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
 *         description: Grams retrieved successfully
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

    // Check if table exists
    const pool = await import('@/lib/db').then(m => m.getDbPool());
    const [tables] = await pool.execute("SHOW TABLES LIKE 'tbl_all_grams'");
    const tableExists = Array.isArray(tables) && tables.length > 0;

    if (!tableExists) {
      // Return empty array if table doesn't exist
      return NextResponse.json(
        { ok: true, grams: [] },
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const rows = await dbQuery(
      `SELECT DISTINCT gram FROM tbl_all_grams 
       WHERE taluka = ? AND (status IS NULL OR status = 'Active') 
       ORDER BY gram`,
      [taluka]
    );

    const grams = rows.map((r: any) => r.gram).filter(Boolean);

    return NextResponse.json(
      { ok: true, grams },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    // Return empty array on error instead of failing
    console.error('Error fetching grams:', error);
    return NextResponse.json(
      { ok: true, grams: [] },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

