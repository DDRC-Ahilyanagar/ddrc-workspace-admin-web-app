import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbQueryOne, getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { validatePhone, validateOTP, validateRequest } from '@/lib/validation';
import { logSignupStep } from '@/lib/signup-logger';

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
          return ['admin', 'supervisor', 'field_officer', 'therapy_specialist', 'verification_officer'].includes(v);
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
      
      // Bypass OTP for System Admin (9999999999)
      const ADMIN_BYPASS_PHONE = '9999999999';
      const isAdminBypass = phone === ADMIN_BYPASS_PHONE;
      
      // Bypass OTP for Verification Officer (8888888888)
      const VERIFICATION_OFFICER_BYPASS_PHONE = '8888888888';
      const isVerificationOfficerBypass = phone === VERIFICATION_OFFICER_BYPASS_PHONE;
      
      // Test Field Officer (7777777777) - accept any OTP if it matches the one in database
      const TEST_FIELD_OFFICER_PHONE = '7777777777';
      const isTestFieldOfficer = phone === TEST_FIELD_OFFICER_PHONE;

      // Find latest unexpired sent OTP (skip for test mode, admin bypass, verification officer bypass, and test field officer)
      let row: any = null;
      if (!isTestMode && !isAdminBypass && !isVerificationOfficerBypass && !isTestFieldOfficer) {
        // First, mark expired OTPs as expired
        await connection.execute(
          `UPDATE otp_verifications 
           SET status = 'expired', updated_at = NOW() 
           WHERE phone = ? AND status = 'sent' AND expires_at < NOW()`,
          [phone]
        );

        // Then find the latest non-expired sent OTP
        const [rows] = await connection.execute(
          `SELECT * FROM otp_verifications 
           WHERE phone = ? AND status IN ('sent') AND expires_at >= NOW()
           ORDER BY id DESC LIMIT 1`,
          [phone]
        );

        row = Array.isArray(rows) && rows.length > 0 ? rows[0] as any : null;

        if (!row) {
          // No matching OTP in the DB – treat it as a stale request
          Logger.info('verify_otp_not_found_or_expired', { phone });
          return NextResponse.json(
            {
              ok: false,
              error: 'otp_not_found',
              message: 'ओटीपी सापडला नाही किंवा वेळ संपली. कृपया नव्याने ओटीपी मागवा.',
            },
            { status: 404 }
          );
        }
      }

      // For test field officer, find the OTP in database and verify it
      if (isTestFieldOfficer) {
        const [otpRows] = await connection.execute(
          `SELECT * FROM otp_verifications 
           WHERE phone = ? AND status IN ('sent') 
           ORDER BY id DESC LIMIT 1`,
          [phone]
        );
        const otpRow = Array.isArray(otpRows) && otpRows.length > 0 ? otpRows[0] as any : null;
        
        if (!otpRow) {
          return NextResponse.json(
            {
              ok: false,
              error: 'otp_not_found',
              message: 'ओटीपी सापडला नाही. कृपया पुन्हा विनंती करा.',
            },
            { status: 404 }
          );
        }
        
        if (new Date(otpRow.expires_at) < new Date()) {
          await connection.execute(
            `UPDATE otp_verifications SET status = 'expired', updated_at = NOW() WHERE id = ?`,
            [otpRow.id]
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
        
        if (otpRow.otp !== otp) {
          return NextResponse.json(
            {
              ok: false,
              error: 'otp_invalid',
              message: 'ओटीपी अयोग्य आहे. पुन्हा प्रयत्न करा.',
            },
            { status: 401 }
          );
        }
        
        // Mark as verified
        await connection.execute(
          `UPDATE otp_verifications 
           SET status = 'verified', verified_at = NOW(), updated_at = NOW() 
           WHERE id = ?`,
          [otpRow.id]
        );
        
        row = otpRow; // Set row for later use
        Logger.info('verify_otp_test_field_officer', { phone, otp });
      } else if (isTestMode || isAdminBypass || isVerificationOfficerBypass) {
        // For test mode, admin bypass, and verification officer bypass, skip OTP validation and expiration checks
        if (isAdminBypass) {
          Logger.info('verify_otp_admin_bypass', { phone, otp });
        } else if (isVerificationOfficerBypass) {
          Logger.info('verify_otp_verification_officer_bypass', { phone, otp });
        } else {
          Logger.info('verify_otp_test_mode', { phone, otp });
        }
      } else {
        // Normal OTP validation flow
        // Double-check expiry (in case of race condition or timezone issues)
        const expiresAt = new Date(row.expires_at);
        const now = new Date();
        if (expiresAt < now) {
          await connection.execute(
            `UPDATE otp_verifications SET status = 'expired', updated_at = NOW() WHERE id = ?`,
            [row.id]
          );
          Logger.info('verify_otp_expired', { 
            phone, 
            otp_id: row.id, 
            expires_at: row.expires_at, 
            now: now.toISOString(),
            diff_minutes: Math.round((now.getTime() - expiresAt.getTime()) / 60000)
          });
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

      // Mark verified (skip for test mode, admin bypass, and verification officer bypass if no row exists)
      // Test field officer is already marked verified above
      if ((!isTestMode && !isAdminBypass && !isVerificationOfficerBypass && !isTestFieldOfficer) || (row && !isTestFieldOfficer)) {
        if (row) {
          await connection.execute(
            `UPDATE otp_verifications 
             SET status = 'verified', verified_at = NOW(), updated_at = NOW() 
             WHERE id = ?`,
            [row.id]
          );
        }
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
      // For mobile onboarding, also allow pending users and empty status
      const isMobileOnboarding = !isWebRequest && role === 'field_officer';
      const statusCondition = isMobileOnboarding 
        ? `(COALESCE(u.status, '') = 'active' OR COALESCE(u.is_active, 0) = 1 OR COALESCE(u.status, '') = 'pending' OR COALESCE(u.status, '') = '')`
        : `(COALESCE(u.status, '') = 'active' OR COALESCE(u.is_active, 0) = 1)`;
      
      const [userCheck] = await connection.execute(
        `SELECT u.id, u.name, u.contact_number, u.passkey, u.user_type, u.status, u.is_active, ut.user_type AS related_type
         FROM users u
         LEFT JOIN user_types ut ON ut.id = u.user_type_id
         WHERE u.contact_number = ?
           AND ${statusCondition}
         LIMIT 1`,
        [phone]
      );
      
      const userData = Array.isArray(userCheck) && (userCheck as any[]).length > 0 ? (userCheck as any[])[0] : null;
      
      // For test mode or admin bypass, create a dummy user data if not found
      let finalUserData = userData;
      if (!userData && (isTestMode || isAdminBypass)) {
        Logger.info('verify_otp_dummy_user_created', { phone, isTestMode, isAdminBypass });
        // Create a dummy user object for test mode or Play Store review
        finalUserData = {
          id: isAdminBypass ? 999999 : 999999,
          name: isAdminBypass ? 'Play Store Reviewer' : 'Test User',
          contact_number: isAdminBypass ? ADMIN_BYPASS_PHONE : TEST_PHONE,
          passkey: null,
          user_type: isAdminBypass ? 'field_officer' : 'field_officer',
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

      // For web requests, allow admin/supervisor/verification_officer users
      const isVerificationOfficer = effectiveRole === 'verification_officer';
      if (isWebRequest && !isAdmin && !isSupervisor && !isVerificationOfficer) {
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

      // Convert BigInt id to Number for JSON serialization
      const userId = Number(finalUserData.id);
      
      Logger.info('verify_otp_ok', { phone, user_id: userId, has_passkey: !!finalUserData.passkey, isTestMode, effectiveRole });
      const response = NextResponse.json({ 
        ok: true, 
        user: {
          id: userId, // Convert BigInt to Number for JSON compatibility
          name: finalUserData.name,
          phone: finalUserData.contact_number,
          passkey: finalUserData.passkey ? String(finalUserData.passkey) : null,
          user_type: effectiveRole, // Include user type in response
        }
      });

      // Log signup step: OTP verified (Step 3)
      if (isMobileOnboarding && role === 'field_officer') {
        await logSignupStep({
          phone,
          user_id: finalUserData.id,
          step: 'otp_verified',
          step_number: 3,
          status: 'completed',
          data: { user_type: effectiveRole },
        });
      }

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

