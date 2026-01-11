import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/signup-logs
 * Get field officer signup logs for admin viewing
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.user || authResult.error) {
      return NextResponse.json(
        { ok: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = authResult.user;
    const userType = (user.user_type || '').toLowerCase().trim();

    // Only admins can view signup logs
    if (userType !== 'admin' && userType !== 'administrator') {
      return NextResponse.json(
        { ok: false, error: 'Only admins can view signup logs' },
        { status: 403 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      const url = new URL(request.url);
      const phone = url.searchParams.get('phone') || null;
      const userId = url.searchParams.get('user_id') || null;

      let query = `
        SELECT 
          sl.id,
          sl.user_id,
          sl.phone,
          sl.step,
          sl.step_number,
          sl.status,
          sl.data,
          sl.error_message,
          sl.created_at,
          sl.updated_at,
          u.name as user_name
        FROM field_officer_signup_logs sl
        LEFT JOIN users u ON sl.user_id = u.id
        WHERE 1=1
      `;

      const params: any[] = [];

      if (phone) {
        query += ` AND sl.phone = ?`;
        params.push(phone);
      }

      if (userId) {
        query += ` AND sl.user_id = ?`;
        params.push(parseInt(userId));
      }

      query += ` ORDER BY sl.created_at DESC LIMIT 1000`;

      const [rows]: any = await conn.query(query, params);

      const logs = Array.isArray(rows) ? rows.map((row: any) => {
        let data = null;
        try {
          if (row.data) {
            data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          }
        } catch (e) {
          // Ignore parse errors
        }

        return {
          id: row.id,
          user_id: row.user_id,
          phone: row.phone,
          user_name: row.user_name,
          step: row.step,
          step_number: row.step_number,
          status: row.status,
          data: data,
          error_message: row.error_message,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      }) : [];

      // Group logs by phone number for better organization
      const logsByPhone = new Map<string, any[]>();
      logs.forEach((log: any) => {
        if (!logsByPhone.has(log.phone)) {
          logsByPhone.set(log.phone, []);
        }
        logsByPhone.get(log.phone)!.push(log);
      });

      return NextResponse.json({
        ok: true,
        logs: logs,
        logs_by_phone: Array.from(logsByPhone.entries()).map(([phone, phoneLogs]) => ({
          phone,
          logs: phoneLogs.sort((a, b) => a.step_number - b.step_number),
          total_steps: phoneLogs.length,
          completed_steps: phoneLogs.filter((l: any) => l.status === 'completed').length,
          failed_steps: phoneLogs.filter((l: any) => l.status === 'failed').length,
        })),
        total: logs.length,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('GET_SIGNUP_LOGS_ERROR', { error: error?.message || String(error) });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch signup logs' },
      { status: 500 }
    );
  }
}
