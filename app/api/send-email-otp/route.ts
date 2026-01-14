import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { sendEmailAndLog } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

/**
 * Send OTP to email
 * POST /api/send-email-otp
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { ok: false, error: 'Valid email is required' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    let conn;
    try {
      conn = await pool.getConnection();
    } catch (connError: any) {
      Logger.error('send_email_otp_db_connection_failed', { 
        error: connError.message,
        stack: connError.stack 
      });
      return NextResponse.json(
        { ok: false, error: 'Database connection failed. Please try again later.' },
        { status: 500 }
      );
    }

    try {
      // Create email_otp_verifications table if it doesn't exist
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS email_otp_verifications (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          email VARCHAR(255) NOT NULL,
          otp VARCHAR(10) NOT NULL,
          status ENUM('sent','verified','expired') DEFAULT 'sent',
          expires_at TIMESTAMP NULL,
          verified_at TIMESTAMP NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_email (email),
          KEY idx_email_status (email, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Check if this email belongs to a user with test field officer phone (7777777777)
      const TEST_FIELD_OFFICER_PHONE = '7777777777';
      const TEST_FIELD_OFFICER_OTP = '123456';
      
      const [userRows]: any = await conn.query(
        `SELECT contact_number FROM users WHERE email = ? LIMIT 1`,
        [email]
      );
      
      let isTestFieldOfficerEmail = false;
      if (Array.isArray(userRows) && userRows.length > 0) {
        const userPhone = (userRows[0].contact_number || '').replace(/\D/g, '');
        isTestFieldOfficerEmail = userPhone === TEST_FIELD_OFFICER_PHONE;
      }
      
      // Generate 6-digit OTP - use 123456 for test field officer, random for others
      const otp = isTestFieldOfficerEmail ? TEST_FIELD_OFFICER_OTP : Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

      // Mark old OTPs as expired
      await conn.execute(
        `UPDATE email_otp_verifications 
         SET status = 'expired' 
         WHERE email = ? AND status = 'sent'`,
        [email]
      );

      // Insert new OTP
      await conn.execute(
        `INSERT INTO email_otp_verifications (email, otp, expires_at, status)
         VALUES (?, ?, ?, 'sent')`,
        [email, otp, expiresAt]
      );

      // Send email
      const emailSubject = 'DDRC Survey System - Email Verification OTP';
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976D2;">Email Verification</h2>
          <p>Your OTP for email verification is:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #1976D2; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP is valid for 10 minutes.</p>
          <p>If you did not request this OTP, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">DDRC Survey System</p>
        </div>
      `;

      const emailResult = await sendEmailAndLog({
        recipientType: 'field_officer',
        recipientEmail: email,
        emailSubject,
        emailBody,
      });

      if (!emailResult.success) {
        Logger.error('send_email_otp_failed', {
          email,
          error: emailResult.error,
        });
        return NextResponse.json(
          { ok: false, error: emailResult.error || 'Failed to send email OTP' },
          { status: 500 }
        );
      }

      Logger.info('send_email_otp_success', { email });

      return NextResponse.json({
        ok: true,
        message: 'OTP sent to email successfully',
      });
    } finally {
      if (conn) {
        conn.release();
      }
    }
  } catch (error: any) {
    Logger.error('send_email_otp_error', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to send email OTP' },
      { status: 500 }
    );
  }
}





