import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

/**
 * @swagger
 * /api/get-vidhansabha:
 *   get:
 *     summary: Get VidhanSabha constituencies by LokSabha
 *     tags: [Location]
 *     parameters:
 *       - in: query
 *         name: loksabha
 *         required: true
 *         schema:
 *           type: string
 *         example: "३८ शिर्डी लोकसभा मतदारसंघ"
 *     responses:
 *       200:
 *         description: VidhanSabha constituencies retrieved successfully
 *       400:
 *         description: LokSabha parameter required
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const loksabha = searchParams.get('loksabha')?.trim() || '';

    if (!loksabha) {
      return NextResponse.json(
        { ok: false, error: 'loksabha required' },
        { status: 400 }
      );
    }

    // Query based on the PHP implementation:
    // 1. Get sangh_id from tbl_matadar_sangh where type = loksabha
    // 2. Get names from tbl_matadar_sangh_names where sangh_id = id
    const sanghRows = await dbQuery(
      `SELECT id FROM tbl_matadar_sangh WHERE type = ? LIMIT 1`,
      [loksabha]
    );

    if (!sanghRows || sanghRows.length === 0) {
      return NextResponse.json(
        { ok: true, vidhansabhas: [] },
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const sanghId = sanghRows[0].id;
    const vidhansabhaRows = await dbQuery(
      `SELECT name FROM tbl_matadar_sangh_names WHERE sangh_id = ? AND (status IS NULL OR status = 'Active') ORDER BY name`,
      [sanghId]
    );

    const vidhansabhas = vidhansabhaRows
      .map((r: any) => (r.name || '').toString().trim())
      .filter(Boolean);

    return NextResponse.json(
      { ok: true, vidhansabhas },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

