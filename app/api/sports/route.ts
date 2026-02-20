import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const pool = getDbPool();
    const conn = await pool.getConnection();
    
    try {
      // Fetch all sports types
      const [typesRows] = await conn.query(
        `SELECT id, name_marathi, name_english, sort_order 
         FROM sports_types 
         WHERE is_active = 1 
         ORDER BY sort_order ASC, id ASC`
      );
      
      const sportsTypes = Array.isArray(typesRows) ? JSON.parse(JSON.stringify(typesRows)) : [];
      
      // Fetch all sport names
      const [namesRows] = await conn.query(
        `SELECT id, sports_type_id, name_marathi, name_english, sort_order 
         FROM sport_names 
         WHERE is_active = 1 
         ORDER BY sports_type_id ASC, sort_order ASC, id ASC`
      );
      
      const sportNames = Array.isArray(namesRows) ? JSON.parse(JSON.stringify(namesRows)) : [];
      
      // Build nested structure: { type_marathi: [names...] }
      const sportsData: Record<string, string[]> = {};
      
      for (const type of sportsTypes) {
        const names = sportNames
          .filter((n: any) => n.sports_type_id === type.id)
          .map((n: any) => n.name_marathi);
        sportsData[type.name_marathi] = names;
      }
      
      // Also return structured format for easier consumption
      const structured = sportsTypes.map((type: any) => ({
        id: type.id,
        type_marathi: type.name_marathi,
        type_english: type.name_english,
        sort_order: type.sort_order,
        names: sportNames
          .filter((n: any) => n.sports_type_id === type.id)
          .map((n: any) => ({
            id: n.id,
            name_marathi: n.name_marathi,
            name_english: n.name_english,
            sort_order: n.sort_order
          }))
      }));
      
      Logger.info('sports_data_fetched', { 
        types_count: sportsTypes.length,
        names_count: sportNames.length
      });
      
      return NextResponse.json(
        { 
          ok: true, 
          data: {
            // Flat map format (for backward compatibility with existing code)
            map: sportsData,
            // Structured format (for easier consumption)
            structured: structured
          }
        },
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('sports_data_fetch_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}


