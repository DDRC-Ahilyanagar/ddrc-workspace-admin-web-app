import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      const url = new URL(req.url);
      
      // DataTables server-side processing parameters
      const draw = parseInt(url.searchParams.get('draw') || '1');
      const start = parseInt(url.searchParams.get('start') || '0');
      const length = parseInt(url.searchParams.get('length') || '25');
      const searchValue = url.searchParams.get('search[value]') || '';
      
      // Sorting parameters
      const orderColumnIndex = parseInt(url.searchParams.get('order[0][column]') || '0');
      const orderDir = url.searchParams.get('order[0][dir]') || 'desc'; // 'asc' or 'desc'
      
      // Column mapping for sorting (matches DataTable columns order)
      const columns = [
        'id',           // 0 - ID
        'aadhar_no',    // 1 - आधार क्रमांक
        'user_id',      // 2 - वापरकर्ता ID
        'answer_count', // 3 - उत्तरांची संख्या
        'status',       // 4 - स्थिती
        'created_at',   // 5 - तयार केले
        'updated_at',   // 6 - अपडेट केले
        null,           // 7 - क्रिया (not sortable)
      ];
      const orderByColumn = columns[orderColumnIndex] || 'id';
      
      // Build WHERE clause for search
      let whereClause = '1=1';
      const searchParams: any[] = [];
      
      if (searchValue) {
        whereClause += ` AND (aadhar_no LIKE ? OR id LIKE ?)`;
        const searchPattern = `%${searchValue}%`;
        searchParams.push(searchPattern, searchPattern);
      }
      
      // Get total count (before filtering)
      const [totalCountRows]: any = await conn.query(
        `SELECT COUNT(*) AS total FROM survey_aadhar`
      );
      const totalRecords = (totalCountRows as any[])[0]?.total || 0;
      
      // Get filtered count
      const [filteredCountRows]: any = await conn.query(
        `SELECT COUNT(*) AS total FROM survey_aadhar WHERE ${whereClause}`,
        searchParams
      );
      const filteredRecords = (filteredCountRows as any[])[0]?.total || 0;
      
      // Get paginated data
      // Use subquery to handle ordering properly with GROUP BY
      let orderByClause = `sa.${orderByColumn}`;
      if (orderByColumn === 'answer_count') {
        orderByClause = 'answer_count';
      } else if (orderByColumn === 'status') {
        orderByClause = 'status';
      }
      
      const [rows]: any = await conn.query(
        `SELECT 
          sa.id,
          sa.aadhar_no,
          sa.user_id,
          sa.created_at,
          sa.updated_at,
          COUNT(DISTINCT a.id) AS answer_count,
          CASE 
            WHEN COUNT(DISTINCT a.id) > 0 THEN 'Completed'
            ELSE 'Pending'
          END AS status
        FROM survey_aadhar sa
        LEFT JOIN answers a ON a.aadhar_id = sa.id
        WHERE ${whereClause}
        GROUP BY sa.id, sa.aadhar_no, sa.user_id, sa.created_at, sa.updated_at
        ORDER BY ${orderByClause} ${orderDir}
        LIMIT ? OFFSET ?`,
        [...searchParams, length, start]
      );
      
      const surveys = Array.isArray(rows) ? JSON.parse(JSON.stringify(rows)) : [];
      
      // Format dates for display
      const formattedSurveys = surveys.map((s: any) => ({
        ...s,
        created_at: s.created_at ? new Date(s.created_at).toLocaleString('en-IN') : '-',
        updated_at: s.updated_at ? new Date(s.updated_at).toLocaleString('en-IN') : '-',
      }));
      
      Logger.info('surveys_fetched', { 
        total: totalRecords, 
        filtered: filteredRecords, 
        returned: surveys.length,
        draw,
        start,
        length
      });
      
      // DataTables expects this exact format for server-side processing
      return NextResponse.json({
        draw,
        recordsTotal: totalRecords,
        recordsFiltered: filteredRecords,
        data: formattedSurveys,
      });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    Logger.error('surveys_get_error', { error: e.message });
    const draw = parseInt(new URL(req.url).searchParams.get('draw') || '1');
    return NextResponse.json({ 
      draw,
      recordsTotal: 0,
      recordsFiltered: 0,
      data: [],
      error: e.message
    }, { status: 500 });
  }
}

