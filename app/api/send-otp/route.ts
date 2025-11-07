import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { sendSMS, getOTPMessage } from '@/lib/sms';
import { Logger } from '@/lib/logger';
import { CONFIG } from '@/lib/config';
import { validatePhone, validateRequest } from '@/lib/validation';

/**
 * @swagger
 * /api/send-otp:
 *   post:
 *     summary: Send OTP to phone number
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: 10-digit phone number
 *                 example: "9876543210"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 otp_id:
 *                   type: number
 *                 sms:
 *                   type: object
 *       422:
 *         description: Invalid phone number
 *       500:
 *         description: Server error
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headerSource = request.headers.get('x-source')?.toString().toLowerCase() ?? '';
    const headerRole = request.headers.get('x-role')?.toString().toLowerCase() ?? '';

    const source = (body.source || headerSource || '').toString().toLowerCase();
    const role = (body.role || headerRole || '').toString().toLowerCase();
    const phone = (body.phone || '').replace(/\D/g, '');

    Logger.info('hit_send_otp', { raw: JSON.stringify(body), req: body });

    const validation = validateRequest(
      { ...body, source, role },
      {
        phone: (p) => validatePhone(p || ''),
        source: (s) => {
          const val = (s || '').toString().toLowerCase();
          if (!val) return true;
          return ['web', 'mobile'].includes(val);
        },
        role: (r) => {
          const val = (r || '').toString().toLowerCase();
          if (!val) return true;
          return ['admin', 'supervisor', 'field_officer'].includes(val);
        },
      }
    );

    if (!validation.valid) {
      const message = validation.errors.join(', ') || 'अवैध विनंती';
      return NextResponse.json(
        { ok: false, error: message },
        { status: 422 }
      );
    }

    // Determine allowed user types based on source
    const isWebRequest = source === 'web';

    if (isWebRequest && role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'forbidden_role' },
        { status: 403 }
      );
    }

    if (!isWebRequest && role && !['field_officer', 'supervisor'].includes(role)) {
      return NextResponse.json(
        { ok: false, error: 'forbidden_role' },
        { status: 403 }
      );
    }

    // Check if user exists by contact_number; block if not
    const pool = await import('@/lib/db').then(m => m.getDbPool());
    const existConn = await pool.getConnection();
    try {
      const [users] = await existConn.execute(
        `SELECT u.id, u.user_type, ut.user_type AS related_type
         FROM users u
         LEFT JOIN user_types ut ON ut.id = u.user_type_id
         WHERE u.contact_number = ?
           AND (u.status = 'active' OR u.is_active = 1)
           AND (
             CASE
               WHEN ? = 1 THEN (
                 u.user_type IN ('admin', 'supervisor')
                 OR ut.user_type IN ('Admin', 'Supervisor')
               )
               ELSE (
                 u.user_type = 'field_officer'
                 OR ut.user_type = 'Field officer'
               )
             END
           )
         LIMIT 1`,
        [phone, isWebRequest ? 1 : 0]
      );
      const userExists = Array.isArray(users) && (users as any[]).length > 0;
      if (!userExists) {
        return NextResponse.json(
          { ok: false, error: 'user_not_found' },
          { status: 404 }
        );
      }
    } finally {
      existConn.release();
    }

    // Generate OTP: 6-digit number (100000 to 999999)
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    
    // Validate OTP is clean (only digits, exactly 6 digits)
    if (!/^\d{6}$/.test(otp)) {
      Logger.error('send_otp_invalid_otp', { otp, phone });
      return NextResponse.json(
        { ok: false, error: 'Failed to generate valid OTP' },
        { status: 500 }
      );
    }
    
    Logger.info('send_otp_generated', { otp, phone, otpLength: otp.length });
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + CONFIG.OTP_EXPIRY_MINUTES);

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Ensure otp_verifications table exists
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS otp_verifications (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          phone VARCHAR(20) NOT NULL,
          otp VARCHAR(10) NOT NULL,
          status ENUM('sent','verified','expired') DEFAULT 'sent',
          expires_at TIMESTAMP NULL,
          verified_at TIMESTAMP NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_phone (phone),
          KEY idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      const [result] = await connection.execute(
        `INSERT INTO otp_verifications (phone, otp, expires_at, status, created_at, updated_at) 
         VALUES (?, ?, ?, 'sent', NOW(), NOW())`,
        [phone, otp, expiresAt]
      );
      
      const otpId = (result as any).insertId;
      await connection.commit();

      // Ensure OTP is a clean string before passing to getOTPMessage
      const cleanOtp = otp.trim();
      if (!cleanOtp || cleanOtp.length !== 6) {
        Logger.error('send_otp_clean_otp_failed', { otp, cleanOtp, phone });
        return NextResponse.json(
          { ok: false, error: 'Invalid OTP format' },
          { status: 500 }
        );
      }
      
      // Get message with OTP replaced
      let message: string;
      try {
        message = getOTPMessage(cleanOtp);
        Logger.info('send_otp_message_generated', { phone, otp: cleanOtp, messageLength: message.length });
      } catch (msgError: any) {
        Logger.error('send_otp_message_failed', { error: msgError.message, otp: cleanOtp, phone });
        return NextResponse.json(
          { ok: false, error: `Failed to generate SMS message: ${msgError.message}` },
          { status: 500 }
        );
      }
      
      // Send SMS
      const sms = await sendSMS(phone, message);
      
      Logger.info('send_otp', { phone, otp_id: otpId, otp: cleanOtp, messageLength: message.length, resp: sms });

      return NextResponse.json({ ok: true, otp_id: otpId, sms });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    Logger.error('send_otp_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

