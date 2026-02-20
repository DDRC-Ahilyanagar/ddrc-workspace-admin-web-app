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
        // Smart lookup: Get survey by ID first, or by aadhar reference
        // Returns the ACTUAL survey record with all details needed
        const [surveyRows]: any = await conn.query(
          `SELECT 
             s.id, 
             s.user_id, 
             s.assigned_to, 
             s.aadhaar_id, 
             s.verification_status,
             sa.user_id AS aadhar_user_id,
             sa.holder_name, 
             sa.aadhar_no,
             u.name AS field_officer_name
           FROM surveys s
           INNER JOIN survey_aadhar sa ON sa.id = s.aadhaar_id
           LEFT JOIN users u ON u.id = COALESCE(s.user_id, sa.user_id)
           WHERE s.id = ? 
           LIMIT 1`,
          [surveyIdParam]
        );

        // If not found by surveys.id, try by aadhar reference (get LATEST survey for this aadhar)
        let survey: any = null;
        if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
          Logger.info('CLARIFICATION_NOT_FOUND_BY_SURVEY_ID', { surveyIdParam });

          const [aadharSurveyRows]: any = await conn.query(
            `SELECT 
               s.id, 
               s.user_id, 
               s.assigned_to, 
               s.aadhaar_id, 
               s.verification_status,
               sa.user_id AS aadhar_user_id,
               sa.holder_name, 
               sa.aadhar_no,
               u.name AS field_officer_name
             FROM surveys s
             INNER JOIN survey_aadhar sa ON sa.id = s.aadhaar_id
             LEFT JOIN users u ON u.id = COALESCE(s.user_id, sa.user_id)
             WHERE sa.id = ? OR sa.aadhar_no = ?
             ORDER BY s.created_at DESC
             LIMIT 1`,
            [surveyIdParam, surveyIdParam]
          );

          if (Array.isArray(aadharSurveyRows) && aadharSurveyRows.length > 0) {
            survey = aadharSurveyRows[0];
            Logger.info('CLARIFICATION_FOUND_BY_AADHAR', {
              surveyIdParam,
              survey_id: survey.id,
            });
          }
        } else {
          survey = surveyRows[0];
        }

        // Validate we have a valid survey
        if (!survey) {
          return NextResponse.json({ ok: false, error: 'Survey not found' }, { status: 404 });
        }

        const actualSurveyId = survey.id;

        // Update verification status if needed
        if (survey.verification_status === null) {
          await conn.query(
            `UPDATE surveys
             SET verification_status = 'under_review',
                 updated_at = NOW()
             WHERE id = ?`,
            [actualSurveyId]
          );
        }

        // Use survey.user_id as field officer ID (the person who created the survey)
        // If assigned_to is set, prefer that, but user_id is the reliable source
        let fieldOfficerId: any = survey.user_id;

        // Only override if explicitly assigned to someone else (and not system user)
        if (survey.assigned_to && String(survey.assigned_to) !== '1') {
          fieldOfficerId = survey.assigned_to;
        }

        // CRITICAL: Validate that we have a valid field officer (not system user)
        if (!fieldOfficerId || String(fieldOfficerId) === '1') {
          Logger.error('CLARIFICATION_INVALID_FIELD_OFFICER', {
            survey_id: actualSurveyId,
            survey_user_id: survey.user_id,
            survey_assigned_to: survey.assigned_to,
            resolved_field_officer_id: fieldOfficerId,
          });
          return NextResponse.json(
            { ok: false, error: 'Survey creator is not a valid field officer. Cannot request clarification.' },
            { status: 400 }
          );
        }

        Logger.info('CLARIFICATION_FIELD_OFFICER_RESOLVED', {
          survey_id: actualSurveyId,
          survey_user_id: survey.user_id,
          survey_assigned_to: survey.assigned_to,
          field_officer_id: fieldOfficerId,
          source: survey.assigned_to && String(survey.assigned_to) !== '1' ? 'assigned_to' : 'user_id',
        });

      // Get field officer details for notification
      let [fieldOfficerRows]: any = await conn.query(
        `SELECT id, name, email, contact_number, user_type
         FROM users 
         WHERE id = ? LIMIT 1`,
        [fieldOfficerId]
      );
      let fieldOfficer = Array.isArray(fieldOfficerRows) && fieldOfficerRows.length > 0
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
      let fieldOfficerType = (fieldOfficer?.user_type || '').toLowerCase().trim();
      let isFieldOfficer = fieldOfficerType === 'field_officer' || fieldOfficerType === 'field officer';
      if (!fieldOfficer || !isFieldOfficer) {
        Logger.error('CLARIFICATION_FIELD_OFFICER_INVALID', {
          field_officer_id: fieldOfficerId,
          user_type: fieldOfficer?.user_type,
          survey_id: actualSurveyId,
        });

        // Fallback: prefer Aadhaar uploader if the current user is missing or not a field officer
        if (survey.aadhar_user_id && String(survey.aadhar_user_id) !== String(fieldOfficerId)) {
          fieldOfficerId = survey.aadhar_user_id;
          [fieldOfficerRows] = await conn.query(
            `SELECT id, name, email, contact_number, user_type
             FROM users
             WHERE id = ? LIMIT 1`,
            [fieldOfficerId]
          );
          fieldOfficer = Array.isArray(fieldOfficerRows) && fieldOfficerRows.length > 0
            ? fieldOfficerRows[0]
            : null;
          fieldOfficerType = (fieldOfficer?.user_type || '').toLowerCase().trim();
          isFieldOfficer = fieldOfficerType === 'field_officer' || fieldOfficerType === 'field officer';
        }

        // Fallback: use latest assignment if still missing or not a field officer
        const [assignmentRows]: any = await conn.query(
          `SELECT field_officer_id FROM survey_assignments
           WHERE survey_id = ?
           ORDER BY assigned_at DESC LIMIT 1`,
          [actualSurveyId]
        );
        if (Array.isArray(assignmentRows) && assignmentRows.length > 0) {
          const assignedFieldOfficerId = assignmentRows[0].field_officer_id;
          if (assignedFieldOfficerId && String(assignedFieldOfficerId) !== String(fieldOfficerId)) {
            fieldOfficerId = assignedFieldOfficerId;
            [fieldOfficerRows] = await conn.query(
              `SELECT id, name, email, contact_number, user_type
               FROM users
               WHERE id = ? LIMIT 1`,
              [fieldOfficerId]
            );
            fieldOfficer = Array.isArray(fieldOfficerRows) && fieldOfficerRows.length > 0
              ? fieldOfficerRows[0]
              : null;
            fieldOfficerType = (fieldOfficer?.user_type || '').toLowerCase().trim();
            isFieldOfficer = fieldOfficerType === 'field_officer' || fieldOfficerType === 'field officer';
          }
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
            survey_id: String(actualSurveyId),  // Correct: surveys.id (46)
            survey_aadhar_id: String(survey.aadhaar_id), // Keep for backward compatibility
            aadhaar_id: String(survey.aadhaar_id),
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
            `INSERT INTO notifications (user_id, from_user_id, field_officer_id, type, title, message, data, is_read)
             VALUES (?, ?, ?, 'clarification_request', ?, ?, ?, 0)`,
            [fieldOfficerId, user.id, fieldOfficerId, notificationTitle, notificationMessage, notificationData]
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

          // Notify admins that this verification officer has raised clarification
          try {
            const [adminRows]: any = await conn.query(
              `SELECT id, name
               FROM users
               WHERE LOWER(TRIM(user_type)) IN ('admin', 'administrator')`
            );

            if (Array.isArray(adminRows) && adminRows.length > 0) {
              const adminTitle = `स्पष्टीकरण विनंती: ${holderName}`;
              const adminMessage = `${user.name || 'Verification Officer'} यांनी ${fieldOfficer?.name || `FO #${fieldOfficerId}`} कडून ${questions.length} प्रश्नांसाठी स्पष्टीकरण मागितले आहे.`;
              const adminData = JSON.stringify({
                survey_id: String(actualSurveyId),
                survey_aadhar_id: String(survey.aadhaar_id),
                holder_name: holderName,
                aadhar_no: aadharNo,
                verification_officer_id: Number(user.id),
                verification_officer_name: user.name || null,
                field_officer_id: Number(fieldOfficerId),
                field_officer_name: fieldOfficer?.name || null,
                action: 'reclarification_requested',
                question_ids: questionIds,
              });

              for (const admin of adminRows) {
                await conn.query(
                  `INSERT INTO notifications (user_id, from_user_id, field_officer_id, type, title, message, data, is_read)
                   VALUES (?, ?, ?, 'general', ?, ?, ?, 0)`,
                  [admin.id, user.id, fieldOfficerId, adminTitle, adminMessage, adminData]
                );
              }
            }
          } catch (adminNotifyError: any) {
            Logger.error('ADMIN_RECLARIFICATION_NOTIFICATION_ERROR', {
              error: adminNotifyError?.message,
              survey_id: actualSurveyId,
            });
          }

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

      // Get the survey record to also check by aadhaar_id
      const [surveyDetails]: any = await conn.query(
        `SELECT s.id, s.aadhaar_id FROM surveys s WHERE s.id = ? LIMIT 1`,
        [actualSurveyId]
      );

      const aadhaarId = (Array.isArray(surveyDetails) && surveyDetails.length > 0) ? surveyDetails[0].aadhaar_id : null;

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
         WHERE qc.survey_id = ? OR qc.survey_id = ?
         ORDER BY qc.created_at DESC`,
        [actualSurveyId, aadhaarId]
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

