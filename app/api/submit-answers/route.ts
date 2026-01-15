import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { requireAuth, verifyAuth } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';
import { autoAssignSurveys } from '@/lib/auto-assign-surveys';
import { sendFormCompletionSMS } from '@/lib/sms';

/**
 * Generate short form for village/taluka name
 * Takes first 4-6 uppercase characters, removes spaces and special characters
 */
function generateShortForm(name: string): string {
  if (!name || typeof name !== 'string') return 'XXXX';

  // Remove spaces, special characters, and convert to uppercase
  let cleaned = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') // Remove all non-alphanumeric
    .replace(/\s+/g, ''); // Remove spaces

  // Take first 4-6 characters
  if (cleaned.length <= 4) {
    return cleaned.padEnd(4, 'X'); // Pad if too short
  } else if (cleaned.length >= 6) {
    return cleaned.substring(0, 6);
  } else {
    return cleaned;
  }
}

/**
 * Get current time in Asia/Kolkata timezone
 */
function getISTDate(): Date {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const nd = new Date(utc + (3600000 * 5.5)); // Add +5:30
  return nd;
}

/**
 * Get ISO string for IST (without Z, appended with +05:30)
 */
function getISTISOString(): string {
  const ist = getISTDate();
  return ist.toISOString().replace('Z', '+05:30');
}

/**
 * Generate registration number for public form submissions
 * Format: DDRC/DIVYANG/MMYY/GAAV_SHORT/TALUKA_SHORT/AADHAR_LAST4
 * Example: DDRC/DIVYANG/0224/SHIRD/RAHAT/5678
 */
function generateRegistrationNumber(
  aadhaarId: number,
  village: string | null,
  taluka: string | null
): string {
  // Get current month and year (MMYY format) in IST
  const now = getISTDate();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 01-12
  const year = String(now.getFullYear()).slice(-2); // Last 2 digits
  const mmYY = `${month}${year}`;

  // Get last 4 digits of Aadhaar
  const aadhaarStr = String(aadhaarId);
  const aadhaarLast4 = aadhaarStr.length >= 4
    ? aadhaarStr.slice(-4)
    : aadhaarStr.padStart(4, '0');

  // Generate short forms
  const villageShort = village ? generateShortForm(village) : 'XXXX';
  const talukaShort = taluka ? generateShortForm(taluka) : 'XXXX';

  // Format: DDRC/DIVYANG/MMYY/TALUKA_SHORT/GAAV_SHORT/AADHAR_LAST4
  return `DDRC/DIVYANG/${mmYY}/${talukaShort}/${villageShort}/${aadhaarLast4}`;
}

/**
 * @swagger
 * /api/submit-answers:
 *   post:
 *     summary: Submit survey answers
 *     tags: [Answers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - aadhar_id
 *               - items
 *             properties:
 *               user_id:
 *                 type: numberR
 *               aadhar_id:
 *                 type: number
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     question_id:
 *                       type: number
 *                     section_id:
 *                       type: number
 *                     answer:
 *                       type: string
 *     responses:
 *       200:
 *         description: Answers submitted successfully
 *       422:
 *         description: Invalid data
 */
export async function handleSubmit(request: NextRequest, user: any) {
  try {
    // Robust body parsing for various clients/shells
    const contentType = request.headers.get('content-type') || '';
    let body: any = {};
    try {
      if (contentType.includes('application/json')) {
        // Prefer native JSON parser when declared
        body = await request.json();
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const raw = await request.text();
        const params = new URLSearchParams(raw);
        const obj: Record<string, any> = {};
        params.forEach((v, k) => { obj[k] = v; });
        // Allow a 'json' field to carry the whole payload
        if (obj.json) {
          body = JSON.parse(String(obj.json));
        } else {
          body = obj;
        }


      } else {
        // Fallback: try text->JSON, else attempt URLSearchParams
        const raw = await request.text();
        const sanitized = (raw || '').replace(/^\uFEFF/, '').trim();
        try {
          body = sanitized ? JSON.parse(sanitized) : {};
        } catch {
          const params = new URLSearchParams(sanitized);
          const obj: Record<string, any> = {};
          params.forEach((v, k) => { obj[k] = v; });
          body = obj;
        }
      }
    } catch (e: any) {
      Logger.error('submit_answers_parse_failed', {
        error: e?.message || String(e),
        contentType,
      });
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }
    let userId = Number(user?.id || 0);
    // Fallbacks: accept explicit user_id or user_phone if auth not present
    if (!userId || userId <= 0) {
      if (body.user_id) {
        userId = parseInt(String(body.user_id));
      } else if (body.user_phone) {
        const phone = String(body.user_phone).replace(/\D/g, '');
        if (phone) {
          try {
            const pool0 = getDbPool();
            const [u] = await pool0.query(`SELECT id FROM users WHERE contact_number = ? LIMIT 1`, [phone]);
            if (Array.isArray(u) && (u as any[]).length > 0) {
              userId = (u as any[])[0].id as number;
            }
          } catch { }
        }
      }
    }
    // Accept both spellings from clients; prefer aadhaar_id
    const aadhaarId = parseInt(body.aadhaar_id || body.aadhar_id || '0');
    const items = Array.isArray(body.items) ? body.items : [];
    const campIdRaw = body.camp_id !== undefined && body.camp_id !== null
      ? parseInt(String(body.camp_id))
      : NaN;
    const campId = Number.isFinite(campIdRaw) ? campIdRaw : 0;

    // Get source from body, or determine from user context
    // For authenticated field officers, always use their name as source
    let source = '';
    if (user) {
      // Check if user is a field officer
      const userType = (user.user_type || '').toLowerCase();
      if (userType === 'field_officer' || userType === 'field officer') {
        // Field officers always use their name as source
        source = user.name || `Field Officer ${user.id}`;
      } else {
        // For other authenticated users, use body source if provided
        source = body.source || '';
      }
    } else {
      // For unauthenticated (public) submissions, use body source or default
      source = body.source || '';
    }
    // Default to "Divyang Self" if no source provided (public submissions)
    if (!source) {
      source = 'Divyang Self';
    }

    if (userId <= 0 || aadhaarId <= 0 || !Array.isArray(items)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid data' },
        { status: 422 }
      );
    }

    const normalizedItems: { question_id: number; section_id: number | null; answer: string }[] = [];
    for (const item of items) {
      const qid = parseInt(item?.question_id ?? item?.questionId ?? '0');
      if (!Number.isFinite(qid) || qid <= 0) continue;
      const sid = item?.section_id ? parseInt(item.section_id) : (item?.sectionId ? parseInt(item.sectionId) : null);
      let answerValue = '';
      if (Array.isArray(item?.answer)) {
        try {
          answerValue = JSON.stringify(item.answer);
        } catch {
          answerValue = item.answer.join(', ');
        }
      } else if (item?.answer === null || item?.answer === undefined) {
        answerValue = '';
      } else {
        answerValue = String(item.answer);
      }
      answerValue = answerValue.trim();
      if (!answerValue) answerValue = '--';
      normalizedItems.push({
        question_id: qid,
        section_id: Number.isFinite(sid || 0) ? sid : null,
        answer: answerValue,
      });
    }

    if (normalizedItems.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No valid answers provided' },
        { status: 422 }
      );
    }

    let pool;
    let connection;

    // Extract taluka, village, and district for logging/registration use
    let logTaluka: string | null = null;
    let logVillage: string | null = null;
    let logDistrict: string | null = null;
    try {
      const talukaAnswer = normalizedItems.find((item: any) =>
        item.question_id === 47 || item.question_id === 28
      );
      // District: 46 (Field), 27 (Public), 48 (Legacy fallback)
      const districtAnswer = normalizedItems.find((item: any) =>
        item.question_id === 46 || item.question_id === 27 || item.question_id === 48
      );
      const villageAnswer = normalizedItems.find((item: any) =>
        item.question_id === 49 || item.question_id === 30
      );

      if (talukaAnswer && talukaAnswer.answer) {
        logTaluka = String(talukaAnswer.answer).trim();
        if (logTaluka === '' || logTaluka === '--') logTaluka = null;
      }

      if (districtAnswer && districtAnswer.answer) {
        logDistrict = String(districtAnswer.answer).trim();
        if (logDistrict === '' || logDistrict === '--') logDistrict = null;
      }

      if (villageAnswer && villageAnswer.answer) {
        logVillage = String(villageAnswer.answer).trim();
        if (logVillage === '' || logVillage === '--') logVillage = null;
      }
    } catch (locationParseError: any) {
      Logger.info('submit_answers_location_parse_failed', {
        error: locationParseError?.message,
        aadhaar_id: aadhaarId,
      });
    }

    try {
      pool = getDbPool();
    } catch (poolError: any) {
      Logger.error('submit_answers_pool_failed', { error: poolError.message, stack: poolError.stack });
      return NextResponse.json(
        { ok: false, error: 'Database connection failed. Please try again.' },
        { status: 500 }
      );
    }

    try {
      connection = await pool.getConnection();
    } catch (connError: any) {
      Logger.error('submit_answers_connection_failed', { error: connError.message, stack: connError.stack });
      return NextResponse.json(
        { ok: false, error: 'Database connection failed. Please try again.' },
        { status: 500 }
      );
    }

    let earlyReturnResponse: NextResponse | null = null;

    try {
      // Validate that survey_aadhar entry exists
      try {
        const [aadhaarRows] = await connection.query(
          'SELECT id, aadhar_no FROM survey_aadhar WHERE id = ? LIMIT 1',
          [aadhaarId]
        );
        if (!Array.isArray(aadhaarRows) || (aadhaarRows as any[]).length === 0) {
          Logger.error('submit_answers_aadhaar_not_found', { aadhaar_id: aadhaarId });
          earlyReturnResponse = NextResponse.json(
            { ok: false, error: 'Aadhaar entry not found in survey_aadhar. Create Aadhaar first.' },
            { status: 422 }
          );
          return;
        }
      } catch (e: any) {
        Logger.error('aadhaar_lookup_failed', {
          error: e?.message || String(e),
          stack: e?.stack,
          aadhaar_id: aadhaarId
        });
        earlyReturnResponse = NextResponse.json(
          { ok: false, error: 'Aadhaar lookup failed' },
          { status: 500 }
        );
        return;
      }

      // Ensure surveys and survey_files tables exist with correct structure
      try {
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS surveys (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            aadhaar_id BIGINT UNSIGNED NOT NULL,
            no_of_questions_answered INT NOT NULL DEFAULT 0,
            no_of_questions_unanswered INT NOT NULL DEFAULT 0,
            survey_json LONGTEXT NULL,
            json_path VARCHAR(255) NULL,
            source VARCHAR(255) NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY unique_aadhaar_id (aadhaar_id),
            KEY idx_user_id (user_id),
            KEY idx_aadhaar_id (aadhaar_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      } catch (createError: any) {
        Logger.error('submit_answers_create_surveys_table_failed', {
          error: createError.message,
          note: 'Table might already exist'
        });
        // Continue - table might already exist
      }

      try {
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS survey_files (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            aadhaar_id BIGINT UNSIGNED NOT NULL,
            file_type ENUM('aadhaar_front','aadhaar_back','udid','certificate','other') NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_user_id (user_id),
            KEY idx_aadhaar_id (aadhaar_id),
            KEY idx_file_type (file_type)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      } catch (createError: any) {
        Logger.error('submit_answers_create_survey_files_table_failed', {
          error: createError.message,
          note: 'Table might already exist'
        });
        // Continue - table might already exist
      }

      // Fetch Aadhaar metadata for naming / surveys table
      let aadhaarNumber: string | null = null;
      let holderName: string | null = null;
      try {
        const [aRows] = await connection.query(
          'SELECT aadhar_no, holder_name FROM survey_aadhar WHERE id = ? LIMIT 1',
          [aadhaarId]
        );
        if (Array.isArray(aRows) && (aRows as any[]).length > 0) {
          const meta = (aRows as any[])[0];
          aadhaarNumber = meta?.aadhar_no?.toString() ?? null;
          holderName = meta?.holder_name?.toString() ?? null;
        } else {
          const [legacyRows] = await connection.query(
            'SELECT aadhaar_number FROM aadhaars WHERE id = ? LIMIT 1',
            [aadhaarId]
          );
          if (Array.isArray(legacyRows) && (legacyRows as any[]).length > 0) {
            aadhaarNumber = (legacyRows as any[])[0]?.aadhaar_number?.toString() ?? null;
          }
        }
      } catch (metaError) {
        Logger.info('submit_answers_meta_lookup_failed', { error: (metaError as any)?.message });
      }

      const safeName = (holderName || 'survey')
        .toString()
        .trim()
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'survey';
      const digits = (aadhaarNumber || '').replace(/\D+/g, '') || `${aadhaarId}`;
      const responsePayload = {
        user_id: userId,
        aadhaar_id: aadhaarId,
        aadhaar_number: aadhaarNumber,
        holder_name: holderName,
        submitted_at: getISTISOString(),
        answers: normalizedItems,
      };
      // Write JSON file to disk
      let relativePath: string = '';
      try {
        const surveysDir = path.join(process.cwd(), 'surveys');
        try {
          await fs.mkdir(surveysDir, { recursive: true });
        } catch (mkdirError: any) {
          Logger.error('submit_answers_mkdir_failed', {
            error: mkdirError.message,
            surveysDir
          });
          // Continue - directory might already exist
        }
        const fileName = `${safeName}_${digits}.json`;
        const filePath = path.join(surveysDir, fileName);
        try {
          await fs.writeFile(filePath, JSON.stringify(responsePayload, null, 2), 'utf8');
          relativePath = path.join('surveys', fileName);
        } catch (writeError: any) {
          Logger.error('submit_answers_file_write_failed', {
            error: writeError.message,
            stack: writeError.stack,
            filePath,
            aadhaar_id: aadhaarId
          });
          // Continue without file path if file write fails
          relativePath = '';
        }
      } catch (fileError: any) {
        Logger.error('submit_answers_file_operation_failed', {
          error: fileError.message,
          stack: fileError.stack,
          aadhaar_id: aadhaarId
        });
        // Continue without file path if file operation fails
        relativePath = '';
      }

      let responseJson: string;
      try {
        responseJson = JSON.stringify(responsePayload);
      } catch (jsonError: any) {
        Logger.error('submit_answers_json_stringify_failed', {
          error: jsonError.message,
          aadhaar_id: aadhaarId
        });
        throw new Error('Failed to serialize survey data. Please try again.');
      }

      // Ensure required columns exist (migration support)
      try {
        const [surveyCols] = await connection.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'surveys'`
        );
        const surveyColumnNames = Array.isArray(surveyCols)
          ? (surveyCols as any[]).map(c => c.COLUMN_NAME.toLowerCase())
          : [];
        const ensureColumn = async (col: string, definition: string) => {
          if (!surveyColumnNames.includes(col.toLowerCase())) {
            try {
              await connection.execute(`ALTER TABLE surveys ADD COLUMN ${definition}`);
              surveyColumnNames.push(col.toLowerCase());
            } catch (alterError: any) {
              Logger.info('submit_answers_column_add_failed', {
                column: col,
                error: alterError.message,
                note: 'Column might already exist'
              });
            }
          }
        };
        await ensureColumn('aadhaar_id', 'aadhaar_id BIGINT UNSIGNED NOT NULL');
        await ensureColumn('no_of_questions_answered', 'no_of_questions_answered INT NOT NULL DEFAULT 0');
        await ensureColumn('no_of_questions_unanswered', 'no_of_questions_unanswered INT NOT NULL DEFAULT 0');
        await ensureColumn('survey_json', 'survey_json LONGTEXT NULL');
        await ensureColumn('json_path', 'json_path VARCHAR(255) NULL');
        await ensureColumn('source', 'source VARCHAR(255) NULL');
        await ensureColumn('registration_number', 'registration_number VARCHAR(100) NULL');

        // Add unique constraint if it doesn't exist
        try {
          await connection.execute(`
            ALTER TABLE surveys 
            ADD UNIQUE KEY unique_aadhaar_id (aadhaar_id)
          `);
        } catch (e: any) {
          // Ignore if constraint already exists
          if (!e.message?.includes('Duplicate key name') && !e.message?.includes('Duplicate entry')) {
            Logger.info('submit_answers_unique_constraint_failed', { error: e.message });
          }
        }
      } catch (migrationError: any) {
        Logger.error('submit_answers_migration_failed', {
          error: migrationError.message,
          note: 'Continuing with existing table structure'
        });
        // Continue - table might already have correct structure
      }

      // Count answered vs unanswered from the current submission
      const answeredCount = normalizedItems.filter(item => {
        const ans = item.answer?.toString().trim() || '';
        return ans !== '' && ans !== '--';
      }).length;
      const unansweredCount = normalizedItems.filter(item => {
        const ans = item.answer?.toString().trim() || '';
        return ans === '' || ans === '--';
      }).length;

      // Check if survey exists for this aadhar_id and update/insert accordingly
      let surveyId: number | null = null;
      try {
        const [existingSurvey] = await connection.query(
          'SELECT id, survey_json FROM surveys WHERE aadhaar_id = ? LIMIT 1',
          [aadhaarId]
        );

        if (Array.isArray(existingSurvey) && (existingSurvey as any[]).length > 0) {
          // Update existing survey record
          const existing = (existingSurvey as any[])[0];
          surveyId = existing.id;

          // Merge with existing JSON if it exists
          let mergedJson = responsePayload;
          if (existing.survey_json) {
            try {
              const existingJson = typeof existing.survey_json === 'string'
                ? JSON.parse(existing.survey_json)
                : existing.survey_json;
              // Merge answers: update existing or add new
              const existingAnswers = existingJson.answers || [];
              const answerMap = new Map();
              existingAnswers.forEach((a: any) => {
                const key = `${a.section_id}_${a.question_id}`;
                answerMap.set(key, a);
              });
              normalizedItems.forEach((item: any) => {
                const key = `${item.section_id}_${item.question_id}`;
                answerMap.set(key, item);
              });
              mergedJson = {
                ...existingJson,
                ...responsePayload,
                answers: Array.from(answerMap.values()),
                updated_at: getISTISOString(),
              };
            } catch (mergeError) {
              Logger.info('submit_answers_json_merge_failed', { error: (mergeError as any)?.message });
              mergedJson = responsePayload;
            }
          }

          // Recalculate totals from merged JSON
          const allAnswers = mergedJson.answers || [];
          const totalAnswered = allAnswers.filter((a: any) => {
            const ans = String(a.answer || '').trim();
            return ans !== '' && ans !== '--';
          }).length;
          const totalUnanswered = allAnswers.filter((a: any) => {
            const ans = String(a.answer || '').trim();
            return ans === '' || ans === '--';
          }).length;

          let mergedJsonString: string;
          try {
            mergedJsonString = JSON.stringify(mergedJson);
          } catch (stringifyError: any) {
            Logger.error('submit_answers_merged_json_stringify_failed', {
              error: stringifyError.message,
              aadhaar_id: aadhaarId
            });
            throw new Error('Failed to serialize merged survey data. Please try again.');
          }

          await connection.execute(
            `UPDATE surveys 
             SET no_of_questions_answered = ?,
                 no_of_questions_unanswered = ?,
                 survey_json = ?,
                 json_path = ?,
                 source = ?,
                 updated_at = NOW()
             WHERE aadhaar_id = ?`,
            [totalAnswered, totalUnanswered, mergedJsonString, relativePath, source, aadhaarId]
          );

          // Mark clarifications as resolved for any questions that were answered in this submission
          // This handles the case where field officer responds to clarification requests
          if (surveyId && normalizedItems.length > 0) {
            try {
              const questionIds = normalizedItems
                .filter(item => {
                  const ans = String(item.answer || '').trim();
                  return ans !== '' && ans !== '--';
                })
                .map(item => item.question_id);

              if (questionIds.length > 0) {
                await connection.query(
                  `UPDATE question_clarifications 
                   SET status = 'resolved', 
                       resolved_at = NOW(),
                       updated_at = NOW()
                   WHERE survey_id = ? AND question_id IN (?) AND status = 'pending'`,
                  [surveyId, questionIds]
                );
              }
            } catch (clarError: any) {
              // Non-blocking error - log but don't fail the request
              Logger.error('CLARIFICATION_RESOLVE_ON_SUBMIT_ERROR', {
                error: clarError.message,
                survey_id: surveyId,
                aadhaar_id: aadhaarId
              });
            }
          }

          Logger.info('submit_answers_survey_updated', {
            survey_id: surveyId,
            aadhaar_id: aadhaarId,
            answered: totalAnswered,
            unanswered: totalUnanswered,
          });
        } else {
          // Generate registration number for public form submissions
          let registrationNumber: string | null = null;
          if (source === 'Divyang Self' && userId === 1) {
            registrationNumber = generateRegistrationNumber(aadhaarId, logVillage, logTaluka);
            Logger.info('REGISTRATION_NUMBER_GENERATED', {
              registration_number: registrationNumber,
              aadhaar_id: aadhaarId,
              village: logVillage,
              taluka: logTaluka
            });
          }

          // Insert new survey record with JSON (with ON DUPLICATE KEY UPDATE as safety)
          try {
            const [insertSurvey] = await connection.execute(
              `INSERT INTO surveys (user_id, aadhaar_id, no_of_questions_answered, no_of_questions_unanswered, survey_json, json_path, source, registration_number, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
               ON DUPLICATE KEY UPDATE
                 no_of_questions_answered = VALUES(no_of_questions_answered),
                 no_of_questions_unanswered = VALUES(no_of_questions_unanswered),
                 survey_json = VALUES(survey_json),
                 json_path = VALUES(json_path),
                 source = VALUES(source),
                 registration_number = COALESCE(VALUES(registration_number), registration_number),
                 updated_at = NOW()`,
              [userId, aadhaarId, answeredCount, unansweredCount, responseJson, relativePath, source, registrationNumber]
            );

            if ((insertSurvey as any)?.insertId) {
              surveyId = (insertSurvey as any).insertId as number;
            } else {
              // If no insertId, it means it was an update - fetch the existing ID
              const [existing] = await connection.query(
                'SELECT id FROM surveys WHERE aadhaar_id = ? LIMIT 1',
                [aadhaarId]
              );
              if (Array.isArray(existing) && (existing as any[]).length > 0) {
                surveyId = (existing as any[])[0].id;
              }
            }

            // Log whether this was a new insert or an update
            const wasNewInsert = !!(insertSurvey as any)?.insertId;
            Logger.info(wasNewInsert ? 'submit_answers_survey_created' : 'submit_answers_survey_updated', {
              survey_id: surveyId,
              aadhaar_id: aadhaarId,
              answered: answeredCount,
              unanswered: unansweredCount,
              was_new_insert: wasNewInsert,
              insert_id: (insertSurvey as any)?.insertId || null
            });
          } catch (insertError: any) {
            // If duplicate key error occurs (race condition), try to update instead
            if (insertError.code === 'ER_DUP_ENTRY' || insertError.message?.includes('Duplicate entry')) {
              Logger.info('submit_answers_duplicate_detected_race_condition', { aadhaar_id: aadhaarId });
              // Fetch existing survey and update it
              const [existing] = await connection.query(
                'SELECT id, survey_json FROM surveys WHERE aadhaar_id = ? LIMIT 1',
                [aadhaarId]
              );
              if (Array.isArray(existing) && (existing as any[]).length > 0) {
                const existingSurvey = (existing as any[])[0];
                surveyId = existingSurvey.id;
                // Update with new data
                await connection.execute(
                  `UPDATE surveys 
                   SET no_of_questions_answered = ?,
                       no_of_questions_unanswered = ?,
                       survey_json = ?,
                       json_path = ?,
                       source = ?,
                       updated_at = NOW()
                   WHERE aadhaar_id = ?`,
                  [answeredCount, unansweredCount, responseJson, relativePath, source, aadhaarId]
                );
                Logger.info('submit_answers_survey_updated_after_duplicate', {
                  survey_id: surveyId,
                  aadhaar_id: aadhaarId,
                });
              } else {
                throw insertError;
              }
            } else {
              throw insertError;
            }
          }
        }
      } catch (surveyError: any) {
        Logger.error('submit_answers_survey_record_failed', {
          error: surveyError?.message,
          stack: surveyError?.stack,
          aadhaar_id: aadhaarId,
          user_id: userId
        });
        // Don't fail the entire request if survey record update fails
        // The JSON file is already saved
      }

      // Update survey_aadhar with taluka/district if we found them and they're not already set
      try {
        // Update survey_aadhar with taluka/district if we found them and they're not already set
        if (logTaluka || logDistrict) {
          const updateFields: string[] = [];
          const updateValues: any[] = [];

          if (logTaluka) {
            updateFields.push('taluka = COALESCE(?, taluka)');
            updateValues.push(logTaluka);
          }

          if (logDistrict) {
            updateFields.push('district = COALESCE(?, district)');
            updateValues.push(logDistrict);
          }

          if (updateFields.length > 0) {
            updateValues.push(aadhaarId);
            await connection.execute(
              `UPDATE survey_aadhar SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
              updateValues
            );

            Logger.info('submit_answers_updated_survey_aadhar', {
              aadhaar_id: aadhaarId,
              taluka: logTaluka,
              district: logDistrict,
            });
          }
        }
      } catch (updateError: any) {
        // Don't fail the entire request if taluka/district update fails
        Logger.info('submit_answers_taluka_district_update_failed', {
          error: updateError?.message,
          aadhaar_id: aadhaarId,
        });
      }

      // If survey is fully completed (no unanswered questions), mark the assignment-tracking row as completed
      if (unansweredCount === 0 && surveyId && userId) {
        try {
          await connection.execute(`
             UPDATE survey_assignments 
             SET status = 'completed', completed_at = NOW()
             WHERE survey_id = ? AND field_officer_id = ?
           `, [surveyId, userId]);
        } catch (completeError) {
          // Non-blocking error
          Logger.info('submit_answers_assignment_complete_error', {
            error: (completeError as any)?.message,
            survey_id: surveyId
          });
        }
      }

      Logger.info('submit_answers', {
        aadhaar_id: aadhaarId,
        survey_id: surveyId,
        answers_count: normalizedItems.length,
        answered: answeredCount,
        unanswered: unansweredCount,
        json_path: relativePath
      });

      // LOG ACTIVITY every time a submission happens
      try {
        await connection.execute(
          `INSERT INTO survey_activity_logs (user_id, type, taluka, village, aadhaar_id, details) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            userId,
            'SECTION_SUBMITTED',
            logTaluka || null,
            logVillage || null,
            aadhaarId,
            JSON.stringify({
              survey_id: surveyId,
              answered_count: answeredCount,
              unanswered_count: unansweredCount,
              items_count: normalizedItems.length
            })
          ]
        );
      } catch (logError) {
        Logger.error('ACTIVITY_LOG_SUBMIT_FAILED', { error: (logError as any).message });
      }

      // Immediately trigger auto-assignment for public form submissions
      // (source = 'Divyang Self' and user_id = 1)
      Logger.info('AUTO_ASSIGN_TRIGGER_CHECK', {
        source,
        userId,
        surveyId,
        condition_met: source === 'Divyang Self' && userId === 1 && surveyId ? 'YES' : 'NO',
        reason: !surveyId ? 'surveyId is null/undefined' :
          source !== 'Divyang Self' ? 'source mismatch' :
            userId !== 1 ? 'userId mismatch' : 'OK'
      });

      // Determine if this is a field officer submission (fully completed form)
      const isFieldOfficerSubmission = source !== 'Divyang Self' && userId !== 1 && user &&
        ((user.user_type || '').toLowerCase() === 'field_officer' ||
          (user.user_type || '').toLowerCase() === 'field officer');

      if (source === 'Divyang Self' && userId === 1 && surveyId) {
        // Call auto-assignment asynchronously (fire and forget) so it doesn't delay the response
        Logger.info('AUTO_ASSIGN_TRIGGERING', { survey_id: surveyId });
        autoAssignSurveys(surveyId).then((result) => {
          Logger.info('AUTO_ASSIGN_COMPLETED', {
            survey_id: surveyId,
            result: result
          });
        }).catch((error) => {
          Logger.error('IMMEDIATE_AUTO_ASSIGN_FAILED', {
            survey_id: surveyId,
            error: error?.message || String(error),
            stack: error?.stack
          });
        });

        // Get registration number for SMS (for public forms only)
        let registrationNumberForSMS: string | undefined = undefined;
        try {
          const [regNumResult] = await connection.query(
            'SELECT registration_number FROM surveys WHERE id = ? LIMIT 1',
            [surveyId]
          );
          if (Array.isArray(regNumResult) && (regNumResult as any[]).length > 0) {
            registrationNumberForSMS = (regNumResult as any[])[0].registration_number || undefined;
          }
        } catch (regNumError) {
          Logger.warn('REGISTRATION_NUMBER_FETCH_FAILED', { survey_id: surveyId, error: regNumError });
        }

        // Send SMS to divyang after successful public form submission (fire and forget)
        // Use responsePayload which contains the survey data with answers
        try {
          if (responsePayload) {
            sendFormCompletionSMS(responsePayload, surveyId, false, registrationNumberForSMS).then((smsResult) => {
              if (smsResult.ok) {
                Logger.info('FORM_COMPLETION_SMS_SENT', {
                  survey_id: surveyId,
                  source: 'public',
                  phone: smsResult.phone ? smsResult.phone.substring(0, 3) + '****' + smsResult.phone.substring(7) : 'unknown'
                });
              } else {
                Logger.warn('FORM_COMPLETION_SMS_FAILED', {
                  survey_id: surveyId,
                  source: 'public',
                  error: smsResult.error,
                  phone: smsResult.phone ? smsResult.phone.substring(0, 3) + '****' + smsResult.phone.substring(7) : 'unknown'
                });
              }
            }).catch((smsError) => {
              Logger.error('FORM_COMPLETION_SMS_ERROR', {
                survey_id: surveyId,
                source: 'public',
                error: smsError?.message || String(smsError),
                stack: smsError?.stack
              });
            });
          } else {
            Logger.warn('FORM_COMPLETION_SMS_SKIPPED_NO_DATA', { survey_id: surveyId, source: 'public' });
          }
        } catch (smsInitError: any) {
          Logger.error('FORM_COMPLETION_SMS_INIT_ERROR', {
            survey_id: surveyId,
            source: 'public',
            error: smsInitError?.message || String(smsInitError)
          });
        }
      } else if (isFieldOfficerSubmission && surveyId) {
        // Send SMS to divyang after successful field officer form submission (fully completed)
        // Use responsePayload which contains the survey data with answers
        try {
          if (responsePayload) {
            sendFormCompletionSMS(responsePayload, surveyId, true).then((smsResult) => {
              if (smsResult.ok) {
                Logger.info('FORM_COMPLETION_SMS_SENT', {
                  survey_id: surveyId,
                  source: 'field_officer',
                  phone: smsResult.phone ? smsResult.phone.substring(0, 3) + '****' + smsResult.phone.substring(7) : 'unknown'
                });
              } else {
                Logger.warn('FORM_COMPLETION_SMS_FAILED', {
                  survey_id: surveyId,
                  source: 'field_officer',
                  error: smsResult.error,
                  phone: smsResult.phone ? smsResult.phone.substring(0, 3) + '****' + smsResult.phone.substring(7) : 'unknown'
                });
              }
            }).catch((smsError) => {
              Logger.error('FORM_COMPLETION_SMS_ERROR', {
                survey_id: surveyId,
                source: 'field_officer',
                error: smsError?.message || String(smsError),
                stack: smsError?.stack
              });
            });
          } else {
            Logger.warn('FORM_COMPLETION_SMS_SKIPPED_NO_DATA', { survey_id: surveyId, source: 'field_officer' });
          }
        } catch (smsInitError: any) {
          Logger.error('FORM_COMPLETION_SMS_INIT_ERROR', {
            survey_id: surveyId,
            source: 'field_officer',
            error: smsInitError?.message || String(smsInitError)
          });
        }
      } else {
        Logger.warn('AUTO_ASSIGN_NOT_TRIGGERED', {
          source,
          userId,
          surveyId,
          reason: !surveyId ? 'surveyId is null' :
            source !== 'Divyang Self' ? `source is '${source}' not 'Divyang Self'` :
              userId !== 1 ? `userId is ${userId} not 1` : 'unknown'
        });
      }

      // Store success response to return after connection release
      earlyReturnResponse = NextResponse.json({
        ok: true,
        saved: normalizedItems.length,
        survey_id: surveyId,
        json_path: relativePath,
        answered: answeredCount,
        unanswered: unansweredCount
      });
    } catch (dbError: any) {
      Logger.error('submit_answers_db_error', {
        error: dbError.message,
        stack: dbError.stack,
        aadhaar_id: aadhaarId,
        user_id: userId
      });
      // Store error response to return after connection release
      earlyReturnResponse = NextResponse.json(
        {
          ok: false,
          error: dbError.message || 'Database operation failed. Please try again.'
        },
        { status: 500 }
      );
    } finally {
      if (connection) {
        try {
          connection.release();
        } catch (releaseError: any) {
          Logger.error('submit_answers_connection_release_failed', { error: releaseError.message });
        }
      }
    }

    // Return the response after connection is released
    if (earlyReturnResponse) {
      return earlyReturnResponse;
    }
  } catch (error: any) {
    Logger.error('submit_answers_failed', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });

    // Return user-friendly error messages
    const errorMessage = error.message || 'An unexpected error occurred';
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT');
    const isConnectionError = errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND');

    return NextResponse.json(
      {
        ok: false,
        error: isTimeout || isConnectionError
          ? 'Database connection failed. Please try again.'
          : errorMessage
      },
      { status: 500 }
    );
  }
}

// Accept either authenticated requests (Authorization header / session cookie)
// or fallback to explicit identifiers in the JSON body (user_id or user_phone).
export const POST = async (request: NextRequest) => {
  try {
    let user: any = null;
    try {
      const authResult = await verifyAuth(request);
      user = authResult.user;
    } catch (authError: any) {
      Logger.info('submit_answers_auth_optional', {
        error: authError.message,
        note: 'Continuing without auth - will use user_id from body'
      });
      // Allow unauthenticated requests if user_id is provided in body
      user = null;
    }
    return await handleSubmit(request, user);
  } catch (error: any) {
    Logger.error('submit_answers_post_handler_failed', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'An unexpected error occurred. Please try again.'
      },
      { status: 500 }
    );
  }
};

