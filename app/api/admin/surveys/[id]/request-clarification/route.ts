import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { sendEmailAndLog } from '@/lib/email-service';
import { sendSMS } from '@/lib/sms';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/surveys/[id]/request-clarification
 * Verification officer requests clarification for one or more questions
 */
export const POST = requireAuth(async (request: NextRequest, user) => {
  // Only verification officer can request clarification
  const userType = user.user_type?.toLowerCase() || '';

  // Debug logging
  Logger.info('CLARIFICATION_REQUEST_AUTH_CHECK', {
    user_id: user.id,
    user_name: user.name,
    user_phone: user.phone,
    user_type: user.user_type,
    user_type_lowercase: userType,
    expected: 'verification_officer',
    match: userType === 'verification_officer',
  });

  if (userType !== 'verification_officer') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Only verification officer can request clarification',
        debug: {
          received_user_type: user.user_type,
          received_user_type_lowercase: userType,
          user_id: user.id,
        }
      },
      { status: 403 }
    );
  }

  const surveyIdParam = request.nextUrl.pathname.split('/').filter(Boolean).slice(-2)[0];
  if (!surveyIdParam) {
    return NextResponse.json({ ok: false, error: 'Survey ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { questions } = body; // Array of { question_id, reason }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'At least one question with reason is required' },
        { status: 400 }
      );
    }

    // Validate each question has question_id and reason
    for (const q of questions) {
      if (!q.question_id || !q.reason || !String(q.reason).trim()) {
        return NextResponse.json(
          { ok: false, error: 'Each question must have question_id and reason' },
          { status: 400 }
        );
      }
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Check if survey exists - the ID might be survey_aadhar.id or surveys.id
      // Try both: first by surveys.id, then by surveys.aadhaar_id (which references survey_aadhar.id)
      // Also get survey_aadhar.user_id as fallback for field officer ID
      // Also get holder_name and aadhar_no for notification display
      let [surveyRows]: any = await conn.query(
        `SELECT s.id, s.user_id, s.assigned_to, s.aadhaar_id, sa.user_id AS aadhar_user_id,
                sa.holder_name, sa.aadhar_no
         FROM surveys s
         LEFT JOIN survey_aadhar sa ON sa.id = s.aadhaar_id
         WHERE s.id = ? OR s.aadhaar_id = ?
         LIMIT 1`,
        [surveyIdParam, surveyIdParam]
      );

      // If not found, try to find via survey_aadhar
      if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
        const [aadharRows]: any = await conn.query(
          `SELECT s.id, s.user_id, s.assigned_to, s.aadhaar_id, sa.user_id AS aadhar_user_id,
                  sa.holder_name, sa.aadhar_no
           FROM survey_aadhar sa
           LEFT JOIN surveys s ON s.aadhaar_id = sa.id
           WHERE sa.id = ?
           LIMIT 1`,
          [surveyIdParam]
        );
        if (Array.isArray(aadharRows) && aadharRows.length > 0) {
          surveyRows = aadharRows;
        }
      }

      if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
        return NextResponse.json({ ok: false, error: 'Survey not found' }, { status: 404 });
      }

      const survey = surveyRows[0];
      const actualSurveyId = survey.id; // This is the surveys.id, not survey_aadhar.id

      // Allow if assigned to this user OR if not assigned yet (NULL)
      // If assigned to someone else, deny access
      if (survey.assigned_to !== null && survey.assigned_to !== user.id) {
        return NextResponse.json(
          { ok: false, error: 'Survey is not assigned to you' },
          { status: 403 }
        );
      }

      // If survey is not assigned yet, assign it to this verification officer
      if (survey.assigned_to === null) {
        await conn.query(
          `UPDATE surveys 
           SET assigned_to = ?, 
               verification_status = COALESCE(verification_status, 'under_review'),
               updated_at = NOW()
           WHERE id = ?`,
          [user.id, actualSurveyId]
        );
        Logger.info('SURVEY_AUTO_ASSIGNED_ON_CLARIFICATION', {
          survey_id: actualSurveyId,
          survey_aadhar_id: surveyIdParam,
          verification_officer_id: user.id,
        });
      }

      // Use survey.user_id, but fallback to survey_aadhar.user_id if survey.user_id is 1 (system user)
      // This handles cases where public submissions set user_id = 1
      let fieldOfficerId = survey.user_id;
      if (!fieldOfficerId || String(fieldOfficerId) === '1') {
        // Fallback to survey_aadhar.user_id (the user who uploaded the Aadhaar)
        fieldOfficerId = survey.aadhar_user_id || fieldOfficerId;
      }

      // If still 1, but we have an assignment, use the assigned officer
      if (String(fieldOfficerId) === '1') {
        // Find if this survey has an assignment in survey_assignments
        const [assignmentRows]: any = await conn.query(
          `SELECT field_officer_id FROM survey_assignments 
           WHERE survey_id = ? 
           ORDER BY assigned_at DESC LIMIT 1`,
          [actualSurveyId || surveyIdParam]
        );
        if (Array.isArray(assignmentRows) && assignmentRows.length > 0) {
          fieldOfficerId = assignmentRows[0].field_officer_id;
        }
      }

      Logger.info('CLARIFICATION_FIELD_OFFICER_LOOKUP', {
        survey_id: actualSurveyId,
        survey_user_id: survey.user_id,
        aadhar_user_id: survey.aadhar_user_id,
        field_officer_id: fieldOfficerId,
        note: fieldOfficerId === 1 ? 'Using fallback - survey.user_id was system user (1)' : 'Using survey.user_id',
      });

      // Get field officer details for notification
      const [fieldOfficerRows]: any = await conn.query(
        `SELECT id, name, email, contact_number, user_type
         FROM users 
         WHERE id = ? LIMIT 1`,
        [fieldOfficerId]
      );
      const fieldOfficer = Array.isArray(fieldOfficerRows) && fieldOfficerRows.length > 0
        ? fieldOfficerRows[0]
        : null;

      Logger.info('CLARIFICATION_FIELD_OFFICER_FOUND', {
        field_officer_id: fieldOfficerId,
        found: !!fieldOfficer,
        field_officer_name: fieldOfficer?.name,
        field_officer_phone: fieldOfficer?.contact_number,
        field_officer_type: fieldOfficer?.user_type,
      });

      // Validate field officer exists and is actually a field officer
      if (!fieldOfficer) {
        Logger.error('CLARIFICATION_FIELD_OFFICER_NOT_FOUND', {
          field_officer_id: fieldOfficerId,
          survey_id: actualSurveyId,
        });
        // Continue anyway - notification creation will be skipped
      } else {
        const fieldOfficerType = (fieldOfficer.user_type || '').toLowerCase().trim();
        const isFieldOfficer = fieldOfficerType === 'field_officer' || fieldOfficerType === 'field officer';
        if (!isFieldOfficer) {
          Logger.error('CLARIFICATION_USER_NOT_FIELD_OFFICER', {
            field_officer_id: fieldOfficerId,
            user_type: fieldOfficer.user_type,
            survey_id: actualSurveyId,
          });
          // Still create notification - user might have changed role
        }
      }

      // Ensure question_clarifications table exists
      try {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS question_clarifications (
            id bigint unsigned NOT NULL AUTO_INCREMENT,
            survey_id bigint unsigned NOT NULL,
            question_id bigint unsigned NOT NULL,
            verification_officer_id bigint unsigned NOT NULL,
            field_officer_id bigint unsigned NOT NULL,
            reason text NOT NULL,
            status enum('pending','resolved','cancelled') NOT NULL DEFAULT 'pending',
            resolved_at timestamp NULL DEFAULT NULL,
            created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY unique_survey_question (survey_id, question_id),
            KEY idx_survey_id (survey_id),
            KEY idx_question_id (question_id),
            KEY idx_verification_officer (verification_officer_id),
            KEY idx_field_officer (field_officer_id),
            KEY idx_status (status)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
      } catch (createError: any) {
        Logger.error('CREATE_CLARIFICATIONS_TABLE_ERROR', { error: createError.message });
        // Continue - table might already exist
      }

      // Get question details for notification
      const questionIds = questions.map((q: any) => parseInt(String(q.question_id)));
      const [questionRows]: any = await conn.query(
        `SELECT id, question FROM questions WHERE id IN (?)`,
        [questionIds]
      );
      const questionMap = new Map<number, string>();
      if (Array.isArray(questionRows)) {
        questionRows.forEach((q: any) => {
          questionMap.set(q.id, q.question || `Question ${q.id}`);
        });
      }

      // Insert or update clarification requests
      const results = [];
      const clarificationDetails: Array<{ question_id: number; question_text: string; reason: string }> = [];

      for (const q of questions) {
        const questionId = parseInt(String(q.question_id));
        const reason = String(q.reason).trim();
        const questionText = questionMap.get(questionId) || `Question ${questionId}`;

        // Check if clarification already exists
        const [existingRows]: any = await conn.query(
          `SELECT id FROM question_clarifications 
           WHERE survey_id = ? AND question_id = ? LIMIT 1`,
          [actualSurveyId, questionId]
        );

        if (Array.isArray(existingRows) && existingRows.length > 0) {
          // Update existing clarification
          await conn.query(
            `UPDATE question_clarifications 
             SET reason = ?,
                 status = 'pending',
                 resolved_at = NULL,
                 updated_at = NOW()
             WHERE survey_id = ? AND question_id = ?`,
            [reason, actualSurveyId, questionId]
          );
          results.push({ question_id: questionId, action: 'updated' });
        } else {
          // Insert new clarification
          await conn.query(
            `INSERT INTO question_clarifications 
             (survey_id, question_id, verification_officer_id, field_officer_id, reason, status)
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [actualSurveyId, questionId, user.id, fieldOfficerId, reason]
          );
          results.push({ question_id: questionId, action: 'created' });
        }

        clarificationDetails.push({ question_id: questionId, question_text: questionText, reason });
      }

      // Create in-app notification for field officer
      let notificationCreated = false;
      if (fieldOfficer) {
        try {
          // Ensure notifications table exists
          try {
            await conn.query(`
              CREATE TABLE IF NOT EXISTS notifications (
                id bigint unsigned NOT NULL AUTO_INCREMENT,
                user_id bigint unsigned NOT NULL,
                type enum('clarification_request','survey_assigned','survey_approved','survey_rejected','general') NOT NULL DEFAULT 'general',
                title varchar(255) NOT NULL,
                message text NOT NULL,
                data json DEFAULT NULL,
                is_read tinyint(1) NOT NULL DEFAULT 0,
                read_at timestamp NULL DEFAULT NULL,
                created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_user_id (user_id),
                KEY idx_type (type),
                KEY idx_is_read (is_read),
                KEY idx_created_at (created_at),
                KEY idx_user_read (user_id, is_read)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
          } catch (createError: any) {
            Logger.error('CREATE_NOTIFICATIONS_TABLE_ERROR', { error: createError.message });
          }

          // Get person's name and Aadhaar number for notification display
          const holderName = survey.holder_name || 'Unknown';
          const aadharNo = survey.aadhar_no || 'N/A';

          // Create notification with person's name in title
          const notificationTitle = `${holderName} साठी स्पष्टीकरण आवश्यक`;
          const notificationMessage = `${questions.length} प्रश्नांसाठी स्पष्टीकरण आवश्यक आहे. कृपया सर्वेक्षण अपडेट करा.`;
          const notificationData = JSON.stringify({
            survey_id: String(actualSurveyId),
            survey_aadhar_id: String(survey.aadhaar_id), // Use actual aadhaar_id for pre-filling
            holder_name: holderName,
            aadhar_no: aadharNo,
            question_ids: questionIds,
            questions: clarificationDetails.map(c => ({
              question_id: String(c.question_id),
              question_text: c.question_text,
              reason: c.reason,
            })),
          });

          const [insertResult]: any = await conn.query(
            `INSERT INTO notifications (user_id, type, title, message, data, is_read)
             VALUES (?, 'clarification_request', ?, ?, ?, 0)`,
            [fieldOfficerId, notificationTitle, notificationMessage, notificationData]
          );

          Logger.info('NOTIFICATION_INSERTED', {
            notification_id: insertResult?.insertId,
            field_officer_id: fieldOfficerId,
            field_officer_name: fieldOfficer?.name,
            field_officer_phone: fieldOfficer?.contact_number,
            survey_id: actualSurveyId,
            questions_count: questions.length,
          });

          notificationCreated = true;
          Logger.info('NOTIFICATION_CREATED', {
            field_officer_id: fieldOfficerId,
            survey_id: actualSurveyId,
            survey_aadhar_id: surveyIdParam,
            questions_count: questions.length,
          });

          // Send FCM push notification
          try {
            const { sendFCMPushNotification } = await import('@/lib/fcm');
            await sendFCMPushNotification(
              fieldOfficerId,
              notificationTitle,
              notificationMessage,
              {
                type: 'clarification_request',
                survey_id: actualSurveyId.toString(),
                survey_aadhar_id: survey.aadhaar_id.toString(), // Use actual aadhaar_id for pre-filling
                holder_name: holderName,
                aadhar_no: aadharNo,
                question_ids: JSON.stringify(questionIds),
              }
            );
          } catch (fcmError: any) {
            Logger.error('FCM_PUSH_ERROR', {
              error: fcmError?.message,
              field_officer_id: fieldOfficerId,
            });
            // Don't fail the request if FCM fails
          }
        } catch (notificationError: any) {
          Logger.error('CREATE_NOTIFICATION_ERROR', {
            error: notificationError?.message,
            field_officer_id: fieldOfficerId,
          });
        }
      }

      // Send single notification to field officer (email and/or SMS)
      let notificationSent = false;
      if (fieldOfficer) {
        try {
          // Prepare notification message
          const questionsList = clarificationDetails
            .map((c, idx) => `${idx + 1}. ${c.question_text}\n   कारण: ${c.reason}`)
            .join('\n\n');

          const notificationMessage = `सर्वेक्षण क्रमांक ${actualSurveyId} साठी स्पष्टीकरण आवश्यक:\n\n${questionsList}\n\nकृपया सर्वेक्षण अपडेट करा.`;

          // Send email if available
          if (fieldOfficer.email) {
            try {
              const emailBody = `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                  <h2>सर्वेक्षण स्पष्टीकरण आवश्यक</h2>
                  <p>नमस्कार ${fieldOfficer.name || 'Field Officer'},</p>
                  <p>सर्वेक्षण क्रमांक <strong>${actualSurveyId}</strong> साठी खालील प्रश्नांसाठी स्पष्टीकरण आवश्यक आहे:</p>
                  <ul>
                    ${clarificationDetails.map((c, idx) => `
                      <li style="margin-bottom: 15px;">
                        <strong>${idx + 1}. ${c.question_text}</strong><br>
                        <span style="color: #666;">कारण: ${c.reason}</span>
                      </li>
                    `).join('')}
                  </ul>
                  <p>कृपया सर्वेक्षण अपडेट करा.</p>
                  <p>धन्यवाद,<br>DDRC Survey System</p>
                </div>
              `;

              await sendEmailAndLog({
                recipientType: 'field_officer',
                recipientEmail: fieldOfficer.email,
                recipientUserId: fieldOfficerId,
                emailSubject: `सर्वेक्षण स्पष्टीकरण आवश्यक - Survey ${actualSurveyId}`,
                emailBody: emailBody,
              });
              notificationSent = true;
            } catch (emailError: any) {
              Logger.error('CLARIFICATION_EMAIL_ERROR', {
                error: emailError?.message,
                field_officer_id: fieldOfficerId
              });
            }
          }

          // Send SMS if phone number available
          if (fieldOfficer.contact_number) {
            try {
              const smsResult = await sendSMS(fieldOfficer.contact_number, notificationMessage);
              if (smsResult.ok) {
                notificationSent = true;
                Logger.info('CLARIFICATION_SMS_SENT', {
                  field_officer_id: fieldOfficerId,
                  phone: fieldOfficer.contact_number,
                });
              } else {
                Logger.error('CLARIFICATION_SMS_FAILED', {
                  field_officer_id: fieldOfficerId,
                  phone: fieldOfficer.contact_number,
                  error: smsResult.error,
                });
              }
            } catch (smsError: any) {
              Logger.error('CLARIFICATION_SMS_ERROR', {
                error: smsError?.message,
                field_officer_id: fieldOfficerId,
              });
            }
          }
        } catch (notificationError: any) {
          Logger.error('CLARIFICATION_NOTIFICATION_ERROR', {
            error: notificationError?.message,
            field_officer_id: fieldOfficerId,
          });
          // Don't fail the request if notification fails
        }
      }

      Logger.info('CLARIFICATION_REQUESTS_CREATED', {
        survey_id: actualSurveyId,
        survey_aadhar_id: surveyIdParam,
        verification_officer_id: user.id,
        field_officer_id: fieldOfficerId,
        questions_count: questions.length,
        notification_created: notificationCreated,
        email_sms_sent: notificationSent,
      });

      return NextResponse.json({
        ok: true,
        message: 'Clarification requests sent successfully',
        notification_sent: notificationSent,
        results: results,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('CLARIFICATION_REQUEST_ERROR', { error: error?.message || String(error) });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to request clarification' },
      { status: 500 }
    );
  }
});

/**
 * GET /api/admin/surveys/[id]/request-clarification
 * Get all clarification requests for a survey
 */
export const GET = requireAuth(async (request: NextRequest, user) => {
  const surveyIdParam = request.nextUrl.pathname.split('/').filter(Boolean).slice(-2)[0];
  if (!surveyIdParam) {
    return NextResponse.json({ ok: false, error: 'Survey ID required' }, { status: 400 });
  }

  try {
    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Find the actual surveys.id - the param might be survey_aadhar.id or surveys.id
      let [surveyRows]: any = await conn.query(
        `SELECT s.id FROM surveys s WHERE s.id = ? OR s.aadhaar_id = ? LIMIT 1`,
        [surveyIdParam, surveyIdParam]
      );

      // If not found, try via survey_aadhar
      if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
        const [aadharRows]: any = await conn.query(
          `SELECT s.id FROM survey_aadhar sa
           LEFT JOIN surveys s ON s.aadhaar_id = sa.id
           WHERE sa.id = ? LIMIT 1`,
          [surveyIdParam]
        );
        if (Array.isArray(aadharRows) && aadharRows.length > 0) {
          surveyRows = aadharRows;
        }
      }

      if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
        return NextResponse.json({ ok: false, error: 'Survey not found' }, { status: 404 });
      }

      const actualSurveyId = surveyRows[0].id;

      const [rows]: any = await conn.query(
        `SELECT 
          qc.id,
          qc.question_id,
          qc.reason,
          qc.status,
          qc.created_at,
          qc.resolved_at,
          qc.verification_officer_id,
          qc.field_officer_id,
          q.question AS question_marathi
         FROM question_clarifications qc
         LEFT JOIN questions q ON qc.question_id = q.id
         WHERE qc.survey_id = ?
         ORDER BY qc.created_at DESC`,
        [actualSurveyId]
      );

      return NextResponse.json({
        ok: true,
        clarifications: Array.isArray(rows) ? rows : [],
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('GET_CLARIFICATIONS_ERROR', { error: error?.message || String(error) });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch clarifications' },
      { status: 500 }
    );
  }
});

