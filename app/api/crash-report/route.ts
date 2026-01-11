import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/crash-report
 * Receive crash reports from mobile app
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      error_message,
      stack_trace,
      error_type,
      device_info,
      app_version,
      user_id,
      user_phone,
      screen_name,
      additional_data,
      timestamp,
    } = body;

    if (!error_message) {
      return NextResponse.json(
        { ok: false, error: 'error_message is required' },
        { status: 400 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Ensure crash_reports table exists
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS crash_reports (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          error_message TEXT NOT NULL,
          stack_trace LONGTEXT,
          error_type VARCHAR(100),
          device_info JSON,
          app_version VARCHAR(50),
          user_id BIGINT UNSIGNED,
          user_phone VARCHAR(20),
          screen_name VARCHAR(200),
          additional_data JSON,
          timestamp DATETIME NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_user_phone (user_phone),
          INDEX idx_timestamp (timestamp),
          INDEX idx_error_type (error_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Insert crash report
      await conn.execute(
        `INSERT INTO crash_reports 
         (error_message, stack_trace, error_type, device_info, app_version, 
          user_id, user_phone, screen_name, additional_data, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          error_message,
          stack_trace || null,
          error_type || null,
          device_info ? JSON.stringify(device_info) : null,
          app_version || null,
          user_id || null,
          user_phone || null,
          screen_name || null,
          additional_data ? JSON.stringify(additional_data) : null,
          timestamp ? new Date(timestamp) : new Date(),
        ]
      );

      Logger.info('CRASH_REPORT_RECEIVED', {
        error_type,
        user_id,
        user_phone,
        screen_name,
        app_version,
      });

      return NextResponse.json({ ok: true });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('CRASH_REPORT_ERROR', {
      error: error?.message || String(error),
      stack: error?.stack,
    });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to save crash report' },
      { status: 500 }
    );
  }
}
