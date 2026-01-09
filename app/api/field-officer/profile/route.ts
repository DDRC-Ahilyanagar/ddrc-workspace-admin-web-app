import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Save or update field officer profile
 * POST /api/field-officer/profile
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      profile_photo,
      name,
      phone,
      email,
      taluka,
      primary_gaav,
      additional_gaavs,
      account_holder_name,
      account_number,
      bank_name,
      ifsc_code,
      upi_id,
      qr_code,
    } = body;

    // Validate user_id - must be a positive number
    const userIdNum = user_id ? Number(user_id) : 0;
    if (!user_id || userIdNum <= 0 || isNaN(userIdNum)) {
      Logger.error('field_officer_profile_missing_user_id', { 
        user_id, 
        userIdNum,
        body_keys: Object.keys(body)
      });
      return NextResponse.json(
        { ok: false, error: 'User ID is required and must be a valid positive number' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Create field_officer_profiles table if it doesn't exist
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS field_officer_profiles (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NOT NULL,
          profile_photo TEXT DEFAULT NULL,
          taluka VARCHAR(255) DEFAULT NULL,
          primary_gaav VARCHAR(255) DEFAULT NULL,
          additional_gaavs JSON DEFAULT NULL,
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
          CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Use validated user_id
      const validatedUserId = userIdNum;

      // Check if profile exists
      const [existing]: any = await conn.query(
        'SELECT id FROM field_officer_profiles WHERE user_id = ?',
        [validatedUserId]
      );

      // Validate phone number is not already taken by another active user
      if (phone) {
        const [phoneCheck]: any = await conn.query(
          `SELECT id, status, is_active 
           FROM users 
           WHERE contact_number = ? AND id != ? 
           LIMIT 1`,
          [phone, validatedUserId]
        );
        
        if (Array.isArray(phoneCheck) && phoneCheck.length > 0) {
          const phoneUser = phoneCheck[0];
          const phoneUserStatus = (phoneUser.status || '').toLowerCase().trim();
          const phoneUserIsActive = Number(phoneUser.is_active) === 1;
          
          if (phoneUserStatus === 'active' && phoneUserIsActive) {
            conn.release();
            Logger.info('field_officer_profile_phone_taken', { phone, user_id: validatedUserId, existing_user_id: phoneUser.id });
            return NextResponse.json(
              {
                ok: false,
                error: 'phone_already_exists',
                message: 'या मोबाईल क्रमांकासह आधीच खाते नोंदणीकृत आहे.',
              },
              { status: 409 }
            );
          }
        }
      }

      // Validate email is not already taken by another active user
      if (email && email.trim() !== '') {
        const [emailCheck]: any = await conn.query(
          `SELECT id, status, is_active, contact_number 
           FROM users 
           WHERE email = ? AND email IS NOT NULL AND email != '' AND id != ? 
           LIMIT 1`,
          [email.toLowerCase().trim(), validatedUserId]
        );
        
        if (Array.isArray(emailCheck) && emailCheck.length > 0) {
          const emailUser = emailCheck[0];
          const emailUserStatus = (emailUser.status || '').toLowerCase().trim();
          const emailUserIsActive = Number(emailUser.is_active) === 1;
          
          if (emailUserStatus === 'active' && emailUserIsActive) {
            conn.release();
            Logger.info('field_officer_profile_email_taken', { email, user_id: validatedUserId, existing_user_id: emailUser.id });
            return NextResponse.json(
              {
                ok: false,
                error: 'email_already_exists',
                message: 'या ईमेल आयडीसह आधीच खाते नोंदणीकृत आहे.',
              },
              { status: 409 }
            );
          }
        }
      }

      // Update users table
      const updateUsersFields: string[] = [];
      const updateUsersValues: any[] = [];

      if (name) {
        updateUsersFields.push('name = ?');
        updateUsersValues.push(name);
      }
      if (phone) {
        updateUsersFields.push('contact_number = ?');
        updateUsersValues.push(phone);
      }
      if (email !== undefined) {
        updateUsersFields.push('email = ?');
        updateUsersValues.push(email || null);
      }
      if (profile_photo) {
        updateUsersFields.push('profile_photo = ?');
        updateUsersValues.push(profile_photo);
      }

      if (updateUsersFields.length > 0) {
        updateUsersValues.push(validatedUserId);
        await conn.execute(
          `UPDATE users SET ${updateUsersFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          updateUsersValues
        );
      }

      // Check if profile is complete
      const isComplete = !!(
        profile_photo &&
        name &&
        phone &&
        taluka &&
        primary_gaav &&
        additional_gaavs &&
        Array.isArray(additional_gaavs) &&
        additional_gaavs.length === 3 &&
        account_holder_name &&
        account_number &&
        bank_name &&
        ifsc_code &&
        (upi_id || qr_code)
      );

      const additionalGaavsJson = additional_gaavs
        ? JSON.stringify(additional_gaavs)
        : null;

      if (Array.isArray(existing) && existing.length > 0) {
        // Update existing profile
        await conn.execute(
          `UPDATE field_officer_profiles SET
            profile_photo = ?,
            taluka = ?,
            primary_gaav = ?,
            additional_gaavs = ?,
            account_holder_name = ?,
            account_number = ?,
            bank_name = ?,
            ifsc_code = ?,
            upi_id = ?,
            qr_code = ?,
            profile_complete = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?`,
          [
            profile_photo || null,
            taluka || null,
            primary_gaav || null,
            additionalGaavsJson,
            account_holder_name || null,
            account_number || null,
            bank_name || null,
            ifsc_code || null,
            upi_id || null,
            qr_code || null,
            isComplete ? 1 : 0,
            validatedUserId,
          ]
        );
      } else {
        // Insert new profile
        await conn.execute(
          `INSERT INTO field_officer_profiles (
            user_id, profile_photo, taluka, primary_gaav, additional_gaavs,
            account_holder_name, account_number, bank_name, ifsc_code, upi_id, qr_code, profile_complete
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            validatedUserId,
            profile_photo || null,
            taluka || null,
            primary_gaav || null,
            additionalGaavsJson,
            account_holder_name || null,
            account_number || null,
            bank_name || null,
            ifsc_code || null,
            upi_id || null,
            qr_code || null,
            isComplete ? 1 : 0,
          ]
        );
      }

      Logger.info('field_officer_profile_saved', {
        user_id: validatedUserId,
        is_complete: isComplete,
      });

      return NextResponse.json({
        ok: true,
        message: 'Profile saved successfully',
        profile_complete: isComplete,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('field_officer_profile_save_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to save profile' },
      { status: 500 }
    );
  }
}

/**
 * Get field officer profile
 * GET /api/field-officer/profile?user_id=...
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'User ID is required' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      const [users]: any = await conn.query(
        `SELECT id, name, email, contact_number, profile_photo 
         FROM users WHERE id = ?`,
        [userId]
      );

      if (!Array.isArray(users) || users.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'User not found' },
          { status: 404 }
        );
      }

      const [profiles]: any = await conn.query(
        `SELECT taluka, primary_gaav, additional_gaavs,
                account_holder_name, account_number, bank_name, ifsc_code, upi_id, qr_code, profile_complete
         FROM field_officer_profiles WHERE user_id = ?`,
        [userId]
      );

      const user = users[0];
      const profile = Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;

      let additionalGaavs: string[] = [];
      if (profile?.additional_gaavs) {
        try {
          additionalGaavs = JSON.parse(profile.additional_gaavs);
        } catch {
          additionalGaavs = [];
        }
      }

      return NextResponse.json({
        ok: true,
        profile: {
          user_id: user.id,
          name: user.name,
          email: user.email,
          phone: user.contact_number,
          profile_photo: user.profile_photo,
          taluka: profile?.taluka || null,
          primary_gaav: profile?.primary_gaav || null,
          additional_gaavs: additionalGaavs,
          account_holder_name: profile?.account_holder_name || null,
          account_number: profile?.account_number || null,
          bank_name: profile?.bank_name || null,
          ifsc_code: profile?.ifsc_code || null,
          upi_id: profile?.upi_id || null,
          qr_code: profile?.qr_code || null,
          profile_complete: profile?.profile_complete === 1,
        },
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('field_officer_profile_get_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to get profile' },
      { status: 500 }
    );
  }
}

