import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/sports-types:
 *   get:
 *     summary: Get all sports types
 *     tags: [Sports]
 *     responses:
 *       200:
 *         description: Sports types retrieved successfully
 */
export async function GET(request: NextRequest) {
  try {
    const pool = getDbPool();
    const conn = await pool.getConnection();
    
    try {
      const [rows] = await conn.query(
        `SELECT id, name_marathi, name_english, sort_order, is_active 
         FROM sports_types 
         WHERE is_active = 1 
         ORDER BY sort_order ASC, id ASC`
      );
      
      const sportsTypes = Array.isArray(rows) ? JSON.parse(JSON.stringify(rows)) : [];
      
      Logger.info('sports_types_fetched', { count: sportsTypes.length });
      
      return NextResponse.json(
        { ok: true, data: sportsTypes },
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('sports_types_fetch_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

