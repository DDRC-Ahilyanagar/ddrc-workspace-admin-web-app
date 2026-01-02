import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Get user info to check role (optional - for filtering)
    let userType = '';
    let userId: number | undefined;
    let isVerificationOfficer = false;
    
    try {
      const { user } = await verifyAuth(req);
      if (user) {
        userType = user.user_type?.toLowerCase() || '';
        isVerificationOfficer = userType === 'verification_officer';
        userId = user.id;
      }
    } catch (authError) {
      // Auth is optional for this endpoint - continue without user info
      Logger.info('surveys_get_no_auth', { note: 'Request without authentication' });
    }

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
      
      // Get filter type (unassigned, all, etc.)
      const filterType = url.searchParams.get('filter') || 'all'; // 'all', 'unassigned', 'pending', 'verified', 'approved'
      
      // Check if verification columns exist in surveys table
      let hasVerificationColumns = false;
      try {
        const [columnCheck]: any = await conn.query(
          `SELECT COUNT(*) as count 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'surveys' 
             AND COLUMN_NAME IN ('verification_status', 'admin_approval_status', 'assigned_to')`
        );
        hasVerificationColumns = Array.isArray(columnCheck) && columnCheck.length > 0 && columnCheck[0].count >= 3;
      } catch (checkError) {
        Logger.info('surveys_column_check_failed', { error: checkError });
        hasVerificationColumns = false;
      }

      // Build WHERE clause for search
      let whereClause = '1=1';
      const searchParams: any[] = [];
      
      // Apply filter conditions based on user role
      if (isVerificationOfficer && userId) {
        // Verification officers see:
        // 1. Surveys assigned to them (under_review)
        // 2. All completed surveys (for verification)
        // 3. All incomplete surveys
        if (filterType === 'assigned_to_me' && hasVerificationColumns) {
          whereClause += ` AND s.assigned_to = ?`;
          searchParams.push(userId);
        } else if (filterType === 'completed') {
          whereClause += ` AND COALESCE(s.no_of_questions_answered, 0) > 0 AND (s.no_of_questions_unanswered = 0 OR s.no_of_questions_unanswered IS NULL)`;
        } else if (filterType === 'incomplete') {
          whereClause += ` AND (COALESCE(s.no_of_questions_answered, 0) = 0 OR (s.no_of_questions_unanswered > 0 AND s.no_of_questions_unanswered IS NOT NULL))`;
        }
        // 'all' shows everything - no additional filter
      } else {
        // Admin filter conditions
        if (filterType === 'unassigned' && hasVerificationColumns) {
          whereClause += ` AND (s.source = 'Divyang Self' OR s.source IS NULL) AND (s.assigned_to IS NULL OR s.assigned_to = 0)`;
        } else if (filterType === 'pending' && hasVerificationColumns) {
          whereClause += ` AND (s.verification_status = 'pending' OR s.verification_status IS NULL)`;
        } else if (filterType === 'under_review' && hasVerificationColumns) {
          whereClause += ` AND s.verification_status = 'under_review'`;
        } else if (filterType === 'verified' && hasVerificationColumns) {
          whereClause += ` AND s.verification_status = 'verified'`;
        } else if (filterType === 'approved' && hasVerificationColumns) {
          whereClause += ` AND s.admin_approval_status = 'approved'`;
        }
        // 'all' shows everything - no additional filter
      }
      
      if (searchValue) {
        whereClause += ` AND (sa.aadhar_no LIKE ? OR sa.id LIKE ?)`;
        const searchPattern = `%${searchValue}%`;
        searchParams.push(searchPattern, searchPattern);
      }
      
      // Get total count (before filtering) - count from surveys table joined with survey_aadhar
      const [totalCountRows]: any = await conn.query(
        `SELECT COUNT(DISTINCT sa.id) AS total 
         FROM survey_aadhar sa
         LEFT JOIN surveys s ON s.aadhaar_id = sa.id`
      );
      const totalRecords = (totalCountRows as any[])[0]?.total || 0;
      
      // Get filtered count
      const [filteredCountRows]: any = await conn.query(
        `SELECT COUNT(DISTINCT sa.id) AS total 
         FROM survey_aadhar sa
         LEFT JOIN surveys s ON s.aadhaar_id = sa.id
         WHERE ${whereClause}`,
        searchParams
      );
      const filteredRecords = (filteredCountRows as any[])[0]?.total || 0;
      
      // Get paginated data - use surveys table for answer count and status (primary source)
      // Map column names to actual table columns
      let orderByClause = 'sa.id'; // Default fallback
      if (orderByColumn === 'answer_count') {
        orderByClause = 'COALESCE(s.no_of_questions_answered, 0)';
      } else if (orderByColumn === 'status') {
        orderByClause = `CASE 
          WHEN COALESCE(s.no_of_questions_answered, 0) > 0 THEN 'Completed'
          ELSE 'Pending'
        END`;
      } else if (orderByColumn === 'id') {
        orderByClause = 'sa.id';
      } else if (orderByColumn === 'aadhar_no') {
        orderByClause = 'sa.aadhar_no';
      } else if (orderByColumn === 'user_id') {
        orderByClause = 'sa.user_id';
      } else if (orderByColumn === 'created_at') {
        orderByClause = 'sa.created_at';
      } else if (orderByColumn === 'updated_at') {
        orderByClause = 'sa.updated_at';
      } else {
        // Fallback to sa.id for unknown columns
        orderByClause = 'sa.id';
      }

      // Build the query with proper error handling
      const queryParams = [...searchParams, length, start];
      let rows: any;
      
      // Build SELECT fields based on whether verification columns exist
      const verificationFields = hasVerificationColumns ? `
            s.verification_status,
            s.admin_approval_status,
            s.assigned_to,
            s.admin_corrections,
            s.verified_by,
            s.verified_at,
            s.approved_by,
            s.approved_at,
            u_assigned.name AS assigned_to_name,
            u_verified.name AS verified_by_name,
            u_approved.name AS approved_by_name` : `
            NULL AS verification_status,
            NULL AS admin_approval_status,
            NULL AS assigned_to,
            NULL AS admin_corrections,
            NULL AS verified_by,
            NULL AS verified_at,
            NULL AS approved_by,
            NULL AS approved_at,
            NULL AS assigned_to_name,
            NULL AS verified_by_name,
            NULL AS approved_by_name`;
      
      const joinClauses = hasVerificationColumns ? `
          LEFT JOIN users u_assigned ON u_assigned.id = s.assigned_to
          LEFT JOIN users u_verified ON u_verified.id = s.verified_by
          LEFT JOIN users u_approved ON u_approved.id = s.approved_by` : '';
      
      try {
        [rows] = await conn.query(
          `SELECT 
            sa.id,
            sa.aadhar_no,
            sa.user_id,
            sa.created_at,
            sa.updated_at,
            COALESCE(s.no_of_questions_answered, 0) AS answer_count,
            CASE 
              WHEN COALESCE(s.no_of_questions_answered, 0) > 0 THEN 'Completed'
              ELSE 'Pending'
            END AS status,
            s.source${verificationFields ? ',' + verificationFields.trim() : ''}
          FROM survey_aadhar sa
          LEFT JOIN surveys s ON s.aadhaar_id = sa.id${joinClauses}
          WHERE ${whereClause}
          ORDER BY ${orderByClause} ${orderDir}
          LIMIT ? OFFSET ?`,
          queryParams
        );
      } catch (queryError: any) {
        Logger.error('surveys_query_error', { 
          error: queryError.message,
          sql: `WHERE ${whereClause} ORDER BY ${orderByClause} ${orderDir}`,
          params: queryParams,
          stack: queryError.stack
        });
        throw queryError;
      }
      
      const surveys = Array.isArray(rows) ? JSON.parse(JSON.stringify(rows)) : [];
      
      // Format dates for display
      const formattedSurveys = surveys.map((s: any) => ({
        ...s,
        created_at: s.created_at ? new Date(s.created_at).toLocaleString('en-IN') : '-',
        updated_at: s.updated_at ? new Date(s.updated_at).toLocaleString('en-IN') : '-',
        verified_at: s.verified_at ? new Date(s.verified_at).toLocaleString('en-IN') : null,
        approved_at: s.approved_at ? new Date(s.approved_at).toLocaleString('en-IN') : null,
        verification_status: s.verification_status || 'pending',
        admin_approval_status: s.admin_approval_status || 'pending',
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
    Logger.error('surveys_get_error', { 
      error: e.message,
      stack: e.stack,
      name: e.name
    });
    const draw = parseInt(new URL(req.url || '').searchParams.get('draw') || '1');
    return NextResponse.json({ 
      draw,
      recordsTotal: 0,
      recordsFiltered: 0,
      data: [],
      error: e.message || 'Internal server error'
    }, { status: 500 });
  }
}

