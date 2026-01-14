import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Verify email OTP
 * POST /api/verify-email-otp
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    const otp = (body.otp || '').replace(/\D/g, '');

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { ok: false, error: 'Valid email is required' },
        { status: 422 }
      );
    }

    if (!otp || otp.length !== 6) {
      return NextResponse.json(
        { ok: false, error: '6-digit OTP is required' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Test Field Officer phone number - if user has this phone, accept OTP 123456
      const TEST_FIELD_OFFICER_PHONE = '7777777777';
      const TEST_FIELD_OFFICER_OTP = '123456';
      
      // Check if this email belongs to a user with test field officer phone
      let isTestFieldOfficerEmail = false;
      if (otp === TEST_FIELD_OFFICER_OTP) {
        const [userRows]: any = await conn.query(
          `SELECT contact_number FROM users WHERE email = ? LIMIT 1`,
          [email]
        );
        if (Array.isArray(userRows) && userRows.length > 0) {
          const userPhone = (userRows[0].contact_number || '').replace(/\D/g, '');
          isTestFieldOfficerEmail = userPhone === TEST_FIELD_OFFICER_PHONE;
        }
      }
      
      // Find valid OTP
      const [rows]: any = await conn.query(
        `SELECT id, expires_at, status 
         FROM email_otp_verifications 
         WHERE email = ? AND otp = ? AND status = 'sent'
         ORDER BY created_at DESC 
         LIMIT 1`,
        [email, otp]
      );

      // For test field officer, accept OTP 123456 even if not in database
      if (isTestFieldOfficerEmail && otp === TEST_FIELD_OFFICER_OTP) {
        // Try to find and mark existing OTP as verified if it exists
        const [existingRows]: any = await conn.query(
          `SELECT id FROM email_otp_verifications 
           WHERE email = ? AND status = 'sent'
           ORDER BY created_at DESC 
           LIMIT 1`,
          [email]
        );
        
        if (Array.isArray(existingRows) && existingRows.length > 0) {
          await conn.execute(
            `UPDATE email_otp_verifications 
             SET status = 'verified', verified_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [existingRows[0].id]
          );
        }
        
        Logger.info('verify_email_otp_test_field_officer', { email, otp });
        return NextResponse.json({
          ok: true,
          message: 'Email verified successfully',
        });
      }

      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Invalid OTP' },
          { status: 401 }
        );
      }

      const otpRecord = rows[0];

      // Check if expired
      const expiresAt = new Date(otpRecord.expires_at);
      if (expiresAt < new Date()) {
        await conn.execute(
          `UPDATE email_otp_verifications SET status = 'expired' WHERE id = ?`,
          [otpRecord.id]
        );
        return NextResponse.json(
          { ok: false, error: 'OTP has expired' },
          { status: 410 }
        );
      }

      // Mark as verified
      await conn.execute(
        `UPDATE email_otp_verifications 
         SET status = 'verified', verified_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [otpRecord.id]
      );

      Logger.info('verify_email_otp_success', { email });

      return NextResponse.json({
        ok: true,
        message: 'Email verified successfully',
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('verify_email_otp_error', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to verify email OTP' },
      { status: 500 }
    );
  }
}





