import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { requireAuth, verifyAuth } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

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
async function handleSubmit(request: NextRequest, user: any) {
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
          } catch {}
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

    try {
      // Validate that survey_aadhar entry exists
      try {
        const [aadhaarRows] = await connection.query(
          'SELECT id, aadhar_no FROM survey_aadhar WHERE id = ? LIMIT 1',
          [aadhaarId]
        );
        if (!Array.isArray(aadhaarRows) || (aadhaarRows as any[]).length === 0) {
          return NextResponse.json(
            { ok: false, error: 'Aadhaar entry not found in survey_aadhar. Create Aadhaar first.' },
            { status: 422 }
          );
        }
      } catch (e: any) {
        Logger.error('aadhaar_lookup_failed', { error: e?.message || String(e) });
        return NextResponse.json(
          { ok: false, error: 'Aadhaar lookup failed' },
          { status: 500 }
        );
      }

      // Ensure surveys and survey_files tables exist with correct structure
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS surveys (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NOT NULL,
          aadhaar_id BIGINT UNSIGNED NOT NULL,
          no_of_questions_answered INT NOT NULL DEFAULT 0,
          no_of_questions_unanswered INT NOT NULL DEFAULT 0,
          survey_json LONGTEXT NULL,
          json_path VARCHAR(255) NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY unique_aadhaar_id (aadhaar_id),
          KEY idx_user_id (user_id),
          KEY idx_aadhaar_id (aadhaar_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

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
        submitted_at: new Date().toISOString(),
        answers: normalizedItems,
      };
      // Write JSON file to disk
      let relativePath: string;
      try {
        const surveysDir = path.join(process.cwd(), 'surveys');
        await fs.mkdir(surveysDir, { recursive: true });
        const fileName = `${safeName}_${digits}.json`;
        const filePath = path.join(surveysDir, fileName);
        await fs.writeFile(filePath, JSON.stringify(responsePayload, null, 2), 'utf8');
        relativePath = path.join('surveys', fileName);
      } catch (fileError: any) {
        Logger.error('submit_answers_file_write_failed', { 
          error: fileError.message, 
          stack: fileError.stack,
          aadhaar_id: aadhaarId 
        });
        // Continue without file path if file write fails
        relativePath = '';
      }
      
      const responseJson = JSON.stringify(responsePayload);

      // Ensure surveys table has the new structure
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS surveys (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NOT NULL,
          aadhaar_id BIGINT UNSIGNED NOT NULL,
          no_of_questions_answered INT NOT NULL DEFAULT 0,
          no_of_questions_unanswered INT NOT NULL DEFAULT 0,
          survey_json LONGTEXT NULL,
          json_path VARCHAR(255) NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY unique_aadhaar_id (aadhaar_id),
          KEY idx_user_id (user_id),
          KEY idx_aadhaar_id (aadhaar_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      
      // Ensure required columns exist (migration support)
      const [surveyCols] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'surveys'`
      );
      const surveyColumnNames = Array.isArray(surveyCols)
        ? (surveyCols as any[]).map(c => c.COLUMN_NAME.toLowerCase())
        : [];
      const ensureColumn = async (col: string, definition: string) => {
        if (!surveyColumnNames.includes(col.toLowerCase())) {
          await connection.execute(`ALTER TABLE surveys ADD COLUMN ${definition}`);
          surveyColumnNames.push(col.toLowerCase());
        }
      };
      await ensureColumn('aadhaar_id', 'aadhaar_id BIGINT UNSIGNED NOT NULL');
      await ensureColumn('no_of_questions_answered', 'no_of_questions_answered INT NOT NULL DEFAULT 0');
      await ensureColumn('no_of_questions_unanswered', 'no_of_questions_unanswered INT NOT NULL DEFAULT 0');
      await ensureColumn('survey_json', 'survey_json LONGTEXT NULL');
      await ensureColumn('json_path', 'json_path VARCHAR(255) NULL');
      
      // Add unique constraint if it doesn't exist
      try {
        await connection.execute(`
          ALTER TABLE surveys 
          ADD UNIQUE KEY unique_aadhaar_id (aadhaar_id)
        `);
      } catch (e: any) {
        // Ignore if constraint already exists
        if (!e.message?.includes('Duplicate key name')) {
          Logger.info('submit_answers_unique_constraint_failed', { error: e.message });
        }
      }

      // Check if aadhar_id exists in survey_aadhar table
      const [aadharCheck] = await connection.query(
        'SELECT id FROM survey_aadhar WHERE id = ? LIMIT 1',
        [aadhaarId]
      );
      
      if (!Array.isArray(aadharCheck) || (aadharCheck as any[]).length === 0) {
        Logger.error('submit_answers_aadhar_not_found', { aadhaar_id: aadhaarId });
        return NextResponse.json(
          { ok: false, error: 'Aadhaar ID not found in survey_aadhar table' },
          { status: 404 }
        );
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
                updated_at: new Date().toISOString(),
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
          
          await connection.execute(
            `UPDATE surveys 
             SET no_of_questions_answered = ?,
                 no_of_questions_unanswered = ?,
                 survey_json = ?,
                 json_path = ?,
                 updated_at = NOW()
             WHERE aadhaar_id = ?`,
            [totalAnswered, totalUnanswered, JSON.stringify(mergedJson), relativePath, aadhaarId]
          );
          
          Logger.info('submit_answers_survey_updated', {
            survey_id: surveyId,
            aadhaar_id: aadhaarId,
            answered: totalAnswered,
            unanswered: totalUnanswered,
          });
        } else {
          // Insert new survey record with JSON
          const [insertSurvey] = await connection.execute(
            `INSERT INTO surveys (user_id, aadhaar_id, no_of_questions_answered, no_of_questions_unanswered, survey_json, json_path, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [userId, aadhaarId, answeredCount, unansweredCount, responseJson, relativePath]
          );
          
          if ((insertSurvey as any)?.insertId) {
            surveyId = (insertSurvey as any).insertId as number;
          }
          
          Logger.info('submit_answers_survey_created', {
            survey_id: surveyId,
            aadhaar_id: aadhaarId,
            answered: answeredCount,
            unanswered: unansweredCount,
          });
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

      Logger.info('submit_answers', { 
        aadhaar_id: aadhaarId, 
        survey_id: surveyId,
        answers_count: normalizedItems.length,
        answered: answeredCount,
        unanswered: unansweredCount,
        json_path: relativePath
      });
      return NextResponse.json({ 
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
      throw dbError; // Re-throw to be caught by outer catch
    } finally {
      if (connection) {
        try {
          connection.release();
        } catch (releaseError: any) {
          Logger.error('submit_answers_connection_release_failed', { error: releaseError.message });
        }
      }
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
    const { user } = await verifyAuth(request);
    return handleSubmit(request, user as any);
  } catch (authError: any) {
    Logger.error('submit_answers_auth_failed', { 
      error: authError.message,
      stack: authError.stack
    });
    // Allow unauthenticated requests if user_id is provided in body
    return handleSubmit(request, null);
  }
};

