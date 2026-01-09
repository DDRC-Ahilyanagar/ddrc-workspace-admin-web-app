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
      // Find valid OTP
      const [rows]: any = await conn.query(
        `SELECT id, expires_at, status 
         FROM email_otp_verifications 
         WHERE email = ? AND otp = ? AND status = 'sent'
         ORDER BY created_at DESC 
         LIMIT 1`,
        [email, otp]
      );

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





