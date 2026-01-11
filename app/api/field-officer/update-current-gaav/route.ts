import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Update current gaav (village) where field officer is conducting survey
 * POST /api/field-officer/update-current-gaav
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await verifyAuth(request);
    if (!user || error) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { current_gaav, taluka } = body;

    Logger.info('field_officer_update_current_gaav_request_received', {
      body: body,
      current_gaav: current_gaav,
      taluka: taluka,
      current_gaav_type: typeof current_gaav,
      current_gaav_length: current_gaav ? String(current_gaav).length : 0,
      user_id_from_auth: user.id,
      user_id_from_body: body.user_id
    });

    if (!current_gaav || typeof current_gaav !== 'string' || current_gaav.trim() === '') {
      Logger.warn('field_officer_update_current_gaav_validation_failed', {
        current_gaav: current_gaav,
        current_gaav_type: typeof current_gaav,
        error: 'current_gaav is required and must be a non-empty string'
      });
      return NextResponse.json(
        { ok: false, error: 'current_gaav is required' },
        { status: 422 }
      );
    }

    const userId = user.id || body.user_id;
    if (!userId) {
      Logger.warn('field_officer_update_current_gaav_no_user_id', {
        user_id_from_auth: user.id,
        user_id_from_body: body.user_id
      });
      return NextResponse.json(
        { ok: false, error: 'User ID is required' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Ensure table exists with current_gaav column
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS field_officer_profiles (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NOT NULL,
          profile_photo TEXT DEFAULT NULL,
          taluka VARCHAR(255) DEFAULT NULL,
          primary_gaav VARCHAR(255) DEFAULT NULL,
          additional_gaavs JSON DEFAULT NULL,
          current_gaav VARCHAR(255) DEFAULT NULL,
          account_holder_name VARCHAR(255) DEFAULT NULL,
          account_number VARCHAR(50) DEFAULT NULL,
          bank_name VARCHAR(255) DEFAULT NULL,
          ifsc_code VARCHAR(20) DEFAULT NULL,
          upi_id VARCHAR(255) DEFAULT NULL,
          qr_code TEXT DEFAULT NULL,
          profile_complete TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY unique_user_id (user_id),
          KEY idx_user_id (user_id),
          KEY idx_current_gaav (current_gaav),
          CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Add current_gaav column if it doesn't exist
      try {
        await conn.execute(`
          ALTER TABLE field_officer_profiles 
          ADD COLUMN current_gaav VARCHAR(255) DEFAULT NULL,
          ADD INDEX idx_current_gaav (current_gaav)
        `);
      } catch (e: any) {
        // Ignore if column already exists
        if (!e.message?.includes('Duplicate column name') && !e.message?.includes('Duplicate key name')) {
          Logger.info('update_current_gaav_add_column_failed', { error: e.message });
        }
      }

      // Check if profile exists
      const [existing]: any = await conn.query(
        'SELECT id FROM field_officer_profiles WHERE user_id = ?',
        [userId]
      );

      if (Array.isArray(existing) && existing.length > 0) {
        // Update existing profile
        Logger.info('field_officer_update_current_gaav_updating_existing', {
          user_id: userId,
          existing_profile_id: existing[0].id,
          current_gaav_before: null, // We'll check after
          current_gaav_after: current_gaav.trim(),
          taluka: taluka || null
        });
        
        await conn.execute(
          `UPDATE field_officer_profiles 
           SET current_gaav = ?,
               taluka = COALESCE(?, taluka),
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?`,
          [current_gaav.trim(), taluka || null, userId]
        );
        
        Logger.info('field_officer_update_current_gaav_update_executed', {
          user_id: userId,
          sql_executed: 'UPDATE field_officer_profiles SET current_gaav = ?, taluka = COALESCE(?, taluka) WHERE user_id = ?',
          values: [current_gaav.trim(), taluka || null, userId]
        });
      } else {
        // Create profile with current_gaav
        Logger.info('field_officer_update_current_gaav_creating_new', {
          user_id: userId,
          current_gaav: current_gaav.trim(),
          taluka: taluka || null
        });
        
        await conn.execute(
          `INSERT INTO field_officer_profiles (user_id, current_gaav, taluka, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
          [userId, current_gaav.trim(), taluka || null]
        );
        
        Logger.info('field_officer_update_current_gaav_insert_executed', {
          user_id: userId,
          sql_executed: 'INSERT INTO field_officer_profiles (user_id, current_gaav, taluka) VALUES (?, ?, ?)',
          values: [userId, current_gaav.trim(), taluka || null]
        });
      }

      // Verify the update was successful
      const [verify]: any = await conn.query(
        'SELECT current_gaav, taluka FROM field_officer_profiles WHERE user_id = ?',
        [userId]
      );
      
      Logger.info('field_officer_current_gaav_updated', {
        user_id: userId,
        current_gaav: current_gaav,
        taluka: taluka,
        verified_current_gaav: Array.isArray(verify) && verify.length > 0 ? verify[0].current_gaav : null,
        verified_taluka: Array.isArray(verify) && verify.length > 0 ? verify[0].taluka : null
      });

      return NextResponse.json({
        ok: true,
        message: 'Current gaav updated successfully',
        current_gaav: current_gaav.trim()
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('field_officer_update_current_gaav_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to update current gaav' },
      { status: 500 }
    );
  }
}
