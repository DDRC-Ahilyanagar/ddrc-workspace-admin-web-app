import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbQueryOne, getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { validatePhone, validateOTP, validateRequest } from '@/lib/validation';

const normalizeRole = (value?: string | null) =>
  (value || '').toString().trim().toLowerCase().replace(/\s+/g, '_');

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
    const role = normalizeRole(body.role || headerRole);
    const phone = (body.phone || '').replace(/\D/g, '');
    const otp = (body.otp || '').replace(/\D/g, '');
    const name = (body.name || '').trim();
    // Check if this is for survey verification (no user authentication required)
    const isSurveyVerification = body.survey_verification === true || body.survey_verification === 'true';

    Logger.info('hit_verify_otp', { raw: JSON.stringify(body), req: body, isSurveyVerification });

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
          const v = normalizeRole(r);
          if (!v) return true;
          return ['admin', 'supervisor', 'field_officer', 'therapy_specialist'].includes(v);
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

      // Test mode for Google Play review: Allow test phone + OTP combination
      const TEST_PHONE = '1234567890';
      const TEST_OTP = '123456';
      const isTestMode = phone === TEST_PHONE && otp === TEST_OTP;

      // Find latest unexpired sent OTP (skip for test mode)
      let row: any = null;
      if (!isTestMode) {
        const [rows] = await connection.execute(
          `SELECT * FROM otp_verifications 
           WHERE phone = ? AND status IN ('sent') 
           ORDER BY id DESC LIMIT 1`,
          [phone]
        );

        row = Array.isArray(rows) && rows.length > 0 ? rows[0] as any : null;

        if (!row) {
          // No matching OTP in the DB – treat it as a stale request
          return NextResponse.json(
            {
              ok: false,
              error: 'otp_not_found',
              message: 'ओटीपी सापडला नाही. कृपया पुन्हा विनंती करा.',
            },
            { status: 404 }
          );
        }
      }

      if (isTestMode) {
        // For test mode, skip OTP validation and expiration checks
        Logger.info('verify_otp_test_mode', { phone, otp });
      } else {
        // Normal OTP validation flow
        if (new Date(row.expires_at) < new Date()) {
          await connection.execute(
            `UPDATE otp_verifications SET status = 'expired', updated_at = NOW() WHERE id = ?`,
            [row.id]
          );
          return NextResponse.json(
            {
              ok: false,
              error: 'otp_expired',
              message: 'ओटीपीची वेळ संपली. कृपया नव्याने ओटीपी मागवा.',
            },
            { status: 410 }
          );
        }

        if (row.otp !== otp) {
          return NextResponse.json(
            {
              ok: false,
              error: 'otp_invalid',
              message: 'ओटीपी अयोग्य आहे. पुन्हा प्रयत्न करा.',
            },
            { status: 401 }
          );
        }
      }

      // Mark verified (skip for test mode if no row exists)
      if (!isTestMode || row) {
        await connection.execute(
          `UPDATE otp_verifications 
           SET status = 'verified', verified_at = NOW(), updated_at = NOW() 
           WHERE id = ?`,
          [row.id]
        );
      }

      // For survey verification: Just return success, no user authentication needed
      if (isSurveyVerification) {
        Logger.info('verify_otp_survey_verification_ok', { phone });
        return NextResponse.json({ 
          ok: true, 
          message: 'OTP verified successfully'
        });
      }

      // Require existing user with active status and role based on source
      const isWebRequest = source === 'web';

      // First, get the user's actual role from the database so that mobile/web
      // clients cannot spoof their role via request payloads.
      const [userCheck] = await connection.execute(
        `SELECT u.id, u.name, u.contact_number, u.passkey, u.user_type, u.status, u.is_active, ut.user_type AS related_type
         FROM users u
         LEFT JOIN user_types ut ON ut.id = u.user_type_id
         WHERE u.contact_number = ?
           AND (COALESCE(u.status, '') = 'active' OR COALESCE(u.is_active, 0) = 1)
         LIMIT 1`,
        [phone]
      );
      
      const userData = Array.isArray(userCheck) && (userCheck as any[]).length > 0 ? (userCheck as any[])[0] : null;
      
      // For test mode, create a dummy user data if not found
      let finalUserData = userData;
      if (!userData && isTestMode) {
        Logger.info('verify_otp_test_mode_user_not_found', { phone });
        // Create a test user object for test mode
        finalUserData = {
          id: 999999,
          name: 'Test User',
          contact_number: TEST_PHONE,
          passkey: null,
          user_type: 'field_officer',
          status: 'active',
          is_active: 1,
          related_type: 'field_officer'
        };
      } else if (!userData) {
        return NextResponse.json(
          {
            ok: false,
            error: 'user_not_found',
            message: 'वापरकर्ता नोंदणीकृत नाही. कृपया प्रवेश विनंती पाठवा.',
          },
          { status: 404 }
        );
      }

      // Check user's actual role from database
      const userType = normalizeRole(finalUserData.user_type);
      const relatedType = normalizeRole(finalUserData.related_type);
      const effectiveRole = userType || relatedType;
      const isAdmin = effectiveRole === 'admin';
      const isSupervisor = effectiveRole === 'supervisor';
      const isFieldOfficer = effectiveRole === 'field_officer';

      // For web requests, only allow admin/supervisor users
      if (isWebRequest && !isAdmin && !isSupervisor) {
        return NextResponse.json(
          {
            ok: false,
            error: 'forbidden_role',
            message: 'या भूमिकेला वेब प्रवेश नाही.',
          },
          { status: 403 }
        );
      }

      // For mobile requests, allow field_officer/supervisor/admin/therapy_specialist users
      const isTherapySpecialist =
        effectiveRole === 'therapy_specialist' ||
        effectiveRole === 'practitioner';

      if (
        !isWebRequest &&
        role &&
        !isFieldOfficer &&
        !isSupervisor &&
        !isAdmin &&
        !isTherapySpecialist
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: 'forbidden_role',
            message: 'या भूमिकेला मोबाइल प्रवेश नाही.',
          },
          { status: 403 }
        );
      }

      if (!isWebRequest && role && effectiveRole && role !== effectiveRole) {
        return NextResponse.json(
          {
            ok: false,
            error: 'forbidden_role',
            message: 'निवडलेली भूमिका आणि वापरकर्त्याची वास्तविक भूमिका जुळत नाही.',
          },
          { status: 403 }
        );
      }

      Logger.info('verify_otp_ok', { phone, user_id: finalUserData.id, has_passkey: !!finalUserData.passkey, isTestMode });
      const response = NextResponse.json({ 
        ok: true, 
        user: {
          id: finalUserData.id,
          name: finalUserData.name,
          phone: finalUserData.contact_number,
          passkey: finalUserData.passkey ? String(finalUserData.passkey) : null,
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

