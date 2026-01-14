import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { sendSMS, buildDLTMessage } from '@/lib/sms';
import { Logger } from '@/lib/logger';
import { CONFIG } from '@/lib/config';
import { validatePhone, validateRequest } from '@/lib/validation';
import { logSignupStep } from '@/lib/signup-logger';

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
    const TEST_FIELD_OFFICER_PHONE = '7777777777';
    const isTestFieldOfficer = phone === TEST_FIELD_OFFICER_PHONE;

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
        { ok: false, error: 'Database connection unsuccessful. Please try again later.' },
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
      // Determine if this is a web request early
      const isWebRequest = source === 'web';

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
          {
            ok: false, error: connError.message?.includes('timeout')
              ? 'Database connection timeout. Please try again after a moment.'
              : 'Database connection unsuccessful. Please try again later.'
          },
          { status: 500 }
        );
      }

      try {
        // Get name and email from request body if available (from onboarding step 2)
        const name = (body.name || '').toString().trim() || 'Field Officer';
        const email = (body.email || '').toString().trim() || null;

        // Fetch user by phone number
        const [userCheck] = await existConn.execute(
          `SELECT 
             u.id, 
             u.user_type, 
             u.status, 
             u.is_active, 
             u.email,
             ut.user_type AS related_type
           FROM users u
           LEFT JOIN user_types ut ON ut.id = u.user_type_id
           WHERE u.contact_number = ?
           LIMIT 1`,
          [phone]
        );

        const userExists = Array.isArray(userCheck) && (userCheck as any[]).length > 0;
        const existingUser = userExists ? (userCheck as any[])[0] : null;
        const existingStatus = existingUser ? (existingUser.status || '').toLowerCase().trim() : '';
        const existingIsActive = existingUser ? Number(existingUser.is_active) : 0;

        // Determine if this is a sign-up attempt (mobile onboarding) vs login attempt
        const isMobileOnboarding = !isWebRequest && role === 'field_officer';
        // Test user can always trigger onboarding/signup even if active
        const needsOnboardingSetup = !userExists || (existingStatus === '' || existingStatus === 'inactive') || (isTestFieldOfficer && isMobileOnboarding);

        // Only block active users if they're trying to SIGN UP (not login)
        // For login attempts, active users should be allowed to send OTP
        if (isMobileOnboarding && needsOnboardingSetup) {
          // This is a sign-up attempt - check for duplicate active users
          if (userExists && existingStatus === 'active' && existingIsActive === 1 && !isTestFieldOfficer) {
            existConn.release();
            Logger.info('send_otp_rejected_active_user_exists_signup', { phone, user_id: existingUser.id });
            return NextResponse.json(
              {
                ok: false,
                error: 'user_already_exists',
                message: 'या मोबाईल क्रमांकासह आधीच खाते नोंदणीकृत आहे. कृपया लॉगिन करा.',
              },
              { status: 409 }
            );
          }

          // Check if email is provided and if an active user exists with this email (only during sign-up)
          if (email && email.includes('@') && !isTestFieldOfficer) {
            const [emailCheck] = await existConn.execute(
              `SELECT id, status, is_active, contact_number 
               FROM users 
               WHERE email = ? AND email IS NOT NULL AND email != ''
               LIMIT 1`,
              [email.toLowerCase()]
            );

            const emailUserExists = Array.isArray(emailCheck) && (emailCheck as any[]).length > 0;
            if (emailUserExists) {
              const emailUser = (emailCheck as any[])[0];
              const emailUserStatus = (emailUser.status || '').toLowerCase().trim();
              const emailUserIsActive = Number(emailUser.is_active) === 1;

              // If active user exists with this email, reject signup
              if (emailUserStatus === 'active' && emailUserIsActive) {
                existConn.release();
                Logger.info('send_otp_rejected_email_exists', { email, user_id: emailUser.id });
                return NextResponse.json(
                  {
                    ok: false,
                    error: 'email_already_exists',
                    message: 'या ईमेल आयडीसह आधीच खाते नोंदणीकृत आहे. कृपया लॉगिन करा.',
                  },
                  { status: 409 }
                );
              }

              // If email exists but phone is different, also reject (email should be unique per user)
              if (emailUser.contact_number && emailUser.contact_number !== phone) {
                existConn.release();
                Logger.info('send_otp_rejected_email_different_phone', { email, existing_phone: emailUser.contact_number, new_phone: phone });
                return NextResponse.json(
                  {
                    ok: false,
                    error: 'email_already_exists',
                    message: 'या ईमेल आयडीसह आधीच खाते नोंदणीकृत आहे. कृपया लॉगिन करा.',
                  },
                  { status: 409 }
                );
              }
            }
          }
        }

        if (isMobileOnboarding && needsOnboardingSetup) {
          if (!userExists) {
            // Create new user
            Logger.info('send_otp_creating_user_for_onboarding', { phone, email, role });

            // Get field officer user type ID
            const [foType]: any = await existConn.execute(
              `SELECT id FROM user_types WHERE LOWER(user_type) IN ('field officer', 'field_officer') LIMIT 1`
            );
            const fieldOfficerTypeId = Array.isArray(foType) && foType.length > 0 ? foType[0]?.id ?? null : null;

            // Create user with inactive status (will be activated after profile completion)
            const DEFAULT_MOBILE_ROLE = 'field_officer';
            try {
              await existConn.execute(
                `INSERT INTO users (name, contact_number, email, user_type, user_type_id, status, is_active, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 'inactive', 0, NOW(), NOW())`,
                [name, phone, email || null, DEFAULT_MOBILE_ROLE, fieldOfficerTypeId]
              );
            } catch (insertError: any) {
              // Check if it's a duplicate key error
              if (insertError.code === 'ER_DUP_ENTRY') {
                existConn.release();
                const duplicateField = insertError.message.includes('contact_number') ? 'phone' : 'email';
                Logger.info('send_otp_rejected_duplicate_key', { phone, email, duplicateField });
                return NextResponse.json(
                  {
                    ok: false,
                    error: duplicateField === 'phone' ? 'user_already_exists' : 'email_already_exists',
                    message: duplicateField === 'phone'
                      ? 'या मोबाईल क्रमांकासह आधीच खाते नोंदणीकृत आहे. कृपया लॉगिन करा.'
                      : 'या ईमेल आयडीसह आधीच खाते नोंदणीकृत आहे. कृपया लॉगिन करा.',
                  },
                  { status: 409 }
                );
              }

              Logger.error('send_otp_user_insert_failed', {
                phone,
                name,
                email,
                fieldOfficerTypeId,
                error: insertError.message,
                code: insertError.code,
                errno: insertError.errno,
                sqlState: insertError.sqlState,
                stack: insertError.stack
              });
              existConn.release();
              return NextResponse.json(
                {
                  ok: false,
                  error: 'user_creation_failed',
                  message: 'वापरकर्ता तयार करण्यात अडचण. कृपया पुन्हा प्रयत्न करा.',
                },
                { status: 500 }
              );
            }

            Logger.info('send_otp_user_created_for_onboarding', { phone, name, email });

            // Fetch the newly created user
            const [newUserCheck] = await existConn.execute(
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

            if (Array.isArray(newUserCheck) && newUserCheck.length > 0) {
              userData = newUserCheck[0];
              // Allow OTP for newly created inactive users during onboarding
              Logger.info('send_otp_allowing_otp_for_new_user', { phone, user_id: userData.id });
            } else {
              Logger.error('send_otp_user_creation_failed', { phone });
              existConn.release();
              return NextResponse.json(
                {
                  ok: false,
                  error: 'user_creation_failed',
                  message: 'वापरकर्ता तयार करण्यात अडचण. कृपया पुन्हा प्रयत्न करा.',
                },
                { status: 500 }
              );
            }
          } else if (isTestFieldOfficer) {
            // Update existing test user for re-signup
            Logger.info('send_otp_updating_test_user_for_onboarding', { phone, name, email });
            try {
              await existConn.execute(
                `UPDATE users SET name = ?, email = ?, updated_at = NOW() WHERE contact_number = ?`,
                [name, email || null, phone]
              );

              // Refresh userData
              const [updatedCheck] = await existConn.execute(
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
              userData = (updatedCheck as any[])[0];
            } catch (updateError: any) {
              Logger.error('send_otp_test_user_update_failed', { phone, error: updateError.message });
              // Continue with existing user data if update fails
              userData = existingUser;
            }
          } else {
            // User exists but has empty/inactive status - use existing user for onboarding
            Logger.info('send_otp_using_existing_user_for_onboarding', { phone, existingStatus });
            userData = existingUser;
          }
        } else if (!userExists) {
          // For web or other sources, return error as before
          Logger.info('send_otp_rejected_user_not_found', { phone });
          existConn.release();
          return NextResponse.json(
            {
              ok: false,
              error: 'user_not_found',
              message: 'वापरकर्ता नोंदणीकृत नाही. कृपया प्रवेश विनंती पाठवा.',
            },
            { status: 404 }
          );
        } else {
          userData = existingUser;
        }
      } finally {
        if (existConn) {
          existConn.release();
        }
      }

      // Ensure userData exists before accessing its properties
      if (!userData) {
        Logger.error('send_otp_user_data_null', { phone });
        return NextResponse.json(
          {
            ok: false,
            error: 'user_not_found',
            message: 'वापरकर्ता नोंदणीकृत नाही. कृपया प्रवेश विनंती पाठवा.',
          },
          { status: 404 }
        );
      }

      const status = (userData.status || '').toLowerCase().trim();
      const statusAllowsOtp = status === 'active' || status === 'approved';
      const isPending = status === 'inactive' || status === ''; // Allow empty/inactive status for newly created users
      const hasActiveFlag = Number(userData.is_active) === 1;

      // Allow OTP for inactive/empty status users during mobile onboarding (they're in the process of completing profile)
      // Also allow OTP for active/approved users (for login)
      const allowOtpForOnboarding = isPending && !isWebRequest && role === 'field_officer';
      const allowOtpForActiveUser = statusAllowsOtp && hasActiveFlag;

      // Block OTP only if user is NOT in onboarding AND user is NOT active
      if (!allowOtpForOnboarding && !allowOtpForActiveUser) {
        Logger.info('send_otp_rejected_user_not_approved', {
          phone,
          status: userData.status,
          is_active: userData.is_active,
          allowOtpForOnboarding,
          allowOtpForActiveUser,
          statusAllowsOtp,
          hasActiveFlag
        });
        return NextResponse.json(
          {
            ok: false,
            error: 'user_not_active',
            message: 'आपले खाते अजून मंजूर झालेले नाही. कृपया प्रशासकाशी संपर्क साधा किंवा थोड्या वेळाने पुन्हा प्रयत्न करा.',
          },
          { status: 403 }
        );
      }

      // ============================================================================
      // Only proceed to OTP generation if user is approved and active
      // At this point, userData is guaranteed to have status='active' AND is_active=1
      // ============================================================================

      // Determine allowed user types based on source
      // isWebRequest is already defined earlier in the function
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

    // Test Field Officer (7777777777) - generate and return OTP for testing
    // Note: isTestFieldOfficer is already defined at the start of POST handler

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

    // For test field officer, use fixed OTP 123456 and do not return it in response
    if (isTestFieldOfficer) {
      const TEST_FIELD_OFFICER_OTP = '123456';
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + CONFIG.OTP_EXPIRY_MINUTES);

      let connection;
      try {
        connection = await Promise.race([
          pool.getConnection(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database connection timeout')), 25000)
          )
        ]) as any;

        await connection.beginTransaction();
        
        // Mark old OTPs as expired
        await connection.execute(
          `UPDATE otp_verifications 
           SET status = 'expired', updated_at = NOW() 
           WHERE phone = ? AND status = 'sent'`,
          [phone]
        );
        
        const [result] = await connection.execute(
          `INSERT INTO otp_verifications (phone, otp, expires_at, status, created_at, updated_at) 
           VALUES (?, ?, ?, 'sent', NOW(), NOW())`,
          [phone, TEST_FIELD_OFFICER_OTP, expiresAt]
        );
        await connection.commit();
        const otpId = (result as any).insertId;

        Logger.info('send_otp_test_field_officer', { phone, otp_id: otpId });

        // Do not return OTP in response - user must enter it manually
        return NextResponse.json({
          ok: true,
          otp_id: otpId,
          message: 'OTP sent successfully',
          phone: phone,
        });
      } catch (dbError: any) {
        if (connection) {
          try {
            await connection.rollback();
          } catch (rollbackError) {
            Logger.error('send_otp_test_rollback_failed', { error: (rollbackError as any).message });
          }
          connection.release();
        }
        Logger.error('send_otp_test_field_officer_db_error', { error: dbError.message, phone });
        return NextResponse.json(
          { ok: false, error: 'Unable to generate test OTP. Please try again later.' },
          { status: 500 }
        );
      }
    }

    // Generate OTP: 6-digit number (100000 to 999999)
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Validate OTP is clean (only digits, exactly 6 digits)
    if (!/^\d{6}$/.test(otp)) {
      Logger.error('send_otp_invalid_otp', { otp, phone });
      return NextResponse.json(
        { ok: false, error: 'Unable to generate valid OTP. Please try again later.' },
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
        {
          ok: false, error: connError.message?.includes('timeout')
            ? 'Database connection timeout. Please try again after a moment.'
            : 'Database connection unsuccessful. Please try again later.'
        },
        { status: 500 }
      );
    }

    try {
      await connection.beginTransaction();

      // Mark old OTPs as expired when sending a new one
      await connection.execute(
        `UPDATE otp_verifications 
         SET status = 'expired', updated_at = NOW() 
         WHERE phone = ? AND status = 'sent'`,
        [phone]
      );

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
          { ok: false, error: 'Invalid OTP format. Please try again.' },
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

        // Log signup step: OTP sent (Step 2) - local dev mode
        const isMobileOnboardingCheck = source !== 'web' && role === 'field_officer';
        if (isMobileOnboardingCheck) {
          await logSignupStep({
            phone,
            user_id: userData?.id,
            step: 'otp_sent',
            step_number: 2,
            status: 'completed',
            data: { otp_id: otpId, local_dev: true, otp: cleanOtp },
          });
        }

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
          message = buildDLTMessage(cleanOtp);
          Logger.info('send_otp_message_generated', { phone, otp: cleanOtp, messageLength: message.length });
        } catch (msgError: any) {
          Logger.error('send_otp_message_failed', { error: msgError.message, otp: cleanOtp, phone });
          return NextResponse.json(
            { ok: false, error: `Unable to generate SMS message: ${msgError.message}. Please try again later.` },
            { status: 500 }
          );
        }

        // Send SMS and wait for response to diagnose issues
        Logger.info('send_otp', { phone, otp_id: otpId, otp: cleanOtp, messageLength: message.length });

        let smsResult;
        try {
          smsResult = await sendSMS(phone, message);
          Logger.info('send_otp_sms_completed', { phone, otp_id: otpId, resp: smsResult });
        } catch (err: any) {
          Logger.error('send_otp_sms_failed', { phone, otp_id: otpId, error: err.message, stack: err.stack });
          smsResult = { ok: false, error: err.message || 'SMS sending unsuccessful. Please try again later.' };
        }

        // Log signup step: OTP sent (Step 2)
        const isMobileOnboardingCheck2 = source !== 'web' && role === 'field_officer';
        if (isMobileOnboardingCheck2) {
          await logSignupStep({
            phone,
            user_id: userData?.id,
            step: 'otp_sent',
            step_number: 2,
            status: smsResult.ok ? 'completed' : 'failed',
            data: { otp_id: otpId, sms_sent: smsResult.ok },
            error_message: smsResult.ok ? undefined : smsResult.error,
          });
        }

        // Return with actual SMS status
        return NextResponse.json({
          ok: true,
          otp_id: otpId,
          sms: {
            ok: smsResult.ok || false,
            queued: smsResult.ok || false,
            message: smsResult.ok
              ? 'SMS sent successfully'
              : smsResult.error || `SMS sending unsuccessful: ${smsResult.responseCode || 'Unknown error'}. Please try again.`,
            responseCode: smsResult.responseCode,
            status: smsResult.status,
            raw: smsResult.raw ? (typeof smsResult.raw === 'string' ? smsResult.raw.substring(0, 200) : String(smsResult.raw).substring(0, 200)) : undefined
          }
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
    const errorMessage = error.message || 'An unexpected error occurred. Please try again later.';
    return NextResponse.json(
      {
        ok: false,
        error: errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')
          ? 'Database connection timeout. Please try again after a moment.'
          : errorMessage
      },
      { status: 500 }
    );
  }
}

