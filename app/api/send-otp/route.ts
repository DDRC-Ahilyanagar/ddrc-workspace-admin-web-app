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
// Set route timeout to 60 seconds to match database acquireTimeout
export const maxDuration = 60;

const normalizeRole = (value?: string | null) =>
  (value || '').toString().trim().toLowerCase().replace(/\s+/g, '_');

// NOTE: This handler is intentionally verbose because mobile and web apps share
//       the same endpoint. The additional guards make sure the selected role
//       from the client matches the server-side records and keeps RBAC strict.
export async function POST(request: NextRequest) {
  try {
    // Parse the body first; mobile clients send extra metadata (role/source)
    // that we use later in the RBAC checks.
    const body = await request.json();
    const headerSource = request.headers.get('x-source')?.toString().toLowerCase() ?? '';
    const headerRole = request.headers.get('x-role')?.toString().toLowerCase() ?? '';

    const source = (body.source || headerSource || '').toString().toLowerCase();
    const role = normalizeRole(body.role || headerRole);
    const phone = (body.phone || '').replace(/\D/g, '');
    // Check if this is for survey verification (no user approval required)
    const isSurveyVerification = body.survey_verification === true || body.survey_verification === 'true';

    Logger.info('hit_send_otp', { raw: JSON.stringify(body), req: body, isSurveyVerification });

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
          const val = normalizeRole(r);
          if (!val) return true;
          return ['admin', 'supervisor', 'field_officer', 'therapy_specialist', 'verification_officer'].includes(val);
        }, // Allow therapy_specialist and verification_officer roles
      }
    );

    if (!validation.valid) {
      const message = validation.errors.join(', ') || 'अवैध विनंती';
      return NextResponse.json(
        { ok: false, error: message },
        { status: 422 }
      );
    }

    // ============================================================================
    // For survey verification: Skip user approval check, just verify phone number
    // For login/authentication: Require user to exist and be approved
    // ============================================================================
    let pool;
    try {
      const dbModule = await import('@/lib/db');
      pool = dbModule.getDbPool();
    } catch (dbError: any) {
      Logger.error('send_otp_db_import_failed', { error: dbError.message, stack: dbError.stack });
      return NextResponse.json(
        { ok: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }
    
    let userData: any = null;
    let effectiveRole: string = '';

    if (!isSurveyVerification) {
      // ============================================================================
      // CRITICAL: Approval check MUST happen BEFORE any OTP generation or SMS sending
      // This prevents wasting OTPs and SMS costs on unapproved users
      // ============================================================================
      let existConn;
      try {
        // Add timeout wrapper to fail fast if connection takes too long
        existConn = await Promise.race([
          pool.getConnection(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database connection timeout')), 25000)
          )
        ]) as any;
      } catch (connError: any) {
        Logger.error('send_otp_db_connection_failed', { error: connError.message, phone });
        return NextResponse.json(
          { ok: false, error: connError.message?.includes('timeout') 
            ? 'Database connection timeout. Please try again.' 
            : 'Database connection failed. Please try again.' },
          { status: 500 }
        );
      }
      
      try {
        // Fetch user once so we can show precise error messages
        const [userCheck] = await existConn.execute(
          `SELECT 
             u.id, 
             u.user_type, 
             u.status, 
             u.is_active, 
             ut.user_type AS related_type
           FROM users u
           LEFT JOIN user_types ut ON ut.id = u.user_type_id
           WHERE u.contact_number = ?
           LIMIT 1`,
          [phone]
        );

        if (!Array.isArray(userCheck) || (userCheck as any[]).length === 0) {
          Logger.info('send_otp_rejected_user_not_found', { phone });
          return NextResponse.json(
            {
              ok: false,
              error: 'user_not_found',
              message: 'वापरकर्ता नोंदणीकृत नाही. कृपया प्रवेश विनंती पाठवा.',
            },
            { status: 404 }
          );
        }

        userData = (userCheck as any[])[0];
      } finally {
        existConn.release();
      }

      const status = (userData.status || '').toLowerCase().trim();
      const statusAllowsOtp = status === 'active' || status === 'approved';
      const hasActiveFlag = Number(userData.is_active) === 1;

      // If user exists but is not approved/active, return error IMMEDIATELY
      // NO OTP will be generated, NO SMS will be sent
      if (!statusAllowsOtp || !hasActiveFlag) {
        Logger.info('send_otp_rejected_user_not_approved', { 
          phone, 
          status: userData.status, 
          is_active: userData.is_active 
        });
        return NextResponse.json(
          {
            ok: false,
            error: 'user_not_active',
            message: 'आपले खाते अजून मंजूर झालेले नाही. कृपया प्रशासकाशी संपर्क साधा.',
          },
          { status: 403 }
        );
      }
      
      // ============================================================================
      // Only proceed to OTP generation if user is approved and active
      // At this point, userData is guaranteed to have status='active' AND is_active=1
      // ============================================================================

      // Determine allowed user types based on source
      const isWebRequest = source === 'web';
      const userType = normalizeRole(userData.user_type);
      const relatedType = normalizeRole(userData.related_type);
      effectiveRole = userType || relatedType;

      // For web requests, allow admin/supervisor/verification_officer users
      if (isWebRequest) {
        const isAdmin = userType === 'admin' || relatedType === 'admin';
        const isSupervisor = userType === 'supervisor' || relatedType === 'supervisor';
        const isVerificationOfficer = userType === 'verification_officer' || relatedType === 'verification_officer';
        if (!isAdmin && !isSupervisor && !isVerificationOfficer) {
          return NextResponse.json(
            {
              ok: false,
              error: 'forbidden_role',
              message: 'या भूमिकेला वेब प्रवेश नाही.',
            },
            { status: 403 }
          );
        }
        
      }

      // For mobile requests, allow field_officer/supervisor/admin/therapy_specialist users
      if (!isWebRequest) {
        const isFieldOfficer = effectiveRole === 'field_officer';
        const isSupervisor = effectiveRole === 'supervisor';
        const isAdmin = effectiveRole === 'admin';
        const isTherapySpecialist = effectiveRole === 'therapy_specialist' || effectiveRole === 'practitioner';

        // Only check role if provided and user doesn't match any allowed role
        if (role && !isFieldOfficer && !isSupervisor && !isAdmin && !isTherapySpecialist) {
          return NextResponse.json(
            {
              ok: false,
              error: 'forbidden_role',
              message: 'या भूमिकेला मोबाइल प्रवेश नाही.',
            },
            { status: 403 }
          );
        }

        // Enforce requested role to match actual role when provided
        if (role && effectiveRole && role !== effectiveRole) {
          return NextResponse.json(
            {
              ok: false,
              error: 'forbidden_role',
              message: 'निवडलेली भूमिका आणि वापरकर्त्याची वास्तविक भूमिका जुळत नाही.',
            },
            { status: 403 }
          );
        }
      }
    } else {
      // Survey verification: Just validate phone number, no user approval needed
      Logger.info('send_otp_survey_verification', { phone });
    }

    // Bypass OTP for System Admin (9999999999) - return success without sending
    const ADMIN_BYPASS_PHONE = '9999999999';
    const isAdminBypass = phone === ADMIN_BYPASS_PHONE;
    
    // Bypass OTP for Verification Officer (8888888888) - return success without sending
    const VERIFICATION_OFFICER_BYPASS_PHONE = '8888888888';
    const isVerificationOfficerBypass = phone === VERIFICATION_OFFICER_BYPASS_PHONE;
    
    if (isAdminBypass) {
      Logger.info('send_otp_admin_bypass', { phone, note: 'Admin user - OTP bypassed' });
      return NextResponse.json({
        ok: true,
        message: 'OTP bypassed for admin user',
        phone: phone,
      });
    }
    
    if (isVerificationOfficerBypass) {
      Logger.info('send_otp_verification_officer_bypass', { phone, note: 'Verification Officer user - OTP bypassed' });
      return NextResponse.json({
        ok: true,
        message: 'OTP bypassed for verification officer user',
        phone: phone,
      });
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

    let connection;
    try {
      // Add timeout wrapper to fail fast if connection takes too long
      connection = await Promise.race([
        pool.getConnection(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database connection timeout')), 25000)
        )
      ]) as any;
    } catch (connError: any) {
      Logger.error('send_otp_db_connection_failed_otp', { error: connError.message, phone });
      return NextResponse.json(
        { ok: false, error: connError.message?.includes('timeout')
          ? 'Database connection timeout. Please try again.'
          : 'Database connection failed. Please try again.' },
        { status: 500 }
      );
    }
    
    try {
      await connection.beginTransaction();
      
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
      
      // Check if we're in local development mode (only skip SMS if explicitly enabled)
      // SMS will work by default unless LOCAL_DEV_SKIP_SMS is explicitly set to 'true'
      const isLocalDev = process.env.LOCAL_DEV_SKIP_SMS === 'true';
      
      let sms: any = { ok: true, local_dev: true };
      
      if (isLocalDev) {
        // Local development: Skip SMS sending, log OTP instead
        Logger.info('send_otp_local_dev', { 
          phone, 
          otp_id: otpId, 
          otp: cleanOtp,
          message: 'OTP sent in local development mode - SMS skipped'
        });
        console.log('\n========================================');
        console.log('🔐 LOCAL DEV MODE - OTP FOR TESTING');
        console.log('========================================');
        console.log(`Phone: ${phone}`);
        console.log(`OTP: ${cleanOtp}`);
        console.log(`OTP ID: ${otpId}`);
        console.log('========================================\n');
        
        // Return OTP in response for local development
        return NextResponse.json({ 
          ok: true, 
          otp_id: otpId, 
          otp: cleanOtp, // Include OTP in response for local dev
          sms: { ok: true, local_dev: true, message: 'SMS skipped in local development' },
          message: `Local dev mode: OTP is ${cleanOtp}`
        });
      } else {
        // Production: Send actual SMS
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
        
        // Send SMS (non-blocking - don't wait for it to complete)
        sendSMS(phone, message).then((smsResult) => {
          Logger.info('send_otp_sms_completed', { phone, otp_id: otpId, resp: smsResult });
        }).catch((err) => {
          Logger.error('send_otp_sms_failed', { phone, otp_id: otpId, error: err.message });
        });
        
        // Return immediately - SMS will be sent in background
        Logger.info('send_otp', { phone, otp_id: otpId, otp: cleanOtp, messageLength: message.length });

        return NextResponse.json({ 
          ok: true, 
          otp_id: otpId, 
          sms: { ok: true, queued: true, message: 'SMS queued for sending' }
        });
      }
    } catch (dbError: any) {
      // Rollback transaction if it was started
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          Logger.error('send_otp_rollback_failed', { error: (rollbackError as any).message });
        }
      }
      Logger.error('send_otp_db_error', { 
        error: dbError.message, 
        stack: dbError.stack,
        phone 
      });
      throw dbError; // Re-throw to be caught by outer catch
    } finally {
      if (connection) {
        connection.release();
      }
    }
  } catch (error: any) {
    Logger.error('send_otp_failed', { 
      error: error.message, 
      stack: error.stack,
      name: error.name,
      phone: (error as any).phone || 'unknown'
    });
    
    // Return a user-friendly error message
    const errorMessage = error.message || 'An unexpected error occurred';
    return NextResponse.json(
      { 
        ok: false, 
        error: errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED') 
          ? 'Database connection timeout. Please try again.' 
          : errorMessage
      },
      { status: 500 }
    );
  }
}

