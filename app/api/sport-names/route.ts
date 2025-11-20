import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/sport-names:
 *   get:
 *     summary: Get sport names, optionally filtered by sports type
 *     tags: [Sports]
 *     parameters:
 *       - in: query
 *         name: sports_type_id
 *         schema:
 *           type: integer
 *         description: Filter by sports type ID
 *     responses:
 *       200:
 *         description: Sport names retrieved successfully
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sportsTypeId = url.searchParams.get('sports_type_id');
    
    const pool = getDbPool();
    const conn = await pool.getConnection();
    
    try {
      let query = `
        SELECT sn.id, sn.sports_type_id, sn.name_marathi, sn.name_english, 
               sn.sort_order, sn.is_active,
               st.name_marathi as sports_type_marathi, st.name_english as sports_type_english
        FROM sport_names sn
        INNER JOIN sports_types st ON sn.sports_type_id = st.id
        WHERE sn.is_active = 1 AND st.is_active = 1
      `;
      const params: any[] = [];
      
      if (sportsTypeId) {
        query += ' AND sn.sports_type_id = ?';
        params.push(parseInt(sportsTypeId));
      }
      
      query += ' ORDER BY sn.sports_type_id ASC, sn.sort_order ASC, sn.id ASC';
      
      const [rows] = await conn.query(query, params);
      
      const sportNames = Array.isArray(rows) ? JSON.parse(JSON.stringify(rows)) : [];
      
      Logger.info('sport_names_fetched', { 
        count: sportNames.length,
        sports_type_id: sportsTypeId || 'all'
      });
      
      return NextResponse.json(
        { ok: true, data: sportNames },
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('sport_names_fetch_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

