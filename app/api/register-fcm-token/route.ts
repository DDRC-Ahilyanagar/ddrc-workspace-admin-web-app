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

      // Check if users table has fcm_token column
      // First, ensure this token is NOT associated with any other user
      // This prevents "shared device" issues where one device gets notifications for multiple users

      // 1. Try to clear from other users in 'users' table
      try {
        await conn.query(
          `UPDATE users SET fcm_token = NULL WHERE fcm_token = ? AND id != ?`,
          [fcmToken, user.id]
        );
      } catch (e: any) {
        // Ignore if column doesn't exist
      }

      // 2. Try to update 'users' table for current user
      let updatedUsersTable = false;
      try {
        await conn.query(
          `UPDATE users SET fcm_token = ? WHERE id = ?`,
          [fcmToken, user.id]
        );
        updatedUsersTable = true;
        Logger.info('fcm_token_registered', {
          user_id: user.id,
          phone: user.phone,
          location: 'users_table'
        });
      } catch (updateError: any) {
        // If column doesn't exist, we'll use fcm_tokens table
        if (updateError.code !== 'ER_BAD_FIELD_ERROR') {
          throw updateError;
        }
      }

      // 3. Always manage fcm_tokens table (if it exists or needs to be created)
      // This is the more reliable storage especially if we want multiple tokens per user support later
      // (though currently we enforce 1 token -> 1 user to solve the reported issue)

      try {
        // Check/Create fcm_tokens table logic (simplified from original for clarity but keeping robustness)
        // ... (reuse existing table check/create logic if needed efficiently, or just try INSERT)

        // Ensure table exists (idempotent check)
        // We'll trust the existing catch block logic for table creation if insert fails, 
        // but for now let's just assume it exists or the original error handler deals with it.
        // Actually, to be safe and clean, let's keep the creation logic but optimize the flow.

        // First DELETE this token from fcm_tokens for ANY user (including current, to clean up old duplicates)
        await conn.query(
          `DELETE FROM fcm_tokens WHERE fcm_token = ?`,
          [fcmToken]
        );

        // Now Insert for current user
        // We need to handle the table creation if DELETE/INSERT fails due to missing table
        try {
          await conn.query(`
            INSERT INTO fcm_tokens (user_id, fcm_token, updated_at)
            VALUES (?, ?, NOW())
          `, [user.id, fcmToken]);

          Logger.info('fcm_token_registered_in_table', {
            user_id: user.id,
            phone: user.phone,
          });
        } catch (insertError: any) {
          if (insertError.code === 'ER_NO_SUCH_TABLE') {
            // Create table logic (copied from original)
            await conn.query(`
                CREATE TABLE IF NOT EXISTS fcm_tokens (
                  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                  user_id BIGINT UNSIGNED NOT NULL,
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

            // Retry Insert
            await conn.query(`
                INSERT INTO fcm_tokens (user_id, fcm_token, updated_at)
                VALUES (?, ?, NOW())
              `, [user.id, fcmToken]);

            Logger.info('fcm_token_registered_in_new_table', {
              user_id: user.id
            });
          } else {
            throw insertError;
          }
        }

      } catch (fcmTableError: any) {
        // If users table update succeeded, we can technically ignore fcm_tokens error if strict consistency isn't required,
        // but it's better to log it. 
        // If users table update FAILED (missing column) AND this failed, then it's a real error.
        if (!updatedUsersTable) {
          throw fcmTableError;
        }
        Logger.warn('fcm_tokens_table_update_failed', { error: fcmTableError.message });
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

