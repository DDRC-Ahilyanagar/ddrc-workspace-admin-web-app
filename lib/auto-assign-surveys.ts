import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { getAllLocations, isOnline } from '@/lib/location-store';
import { sendFCMPushNotification } from './fcm';

/**
 * Extract village/GAV from survey_json
 */
function extractVillageFromSurveyJson(surveyJson: any, villageQuestionId: number | string): string | null {
  if (!surveyJson || typeof surveyJson !== 'object') {
    return null;
  }

  try {
    // Normalize question ID to handle both string and number
    const targetId = typeof villageQuestionId === 'string' ? parseInt(villageQuestionId, 10) : villageQuestionId;
    const targetIdStr = String(villageQuestionId);

    // Try different structures
    // Structure 1: surveyJson.answers is an array
    if (Array.isArray(surveyJson.answers)) {
      const villageAnswer = surveyJson.answers.find((ans: any) => {
        // Try matching as number
        const qidNum = Number(ans.question_id || ans.questionId || 0);
        // Try matching as string
        const qidStr = String(ans.question_id || ans.questionId || '');
        return qidNum === targetId || qidStr === targetIdStr || qidStr === String(targetId);
      });
      if (villageAnswer) {
        const answer = String(villageAnswer.answer || villageAnswer.value || '').trim();
        // Don't return placeholder values
        if (answer && answer !== '--Select--' && answer !== '--' && answer !== 'null' && answer !== 'undefined') {
          return answer;
        }
      }
    }

    // Structure 2: surveyJson[villageQuestionId] directly (as number or string key)
    if (surveyJson[targetId]) {
      const answer = String(surveyJson[targetId]).trim();
      if (answer && answer !== '--Select--' && answer !== '--') {
        return answer;
      }
    }
    if (surveyJson[targetIdStr]) {
      const answer = String(surveyJson[targetIdStr]).trim();
      if (answer && answer !== '--Select--' && answer !== '--') {
        return answer;
      }
    }

    // Structure 3: surveyJson.answers is an object with question_id as keys
    if (surveyJson.answers && typeof surveyJson.answers === 'object' && !Array.isArray(surveyJson.answers)) {
      if (surveyJson.answers[targetId]) {
        const answer = String(surveyJson.answers[targetId]).trim();
        if (answer && answer !== '--Select--' && answer !== '--') {
          return answer;
        }
      }
      if (surveyJson.answers[targetIdStr]) {
        const answer = String(surveyJson.answers[targetIdStr]).trim();
        if (answer && answer !== '--Select--' && answer !== '--') {
          return answer;
        }
      }
    }

    return null;
  } catch (error) {
    Logger.error('AUTO_ASSIGN_EXTRACT_VILLAGE_ERROR', {
      error: (error as any)?.message
    });
    return null;
  }
}

/**
 * Auto-assign a specific survey or all unassigned surveys
 * @param surveyId - Optional: specific survey ID to assign. If not provided, assigns all unassigned surveys
 * @returns Result object with assigned count and details
 */
export async function autoAssignSurveys(surveyId?: number): Promise<{
  ok: boolean;
  assigned: number;
  checked: number;
  message: string;
  details: any[];
}> {
  Logger.info('AUTO_ASSIGN_STARTED', { survey_id: surveyId, timestamp: new Date().toISOString() });
  const pool = getDbPool();
  const conn = await pool.getConnection();

  try {
    // Step 0: Ensure assignment table exists
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS survey_assignments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        survey_id BIGINT UNSIGNED NOT NULL,
        field_officer_id BIGINT UNSIGNED NOT NULL,
        source VARCHAR(255) DEFAULT 'Divyang Self',
        status ENUM('pending', 'completed') DEFAULT 'pending',
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        PRIMARY KEY (id),
        KEY idx_survey_id (survey_id),
        KEY idx_officer_status (field_officer_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Step 1: Get question IDs for village and taluka
    const [questionRows]: any = await conn.query(`
      SELECT id, question FROM questions 
      WHERE (question LIKE '%गाव%' OR question LIKE '%village%' OR question LIKE '%ग्राम%'
             OR question LIKE '%taluka%' OR question LIKE '%तालुका%' OR question LIKE '%ता.%')
      AND (status = 'Active' OR status IS NULL)
    `);

    let villageQuestionId: number | null = null;
    let talukaQuestionId: number | null = null;

    if (Array.isArray(questionRows)) {
      for (const row of questionRows) {
        const q = row.question.toLowerCase();
        // Prioritize exact matches or well-known labels if possible, but keywords work
        if (!villageQuestionId && (q.includes('गाव') || q.includes('village') || q.includes('ग्राम'))) {
          villageQuestionId = row.id;
        }
        if (!talukaQuestionId && (q.includes('taluka') || q.includes('तालुका') || q.includes('ता.'))) {
          talukaQuestionId = row.id;
        }
      }
    }

    if (!villageQuestionId) {
      Logger.error('AUTO_ASSIGN_NO_VILLAGE_QUESTION', { message: 'Village question not found' });
      return {
        ok: false,
        assigned: 0,
        checked: 0,
        message: 'Location questions (Village) not found',
        details: []
      };
    }

    // Step 2: Find unassigned surveys (source = 'Divyang Self' or 'Excel Import' and user_id = 1)
    // Exclude surveys that already have assignments in survey_assignments table
    // BUT: If a specific surveyId is provided, check if it exists and log why it's excluded
    // If surveyId is provided, only get that specific survey
    let query = `
      SELECT 
        s.id,
        s.aadhaar_id,
        s.survey_json,
        s.user_id,
        s.source,
        s.created_at
      FROM surveys s
      LEFT JOIN survey_assignments sa ON sa.survey_id = s.id
      WHERE (s.source = 'Divyang Self' OR s.source = 'Excel Import' OR s.source IS NULL)
      AND (s.user_id = 1 OR s.user_id IS NULL)
      AND s.survey_json IS NOT NULL
      AND s.survey_json != ''
      AND sa.id IS NULL
    `;

    const queryParams: any[] = [];
    if (surveyId) {
      query += ` AND s.id = ?`;
      queryParams.push(surveyId);
    }

    query += ` ORDER BY s.created_at DESC`;

    Logger.info('AUTO_ASSIGN_QUERY_EXECUTING', {
      survey_id: surveyId || 'all',
      query_has_survey_id_filter: !!surveyId,
      query_excludes_assignments: true
    });

    const [unassignedSurveys]: any = await conn.query(query, queryParams);

    Logger.info('AUTO_ASSIGN_QUERY_RESULT', {
      survey_id: surveyId || 'all',
      found_count: Array.isArray(unassignedSurveys) ? unassignedSurveys.length : 0,
      survey_ids_found: Array.isArray(unassignedSurveys) ? unassignedSurveys.map((s: any) => s.id) : []
    });

    // If a specific surveyId was requested but not found, check why
    if (surveyId && (!Array.isArray(unassignedSurveys) || unassignedSurveys.length === 0)) {
      // Check if survey exists but has an assignment
      const [existingAssignment]: any = await conn.query(`
        SELECT sa.id, sa.status, sa.field_officer_id, sa.assigned_at
        FROM survey_assignments sa
        WHERE sa.survey_id = ?
      `, [surveyId]);
      
      if (Array.isArray(existingAssignment) && existingAssignment.length > 0) {
        Logger.warn('AUTO_ASSIGN_SURVEY_ALREADY_ASSIGNED', {
          survey_id: surveyId,
          assignment_id: existingAssignment[0].id,
          status: existingAssignment[0].status,
          field_officer_id: existingAssignment[0].field_officer_id,
          assigned_at: existingAssignment[0].assigned_at,
          message: 'Survey already has an assignment in survey_assignments table'
        });
      } else {
        // Check if survey exists at all
        const [surveyCheck]: any = await conn.query(`
          SELECT id, user_id, source, survey_json IS NOT NULL as has_json
          FROM surveys
          WHERE id = ?
        `, [surveyId]);
        
        if (Array.isArray(surveyCheck) && surveyCheck.length > 0) {
          const survey = surveyCheck[0];
          Logger.warn('AUTO_ASSIGN_SURVEY_EXCLUDED', {
            survey_id: surveyId,
            user_id: survey.user_id,
            source: survey.source,
            has_json: survey.has_json,
            reason: survey.user_id !== 1 ? 'user_id is not 1' :
                    survey.source !== 'Divyang Self' ? `source is '${survey.source}' not 'Divyang Self'` :
                    !survey.has_json ? 'survey_json is NULL or empty' : 'unknown'
          });
        } else {
          Logger.warn('AUTO_ASSIGN_SURVEY_NOT_FOUND', {
            survey_id: surveyId,
            message: 'Survey does not exist in database'
          });
        }
      }
    }

    if (!Array.isArray(unassignedSurveys) || unassignedSurveys.length === 0) {
      Logger.info('AUTO_ASSIGN_NO_UNASSIGNED_SURVEYS', {
        count: 0,
        survey_id: surveyId
      });
      return {
        ok: true,
        assigned: 0,
        checked: 0,
        message: 'No unassigned surveys found',
        details: []
      };
    }

    Logger.info('AUTO_ASSIGN_FOUND_UNASSIGNED', {
      count: unassignedSurveys.length,
      survey_id: surveyId
    });

    // Normalize village name for matching (remove extra spaces, lowercase, trim)
    // This function is used throughout to ensure consistent matching
    const normalizeVillage = (v: string): string => {
      if (!v || typeof v !== 'string') return '';
      return v.toLowerCase().trim().replace(/\s+/g, ' ');
    };

    // Step 3: Get active field officers and their assigned villages from PROFILE
    const officerGavMap = new Map<number, any>(); // officer_id -> { taluka, villages[] }

    try {
      // Debug: Check what user 23's actual values are
      const [user23Check]: any = await conn.query(`
        SELECT id, user_type, status, is_active 
        FROM users 
        WHERE id = 23
      `);
      
      // Check if profile exists
      const [profile23Check]: any = await conn.query(`
        SELECT id, user_id, primary_gaav, additional_gaavs, current_gaav, taluka
        FROM field_officer_profiles
        WHERE user_id = 23
      `);
      
      Logger.info('AUTO_ASSIGN_USER_23_CHECK', {
        user_23_data: Array.isArray(user23Check) && user23Check.length > 0 ? user23Check[0] : 'NOT FOUND',
        profile_23_data: Array.isArray(profile23Check) && profile23Check.length > 0 ? profile23Check[0] : 'NO PROFILE',
        matches_field_officer: Array.isArray(user23Check) && user23Check.length > 0 
          ? (user23Check[0].user_type === 'field_officer' || user23Check[0].user_type === 'field officer')
          : false,
        matches_status: Array.isArray(user23Check) && user23Check.length > 0
          ? (user23Check[0].status === 'active' || user23Check[0].status === null || user23Check[0].status === undefined)
          : false,
        matches_is_active: Array.isArray(user23Check) && user23Check.length > 0
          ? (user23Check[0].is_active === 1 || user23Check[0].is_active === true)
          : false,
        has_profile: Array.isArray(profile23Check) && profile23Check.length > 0
      });

      // Try the query with LEFT JOIN first to see if JOIN is the issue
      const [testQuery]: any = await conn.query(`
        SELECT u.id, u.user_type, u.status, u.is_active, p.id as profile_id
        FROM users u
        LEFT JOIN field_officer_profiles p ON u.id = p.user_id
        WHERE u.id = 23
      `);
      
      Logger.info('AUTO_ASSIGN_TEST_QUERY_USER_23', {
        test_query_result: Array.isArray(testQuery) && testQuery.length > 0 ? testQuery[0] : 'NOT FOUND'
      });

      // Query with flexible conditions - handle both boolean and integer is_active, and empty status
      let [activeOfficers]: any = await conn.query(`
        SELECT u.id, p.primary_gaav, p.additional_gaavs, p.taluka, p.current_gaav
        FROM users u
        JOIN field_officer_profiles p ON u.id = p.user_id
        WHERE (u.user_type = 'field_officer' OR u.user_type = 'field officer')
        AND (u.status = 'active' OR u.status IS NULL OR u.status = '')
        AND (u.is_active = 1 OR u.is_active = true OR u.is_active IS NULL)
      `);
      
      // If still 0, try without is_active check to see if that's the blocker
      if (!Array.isArray(activeOfficers) || activeOfficers.length === 0) {
        Logger.warn('AUTO_ASSIGN_QUERY_RETURNED_ZERO_WITH_IS_ACTIVE', {
          message: 'Query with is_active check returned 0, trying without is_active',
          user_23_data: Array.isArray(user23Check) && user23Check.length > 0 ? user23Check[0] : null
        });
        
        const [activeOfficersNoActiveCheck]: any = await conn.query(`
          SELECT u.id, p.primary_gaav, p.additional_gaavs, p.taluka, p.current_gaav
          FROM users u
          JOIN field_officer_profiles p ON u.id = p.user_id
          WHERE (u.user_type = 'field_officer' OR u.user_type = 'field officer')
          AND (u.status = 'active' OR u.status IS NULL OR u.status = '')
        `);
        
        Logger.info('AUTO_ASSIGN_QUERY_WITHOUT_IS_ACTIVE', {
          found_count: Array.isArray(activeOfficersNoActiveCheck) ? activeOfficersNoActiveCheck.length : 0,
          officer_ids: Array.isArray(activeOfficersNoActiveCheck) ? activeOfficersNoActiveCheck.map((o: any) => o.id) : []
        });
        
        // Use the results without is_active check if we found officers
        if (Array.isArray(activeOfficersNoActiveCheck) && activeOfficersNoActiveCheck.length > 0) {
          activeOfficers = activeOfficersNoActiveCheck;
        }
      }

      Logger.info('AUTO_ASSIGN_OFFICERS_QUERY_RESULT', {
        total_officers_found: Array.isArray(activeOfficers) ? activeOfficers.length : 0,
        officer_ids: Array.isArray(activeOfficers) ? activeOfficers.map((o: any) => ({
          id: o.id,
          has_primary_gaav: !!o.primary_gaav,
          has_additional_gaavs: !!o.additional_gaavs,
          has_current_gaav: !!o.current_gaav,
          primary_gaav: o.primary_gaav,
          current_gaav: o.current_gaav,
          additional_gaavs: o.additional_gaavs
        })) : []
      });

      if (Array.isArray(activeOfficers)) {
        for (const officer of activeOfficers) {
          const villages: string[] = [];

          // Add current_gaav first (highest priority for matching)
          if (officer.current_gaav) {
            const current = normalizeVillage(officer.current_gaav);
            if (current && !villages.includes(current)) {
              villages.push(current);
            }
          }

          // Add primary_gaav (one of the 3 gaavs)
          if (officer.primary_gaav) {
            const primary = normalizeVillage(officer.primary_gaav);
            if (primary && !villages.includes(primary)) {
              villages.push(primary);
            }
          }

          // Add additional_gaavs (the other 2 gaavs, total 3 gaavs)
          if (officer.additional_gaavs) {
            try {
              const add = typeof officer.additional_gaavs === 'string'
                ? JSON.parse(officer.additional_gaavs)
                : officer.additional_gaavs;
              if (Array.isArray(add)) {
                add.forEach((v: any) => {
                  const village = normalizeVillage(String(v));
                  if (village && !villages.includes(village)) {
                    villages.push(village);
                  }
                });
              } else {
                Logger.warn('AUTO_ASSIGN_ADDITIONAL_GAAVS_NOT_ARRAY', {
                  officer_id: officer.id,
                  additional_gaavs: officer.additional_gaavs,
                  parsed_type: typeof add
                });
              }
            } catch (e: any) {
              Logger.error('AUTO_ASSIGN_PARSE_ADDITIONAL_GAAVS_ERROR', {
                officer_id: officer.id,
                additional_gaavs: officer.additional_gaavs,
                error: e?.message || String(e)
              });
            }
          }

          const taluka = officer.taluka ? normalizeVillage(officer.taluka) : null;

          // Only include officers who have at least one gaav configured
          // This ensures we match against: current_gaav OR primary_gaav OR any of the 3 additional_gaavs
          if (villages.length > 0) {
            officerGavMap.set(officer.id, { 
              taluka, 
              villages, 
              current_gaav: officer.current_gaav,
              primary_gaav: officer.primary_gaav,
              additional_gaavs: officer.additional_gaavs
            });
            
            Logger.info('AUTO_ASSIGN_OFFICER_GAAVS', {
              officer_id: officer.id,
              total_gaavs: villages.length,
              villages: villages,
              current_gaav: officer.current_gaav,
              primary_gaav: officer.primary_gaav,
              additional_gaavs: officer.additional_gaavs
            });
          } else {
            Logger.warn('AUTO_ASSIGN_OFFICER_NO_GAAVS', {
              officer_id: officer.id,
              has_primary_gaav: !!officer.primary_gaav,
              has_additional_gaavs: !!officer.additional_gaavs,
              has_current_gaav: !!officer.current_gaav,
              primary_gaav: officer.primary_gaav,
              current_gaav: officer.current_gaav,
              additional_gaavs: officer.additional_gaavs,
              message: 'Officer has no configured villages (primary_gaav, additional_gaavs, or current_gaav)'
            });
          }
        }
      }
    } catch (profileError) {
      Logger.error('AUTO_ASSIGN_PROFILE_ERROR', { 
        error: (profileError as any)?.message,
        stack: (profileError as any)?.stack
      });
    }

    Logger.info('AUTO_ASSIGN_OFFICER_GAV_MAP_FINAL', {
      total_officers_in_map: officerGavMap.size,
      officer_ids: Array.from(officerGavMap.keys()),
      officer_details: Array.from(officerGavMap.entries()).map(([id, data]) => ({
        officer_id: id,
        taluka: data.taluka,
        villages_count: data.villages.length,
        villages: data.villages
      }))
    });

    if (officerGavMap.size === 0) {
      Logger.warn('AUTO_ASSIGN_NO_PROFILES', {
        message: 'No field officers have configured villages in their profile',
        check_query_result: 'See AUTO_ASSIGN_OFFICERS_QUERY_RESULT log above'
      });
      return {
        ok: true,
        assigned: 0,
        checked: unassignedSurveys.length,
        message: 'No field officers have configured villages in their profile',
        details: []
      };
    }

    Logger.info('AUTO_ASSIGN_OFFICERS_FOUND', {
      count: officerGavMap.size,
      officer_ids: Array.from(officerGavMap.keys())
    });

    // Step 5: Pre-load assignment counts for all officer-GAV combinations
    // Map: "officerId_gav" -> count of assigned surveys
    const assignmentCountsCache = new Map<string, number>();

    // Helper function to get assignment count for an officer-GAV combination
    const getAssignmentCount = async (officerId: number, gav: string): Promise<number> => {
      const cacheKey = `${officerId}_${gav}`;

      // Return cached value if available
      if (assignmentCountsCache.has(cacheKey)) {
        return assignmentCountsCache.get(cacheKey)!;
      }

      try {
        // Count surveys assigned to this officer that match this GAV
        const [assignedSurveys]: any = await conn.query(`
          SELECT survey_json
          FROM surveys
          WHERE user_id = ?
          AND survey_json IS NOT NULL
          AND survey_json != ''
          AND (source = 'Divyang Self' OR source IS NULL)
          ORDER BY created_at ASC
        `, [officerId]);

        let count = 0;
        if (Array.isArray(assignedSurveys)) {
          for (const assignedSurvey of assignedSurveys) {
            try {
              const surveyJsonRaw = assignedSurvey.survey_json;
              const surveyJson = typeof surveyJsonRaw === 'string'
                ? JSON.parse(surveyJsonRaw)
                : surveyJsonRaw;

              const assignedVillage = extractVillageFromSurveyJson(surveyJson, villageQuestionId);
              if (assignedVillage) {
                const assignedVillageNormalized = normalizeVillage(assignedVillage);
                const gavNormalized = normalizeVillage(gav);
                // Check if this survey's GAV matches the target GAV (normalized comparison)
                if (assignedVillageNormalized === gavNormalized ||
                  assignedVillageNormalized.includes(gavNormalized) ||
                  gavNormalized.includes(assignedVillageNormalized)) {
                  count++;
                }
              }
            } catch (e) {
              // Skip invalid survey JSON
            }
          }
        }

        // Cache the count
        assignmentCountsCache.set(cacheKey, count);
        return count;
      } catch (error) {
        Logger.error('AUTO_ASSIGN_COUNT_ERROR', {
          officer_id: officerId,
          gav: gav,
          error: (error as any)?.message
        });
        assignmentCountsCache.set(cacheKey, 0);
        return 0;
      }
    };

    // Step 6: Process each unassigned survey with round-robin distribution
    let assignedCount = 0;
    const assignmentDetails: any[] = [];

    for (const survey of unassignedSurveys) {
      try {
        const surveyJsonRaw = survey.survey_json;
        const surveyJson = typeof surveyJsonRaw === 'string'
          ? JSON.parse(surveyJsonRaw)
          : surveyJsonRaw;

        // Log survey JSON structure for debugging
        Logger.info('AUTO_ASSIGN_SURVEY_JSON_DEBUG', {
          survey_id: survey.id,
          has_answers: !!surveyJson.answers,
          answers_type: Array.isArray(surveyJson.answers) ? 'array' : typeof surveyJson.answers,
          answers_count: Array.isArray(surveyJson.answers) ? surveyJson.answers.length : 'N/A',
          sample_answers: Array.isArray(surveyJson.answers) ? surveyJson.answers.slice(0, 5).map((a: any) => ({
            question_id: a.question_id,
            answer: String(a.answer || '').substring(0, 50)
          })) : 'N/A',
          village_question_id_from_db: villageQuestionId
        });

        // Extract village and taluka from survey
        // Try multiple question IDs: the one from DB (39) and the one from public form (30)
        let surveyVillage = extractVillageFromSurveyJson(surveyJson, villageQuestionId);
        if (!surveyVillage || surveyVillage.trim().length === 0) {
          // Try question ID 30 (from questions_public.json)
          surveyVillage = extractVillageFromSurveyJson(surveyJson, 30);
        }
        // Also try by searching for village-related question text in answers
        if (!surveyVillage || surveyVillage.trim().length === 0) {
          if (Array.isArray(surveyJson.answers)) {
            // Search for answers that might be villages (non-empty, not "--Select--", etc.)
            const villageKeywords = ['गाव', 'village', 'ग्राम', 'gaav', 'gaon'];
            for (const ans of surveyJson.answers) {
              const qid = Number(ans.question_id || ans.questionId || 0);
              const answerText = String(ans.answer || ans.value || '').trim();
              // If this answer looks like a village name (not a select placeholder, not empty)
              if (answerText && answerText !== '--Select--' && answerText !== '--' && answerText.length > 2) {
                // Check if question ID is around 30-40 range (address section)
                if (qid >= 25 && qid <= 45) {
                  surveyVillage = answerText;
                  Logger.info('AUTO_ASSIGN_VILLAGE_FOUND_BY_SEARCH', {
                    survey_id: survey.id,
                    question_id: qid,
                    village: surveyVillage
                  });
                  break;
                }
              }
            }
          }
        }
        
        const surveyTaluka = talukaQuestionId ? extractVillageFromSurveyJson(surveyJson, talukaQuestionId) : null;

        if (!surveyVillage || surveyVillage.trim().length === 0) {
          Logger.warn('AUTO_ASSIGN_NO_VILLAGE_IN_SURVEY', {
            survey_id: survey.id,
            aadhaar_id: survey.aadhaar_id,
            has_survey_json: !!survey.survey_json,
            village_question_id: villageQuestionId,
            tried_question_id_30: true,
            survey_json_keys: Object.keys(surveyJson),
            answers_sample: Array.isArray(surveyJson.answers) ? surveyJson.answers.slice(0, 3) : 'not_array'
          });
          continue;
        }

        // Normalize village names for matching (same function as officer villages)
        const surveyVillageNormalized = normalizeVillage(surveyVillage);
        const surveyTalukaLower = surveyTaluka ? normalizeVillage(surveyTaluka) : null;

        // Find matching field officers
        const matchingOfficers: number[] = [];
        for (const [officerId, officerData] of officerGavMap.entries()) {
          // Check Taluka Match (if both have taluka info)
          if (surveyTalukaLower && officerData.taluka) {
            if (surveyTalukaLower !== officerData.taluka && !officerData.taluka.includes(surveyTalukaLower) && !surveyTalukaLower.includes(officerData.taluka)) {
              continue; // Taluka mismatch
            }
          }

          // Check Village Match - matches if survey village matches ANY of the officer's gaavs:
          // - current_gaav (where they're currently working)
          // - primary_gaav (one of their 3 assigned gaavs)
          // - any of the additional_gaavs (the other 2 of their 3 assigned gaavs)
          // Total: 1 primary_gaav + 2 additional_gaavs = 3 gaavs they can serve
          // Use normalized comparison for better matching
          const hasVillageMatch = officerData.villages.some((v: string) => {
            const normalizedV = normalizeVillage(v);
            return surveyVillageNormalized === normalizedV ||
                   surveyVillageNormalized.includes(normalizedV) ||
                   normalizedV.includes(surveyVillageNormalized);
          });

          if (hasVillageMatch) {
            matchingOfficers.push(officerId);
            const matchedGaavs = officerData.villages.filter(v => {
              const normalizedV = normalizeVillage(v);
              return surveyVillageNormalized === normalizedV ||
                     surveyVillageNormalized.includes(normalizedV) ||
                     normalizedV.includes(surveyVillageNormalized);
            });
            Logger.info('AUTO_ASSIGN_VILLAGE_MATCH_FOUND', {
              survey_id: survey.id,
              survey_village: surveyVillage,
              survey_village_normalized: surveyVillageNormalized,
              officer_id: officerId,
              total_officer_gaavs: officerData.villages.length,
              matched_gaavs: matchedGaavs
            });
          }
        }

        // FALLBACK: If no village match, assign to ANY available field officer
        if (matchingOfficers.length === 0) {
          Logger.warn('AUTO_ASSIGN_NO_VILLAGE_MATCH_FALLBACK', {
            survey_id: survey.id,
            village: surveyVillage,
            taluka: surveyTaluka,
            message: 'No field officer configured for this village, using fallback assignment'
          });

          // Get all field officers as fallback
          const allOfficerIds = Array.from(officerGavMap.keys());
          if (allOfficerIds.length > 0) {
            matchingOfficers.push(...allOfficerIds);
          } else {
            Logger.error('AUTO_ASSIGN_NO_OFFICERS_AVAILABLE', {
              survey_id: survey.id,
              message: 'No field officers available at all'
            });
            continue; // Skip this survey
          }
        }

        // Round-robin: Find officer with least assignments for this GAV
        let matchedOfficerId: number | null = null;
        let minCount = Infinity;

        // Get assignment counts for all matching officers (from cache or DB)
        const officerCounts = new Map<number, number>();
        for (const officerId of matchingOfficers) {
          const count = await getAssignmentCount(officerId, surveyVillageNormalized);
          officerCounts.set(officerId, count);
          if (count < minCount) {
            minCount = count;
            matchedOfficerId = officerId;
          }
        }
        
        Logger.info('AUTO_ASSIGN_MATCHING_RESULT', {
          survey_id: survey.id,
          survey_village: surveyVillage,
          survey_village_normalized: surveyVillageNormalized,
          matching_officers_count: matchingOfficers.length,
          matched_officer_id: matchedOfficerId,
          officer_counts: Array.from(officerCounts.entries()).map(([id, count]) => ({ officer_id: id, count }))
        });

        // If multiple officers have the same minimum count, pick the first one in the list
        // This ensures consistent round-robin behavior
        if (!matchedOfficerId && matchingOfficers.length > 0) {
          // Find all officers with minimum count
          const officersWithMinCount = matchingOfficers.filter(id =>
            (officerCounts.get(id) || 0) === minCount
          );
          // Pick the first one (ensures round-robin: A, B, C, A, B, C...)
          matchedOfficerId = officersWithMinCount[0] || matchingOfficers[0];
        }

        if (matchedOfficerId) {
          // Assign survey to field officer
          await conn.query(`
            UPDATE surveys
            SET user_id = ?,
                source = COALESCE(source, 'Divyang Self'),
                updated_at = NOW()
            WHERE id = ?
          `, [matchedOfficerId, survey.id]);

          // Create explicit assignment record used for tracking
          // Check if assignment already exists to avoid duplicates
          try {
            const [existingAssignments]: any = await conn.query(
              `SELECT id FROM survey_assignments 
               WHERE survey_id = ? AND field_officer_id = ? 
               LIMIT 1`,
              [survey.id, matchedOfficerId]
            );

            if (Array.isArray(existingAssignments) && existingAssignments.length > 0) {
              Logger.info('AUTO_ASSIGN_ALREADY_EXISTS', {
                survey_id: survey.id,
                officer_id: matchedOfficerId,
                assignment_id: existingAssignments[0].id
              });
            } else {
              // Insert new assignment record
              const [insertResult]: any = await conn.execute(`
                 INSERT INTO survey_assignments 
                 (survey_id, field_officer_id, source, status, assigned_at)
                 VALUES (?, ?, ?, 'pending', NOW())
               `, [survey.id, matchedOfficerId, survey.source || 'Divyang Self']);
              
              const insertId = (insertResult as any)?.insertId || ((insertResult as any[])?.[0]?.insertId);
              
              Logger.info('AUTO_ASSIGN_INSERTED_SUCCESS', {
                survey_id: survey.id,
                officer_id: matchedOfficerId,
                village: surveyVillage,
                assignment_id: insertId,
                source: survey.source || 'Divyang Self',
                insert_result: insertResult
              });
            }

            // LOG ACTIVITY: Survey Assigned
            try {
              await conn.execute(
                `INSERT INTO survey_activity_logs (user_id, type, taluka, village, aadhaar_id, details) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  matchedOfficerId,
                  'SURVEY_ASSIGNED',
                  surveyTaluka || null,
                  surveyVillage || null,
                  survey.aadhaar_id || null,
                  JSON.stringify({
                    survey_id: survey.id,
                    action: 'auto_assign'
                  })
                ]
              );
            } catch (logError) {
              console.error('ACTIVITY_LOG_ASSIGN_FAILED:', logError);
            }

            // Create notification for the field officer
            const notificationTitle = 'नवीन सर्वेक्षण सोपवले';
            const notificationMessage = `${surveyVillage} गावातील एक नवीन सर्वेक्षण तुम्हाला सोपवण्यात आले आहे.`;

            await conn.execute(`
              INSERT INTO notifications (user_id, type, title, message, data, created_at)
              VALUES (?, 'survey_assigned', ?, ?, ?, NOW())
            `, [
              matchedOfficerId,
              notificationTitle,
              notificationMessage,
              JSON.stringify({ survey_id: survey.id, village: surveyVillage })
            ]);

            // Try to send push notification
            try {
              await sendFCMPushNotification(matchedOfficerId, notificationTitle, notificationMessage, {
                survey_id: survey.id,
                type: 'survey_assigned'
              });
            } catch (pushError: any) {
              Logger.error('AUTO_ASSIGN_PUSH_ERROR', { error: pushError.message });
            }

          } catch (assignError: any) {
            Logger.error('AUTO_ASSIGN_INSERT_ERROR', { 
              survey_id: survey.id,
              officer_id: matchedOfficerId,
              error: assignError?.message || String(assignError),
              error_code: assignError?.code,
              sql_state: assignError?.sqlState,
              stack: assignError?.stack
            });
            // Don't fail the entire assignment if INSERT fails - survey is already assigned via UPDATE
          }

          // Update the cache to reflect the new assignment
          const cacheKey = `${matchedOfficerId}_${surveyVillageNormalized}`;
          const currentCount = assignmentCountsCache.get(cacheKey) || 0;
          assignmentCountsCache.set(cacheKey, currentCount + 1);

          assignedCount++;
          const assignmentCount = currentCount + 1;
          assignmentDetails.push({
            survey_id: survey.id,
            officer_id: matchedOfficerId,
            village: surveyVillage,
            assignment_number: assignmentCount
          });

          Logger.info('AUTO_ASSIGN_SURVEY_ASSIGNED', {
            survey_id: survey.id,
            officer_id: matchedOfficerId,
            village: surveyVillage,
            assignment_count: assignmentCount,
            total_officers_for_gav: matchingOfficers.length
          });
        }
      } catch (error) {
        Logger.error('AUTO_ASSIGN_PROCESS_SURVEY_ERROR', {
          survey_id: survey.id,
          error: (error as any)?.message
        });
      }
    }

    return {
      ok: true,
      assigned: assignedCount,
      checked: unassignedSurveys.length,
      message: `Processed ${unassignedSurveys.length} surveys, assigned ${assignedCount}`,
      details: assignmentDetails
    };

  } catch (error: any) {
    Logger.error('AUTO_ASSIGN_ERROR', {
      error: error?.message || String(error),
      stack: error?.stack
    });
    return {
      ok: false,
      assigned: 0,
      checked: 0,
      message: error?.message || 'Failed to auto-assign surveys',
      details: []
    };
  } finally {
    conn.release();
  }
}

