import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbQueryOne, getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { validatePhone, validateOTP, validateRequest } from '@/lib/validation';

/**
 * @swagger
 * /api/verify-otp:
 *   post:
 *     summary: Verify OTP and login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *               - name
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       401:
 *         description: Invalid OTP
 *       404:
 *         description: OTP not found
 *       410:
 *         description: OTP expired
 *       422:
 *         description: Invalid input
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headerSource = request.headers.get('x-source')?.toString().toLowerCase() ?? '';
    const headerRole = request.headers.get('x-role')?.toString().toLowerCase() ?? '';

    const source = (body.source || headerSource || '').toString().toLowerCase();
    const role = (body.role || headerRole || '').toString().toLowerCase();
    const phone = (body.phone || '').replace(/\D/g, '');
    const otp = (body.otp || '').replace(/\D/g, '');
    const name = (body.name || '').trim();

    Logger.info('hit_verify_otp', { raw: JSON.stringify(body), req: body });

    const validation = validateRequest(
      { ...body, source, role },
      {
        phone: (p) => validatePhone(p || ''),
        otp: (o) => validateOTP(o || ''),
        source: (s) => {
          const v = (s || '').toString().toLowerCase();
          if (!v) return true;
          return ['web', 'mobile'].includes(v);
        },
        role: (r) => {
          const v = (r || '').toString().toLowerCase();
          if (!v) return true;
          return ['admin', 'supervisor', 'field_officer'].includes(v);
        },
      }
    );

    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, error: validation.errors.join(', ') || 'Invalid input' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    const connection = await pool.getConnection();

    try {
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

      // Find latest unexpired sent OTP
      const [rows] = await connection.execute(
        `SELECT * FROM otp_verifications 
         WHERE phone = ? AND status IN ('sent') 
         ORDER BY id DESC LIMIT 1`,
        [phone]
      );

      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] as any : null;

      if (!row) {
        return NextResponse.json(
          { ok: false, error: 'OTP not found' },
          { status: 404 }
        );
      }

      if (new Date(row.expires_at) < new Date()) {
        await connection.execute(
          `UPDATE otp_verifications SET status = 'expired', updated_at = NOW() WHERE id = ?`,
          [row.id]
        );
        return NextResponse.json(
          { ok: false, error: 'OTP expired' },
          { status: 410 }
        );
      }

      if (row.otp !== otp) {
        return NextResponse.json(
          { ok: false, error: 'Invalid OTP' },
          { status: 401 }
        );
      }

      // Mark verified
      await connection.execute(
        `UPDATE otp_verifications 
         SET status = 'verified', verified_at = NOW(), updated_at = NOW() 
         WHERE id = ?`,
        [row.id]
      );

      // Require existing user with active status and role based on source
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
      const [users] = await connection.execute(
        `SELECT u.id, u.name, u.contact_number, u.passkey
         FROM users u
         LEFT JOIN user_types ut ON ut.id = u.user_type_id
         WHERE u.contact_number = ?
           AND (u.status = 'active' OR u.is_active = 1)
          AND (
            CASE
              WHEN ? = 1 THEN (
                u.user_type IN ('admin','supervisor')
                OR ut.user_type IN ('Admin','Supervisor')
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
      const user = Array.isArray(users) && (users as any[]).length > 0 ? (users as any[])[0] : null;
      if (!user) {
        return NextResponse.json(
          { ok: false, error: 'user_not_found' },
          { status: 404 }
        );
      }

      Logger.info('verify_otp_ok', { phone, user_id: user.id, has_passkey: !!user.passkey });
      const response = NextResponse.json({ 
        ok: true, 
        user: {
          id: user.id,
          name: user.name,
          phone: user.contact_number,
          passkey: user.passkey ? String(user.passkey) : null,
        }
      });

      const maxAge = 7 * 24 * 60 * 60; // 7 days
      response.cookies.set('session_token', phone, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge,
      });

      return response;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    Logger.error('verify_otp_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

