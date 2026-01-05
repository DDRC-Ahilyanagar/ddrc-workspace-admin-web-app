import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Register FCM token for push notifications
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await verifyAuth(request);
    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const fcmToken = body.fcm_token?.toString().trim();

    if (!fcmToken || fcmToken.length < 10) {
      return NextResponse.json(
        { ok: false, error: 'Invalid FCM token' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Check if users table has fcm_token column, if not we'll need to add it
      // For now, we'll store it in a separate table or update users table
      
      // Try to update users table first
      try {
        await conn.query(
          `UPDATE users SET fcm_token = ? WHERE id = ?`,
          [fcmToken, user.id]
        );
        Logger.info('fcm_token_registered', {
          user_id: user.id,
          phone: user.phone,
        });
      } catch (updateError: any) {
        // If column doesn't exist, create a separate table
        if (updateError.code === 'ER_BAD_FIELD_ERROR') {
          // Create fcm_tokens table if it doesn't exist
          await conn.query(`
            CREATE TABLE IF NOT EXISTS fcm_tokens (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              fcm_token VARCHAR(255) NOT NULL,
              device_info TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_user_token (user_id, fcm_token),
              INDEX idx_user_id (user_id),
              INDEX idx_fcm_token (fcm_token),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);

          // Insert or update token
          await conn.query(`
            INSERT INTO fcm_tokens (user_id, fcm_token, updated_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE
              fcm_token = VALUES(fcm_token),
              updated_at = NOW()
          `, [user.id, fcmToken]);

          Logger.info('fcm_token_registered_in_table', {
            user_id: user.id,
            phone: user.phone,
          });
        } else {
          throw updateError;
        }
      }

      return NextResponse.json({
        ok: true,
        message: 'FCM token registered successfully',
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('register_fcm_token_error', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to register FCM token' },
      { status: 500 }
    );
  }
}

