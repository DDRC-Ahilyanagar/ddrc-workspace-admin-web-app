import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/surveys/[id]/mark-verified
 * Verification officer marks a survey as verified
 */
export const POST = requireAuth(async (request: NextRequest, user) => {
  // Only verification officer can mark as verified
  const userType = user.user_type?.toLowerCase() || '';
  if (userType !== 'verification_officer') {
    return NextResponse.json(
      { ok: false, error: 'Only verification officer can mark surveys as verified' },
      { status: 403 }
    );
  }

  const surveyId = request.nextUrl.pathname.split('/').filter(Boolean).slice(-2)[0];
  if (!surveyId) {
    return NextResponse.json({ ok: false, error: 'Survey ID required' }, { status: 400 });
  }

  try {
    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Check if survey exists and is assigned to this verification officer
      // Also fetch details for notification (holder name, field officer id)
      const [surveyRows]: any = await conn.query(
        `SELECT s.id, s.user_id, s.assigned_to, s.verification_status, s.aadhaar_id,
                sa.holder_name, sa.aadhar_no, sa.user_id AS aadhar_user_id
         FROM surveys s
         LEFT JOIN survey_aadhar sa ON sa.id = s.aadhaar_id
         WHERE s.id = ? LIMIT 1`,
        [surveyId]
      );

      if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
        return NextResponse.json({ ok: false, error: 'Survey not found' }, { status: 404 });
      }

      const survey = surveyRows[0];

      // Mark as verified
      await conn.query(
        `UPDATE surveys 
         SET verification_status = 'verified',
             verified_by = ?,
             verified_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [user.id, surveyId]
      );

      Logger.info('SURVEY_MARKED_VERIFIED', {
        survey_id: surveyId,
        verification_officer_id: user.id,
      });

      // --- Notification Logic ---

      // Determine Field Officer ID (logic borrowed from request-clarification)
      let fieldOfficerId = survey.user_id;
      if (!fieldOfficerId || String(fieldOfficerId) === '1') {
        fieldOfficerId = survey.aadhar_user_id || fieldOfficerId;
      }

      // If still 1, check assignments
      if (String(fieldOfficerId) === '1') {
        const [assignmentRows]: any = await conn.query(
          `SELECT field_officer_id FROM survey_assignments 
           WHERE survey_id = ? 
           ORDER BY assigned_at DESC LIMIT 1`,
          [surveyId]
        );
        if (Array.isArray(assignmentRows) && assignmentRows.length > 0) {
          fieldOfficerId = assignmentRows[0].field_officer_id;
        }
      }

      // Only notify if we found a valid field officer (not system user 1)
      const holderName = survey.holder_name || 'Unknown';

      if (fieldOfficerId && String(fieldOfficerId) !== '1') {
        try {
          const notificationTitle = `${holderName} चे सर्वेक्षण मंजूर`;
          const notificationMessage = `${user.name || 'Verification Officer'} यांनी तुमचे स्पष्टीकरण/दुरुस्ती तपासून सर्वेक्षण मंजूर केले आहे.`;

          // data payload
          const notificationData = JSON.stringify({
            survey_id: surveyId,
            survey_aadhar_id: survey.aadhaar_id,
            holder_name: holderName,
            status: 'verified',
            verification_officer_id: Number(user.id),
            verification_officer_name: user.name || null,
            field_officer_id: Number(fieldOfficerId),
            action: 'clarification_resolved_by_verification_officer'
          });

          // Insert into notifications table
          await conn.query(
            `INSERT INTO notifications (user_id, from_user_id, field_officer_id, type, title, message, data, is_read)
             VALUES (?, ?, ?, 'survey_approved', ?, ?, ?, 0)`,
            [fieldOfficerId, user.id, fieldOfficerId, notificationTitle, notificationMessage, notificationData]
          );

          // Send FCM
          try {
            const { sendFCMPushNotification } = await import('@/lib/fcm');
            await sendFCMPushNotification(
              fieldOfficerId,
              notificationTitle,
              notificationMessage,
              {
                type: 'survey_approved',
                survey_id: surveyId.toString(),
                holder_name: holderName,
              }
            );
          } catch (fcmError: any) {
            Logger.error('VERIFICATION_FCM_ERROR', { error: fcmError?.message });
          }

        } catch (notifyError: any) {
          Logger.error('VERIFICATION_NOTIFICATION_DB_ERROR', { error: notifyError?.message });
        }
      }

      // Notify admins that verification officer has resolved/verified this survey
      try {
        const [adminRows]: any = await conn.query(
          `SELECT id, name
           FROM users
           WHERE LOWER(TRIM(user_type)) IN ('admin', 'administrator')`
        );

        if (Array.isArray(adminRows) && adminRows.length > 0) {
          const adminTitle = `सर्वेक्षण मंजूर: ${holderName}`;
          const adminMessage = `${user.name || 'Verification Officer'} यांनी ${holderName} चे सर्वेक्षण मंजूर केले आहे.`;
          const adminData = JSON.stringify({
            survey_id: surveyId,
            survey_aadhar_id: survey.aadhaar_id,
            holder_name: holderName,
            aadhar_no: survey.aadhar_no || null,
            verification_officer_id: Number(user.id),
            verification_officer_name: user.name || null,
            field_officer_id: fieldOfficerId ? Number(fieldOfficerId) : null,
            status: 'verified',
            action: 'verified_by_verification_officer'
          });

          for (const admin of adminRows) {
            await conn.query(
              `INSERT INTO notifications (user_id, from_user_id, field_officer_id, type, title, message, data, is_read)
               VALUES (?, ?, ?, 'general', ?, ?, ?, 0)`,
              [admin.id, user.id, fieldOfficerId || null, adminTitle, adminMessage, adminData]
            );
          }
        }
      } catch (adminNotifyError: any) {
        Logger.error('ADMIN_VERIFICATION_NOTIFICATION_ERROR', {
          error: adminNotifyError?.message,
          survey_id: surveyId,
        });
      }

      return NextResponse.json({ ok: true, message: 'Survey marked as verified' });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('SURVEY_VERIFICATION_ERROR', { error: error?.message || String(error) });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to mark survey as verified' },
      { status: 500 }
    );
  }
});

