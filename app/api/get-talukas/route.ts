import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

/**
 * @swagger
 * /api/get-talukas:
 *   get:
 *     summary: Get all talukas
 *     tags: [Location]
 *     responses:
 *       200:
 *         description: Talukas retrieved successfully
 */
export const GET = async (request: NextRequest) => {
  try {
    const [tables] = await (await import('@/lib/db'))
      .getDbPool()
      .execute("SHOW TABLES LIKE 'tbl_all_talukas'");

    const table =
      Array.isArray(tables) && tables.length > 0
        ? 'tbl_all_talukas'
        : 'tbl_taluka';

    const rows = await dbQuery(
      `SELECT DISTINCT taluka FROM \`${table}\`
       WHERE (status IS NULL OR status = 'Active')
       ORDER BY taluka`
    );

    const talukas = rows.map((r: any) => r.taluka);

    return NextResponse.json(
      { ok: true, talukas },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    const TALUKAS = [
      'Ahilyanagar',
      'Akole',
      'Jamkhed',
      'Karjat',
      'Kopargaon',
      'Newasa',
      'Parner',
      'Pathardi',
      'Rahata',
      'Rahuri',
      'Sangamner',
      'Shevgaon',
      'Shrirampur',
      'Shrigonda',
    ];
    return NextResponse.json({ ok: true, talukas: TALUKAS });
  }
};
