/**
 * @fileoverview Auto-Assignment Module for Survey Distribution
 * @module lib/auto-assign-surveys
 * @description This module handles the automatic assignment of surveys to field officers
 * based on their registered villages and current location. It implements a round-robin
 * distribution algorithm to ensure balanced workload across all field officers.
 * 
 * @author DDRC Development Team
 * @created 2026-02-15
 * @lastModified 2026-02-17
 * 
 * Key Features:
 * - Automatic survey assignment based on village matching
 * - Round-robin distribution for load balancing
 * - FCM push notifications to field officers
 * - Activity logging for audit trails
 * - Support for both current and registered village matching
 */

import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { getAllLocations, isOnline } from '@/lib/location-store';
import { sendFCMPushNotification } from './fcm';

/**
 * Extracts village/GAV information from survey JSON data
 * Supports multiple potential question IDs for flexibility across different survey formats
 * 
 * @param {any} surveyJson - The survey JSON object containing answers
 * @param {number | string | (number | string)[]} villageQuestionIds - Question ID(s) that contain village information
 * @returns {string | null} The extracted village name or null if not found
 * 
 * @example
 * const village = extractVillageFromSurveyJson(surveyData, [30, 39, 49, 50]);
 * // Returns: "Ahmednagar" or null
 */
function extractVillageFromSurveyJson(surveyJson: any, villageQuestionIds: number | string | (number | string)[]): string | null {
  if (!surveyJson || typeof surveyJson !== 'object') {
    return null;
  }

  const ids = Array.isArray(villageQuestionIds) ? villageQuestionIds : [villageQuestionIds];

  for (const villageQuestionId of ids) {
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
    } catch (error) {
      // Continue to next ID
    }
  }

  return null;
}

/**
 * Automatically assigns surveys to field officers based on village matching and round-robin distribution
 * 
 * This function implements an intelligent survey assignment system that:
 * 1. Identifies unassigned surveys from the database
 * 2. Extracts village information from survey JSON data
 * 3. Matches surveys with field officers based on their assigned villages
 * 4. Distributes surveys evenly using a round-robin algorithm
 * 5. Sends FCM push notifications to assigned field officers
 * 6. Logs all assignment activities for audit purposes
 * 
 * Assignment Priority:
 * - Priority 1: Officers whose current_gaav matches the survey village (they are physically present)
 * - Priority 2: Officers whose registered villages (primary_gaav or additional_gaavs) match
 * - Fallback: Any available field officer if no village match is found
 * 
 * Round-Robin Logic:
 * - Assigns to the officer who received an assignment the longest time ago
 * - Ensures balanced workload distribution across all field officers
 * 
 * @param {number} [surveyId] - Optional specific survey ID to assign. If not provided, assigns all unassigned surveys
 * @returns {Promise<{ok: boolean, assigned: number, checked: number, message: string, details: any[]}>} 
 *          Result object containing:
 *          - ok: Whether the operation completed successfully
 *          - assigned: Number of surveys successfully assigned
 *          - checked: Total number of surveys processed
 *          - message: Human-readable status message
 *          - details: Array of assignment details (survey_id, officer_id, village)
 * 
 * @throws {Error} Database connection or query errors
 * 
 * @example
 * // Assign all unassigned surveys
 * const result = await autoAssignSurveys();
 * console.log(`Assigned ${result.assigned} out of ${result.checked} surveys`);
 * 
 * @example
 * // Assign a specific survey
 * const result = await autoAssignSurveys(12345);
 * if (result.ok && result.assigned > 0) {
 *   console.log(`Survey 12345 assigned to officer ${result.details[0].officer_id}`);
 * }
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

    const villageQuestionIds: number[] = [];
    const talukaQuestionIds: number[] = [];

    if (Array.isArray(questionRows)) {
      for (const row of questionRows) {
        const q = row.question.toLowerCase();
        // Collect ALL matching question IDs
        if (q.includes('गाव') || q.includes('village') || q.includes('ग्राम')) {
          villageQuestionIds.push(row.id);
        }
        if (q.includes('taluka') || q.includes('तालुका') || q.includes('ता.')) {
          talukaQuestionIds.push(row.id);
        }
      }
    }

    if (villageQuestionIds.length === 0) {
      Logger.error('AUTO_ASSIGN_NO_VILLAGE_QUESTION', { message: 'Village questions not found' });
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
      // Include both field_officer and verification_officer (they can both be assigned surveys)
      let [activeOfficers]: any = await conn.query(`
        SELECT u.id, p.primary_gaav, p.additional_gaavs, p.taluka, p.current_gaav
        FROM users u
        JOIN field_officer_profiles p ON u.id = p.user_id
        WHERE (u.user_type = 'field_officer' OR u.user_type = 'field officer' OR u.user_type = 'verification_officer')
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
          WHERE (u.user_type = 'field_officer' OR u.user_type = 'field officer' OR u.user_type = 'verification_officer')
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

              const assignedVillage = extractVillageFromSurveyJson(surveyJson, villageQuestionIds);
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

    // Add well-known public form IDs if not already in the list
    if (!villageQuestionIds.includes(30)) villageQuestionIds.push(30);
    if (!villageQuestionIds.includes(39)) villageQuestionIds.push(39);
    if (!villageQuestionIds.includes(49)) villageQuestionIds.push(49);
    if (!villageQuestionIds.includes(50)) villageQuestionIds.push(50); // Important: Current Grampanchayat often holds the village name

    if (!talukaQuestionIds.includes(28)) talukaQuestionIds.push(28);
    if (!talukaQuestionIds.includes(40)) talukaQuestionIds.push(40);
    if (!talukaQuestionIds.includes(47)) talukaQuestionIds.push(47);

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
          village_question_ids: villageQuestionIds
        });

        // Extract village and taluka from survey using ALL possible IDs
        let surveyVillage = extractVillageFromSurveyJson(surveyJson, villageQuestionIds);

        // Taluka extraction
        let surveyTaluka = extractVillageFromSurveyJson(surveyJson, talukaQuestionIds);

        if (!surveyVillage || surveyVillage.trim() === '' || surveyVillage === '--Select--') {
          continue;
        }

        // Normalize village names for matching (same function as officer villages)
        const surveyVillageNormalized = normalizeVillage(surveyVillage);
        const surveyTalukaLower = surveyTaluka ? normalizeVillage(surveyTaluka) : null;

        // Prioritization logic:
        // 1. Officers whose CURRENT village matches (they are there right now)
        // 2. Officers whose REGISTERED villages match (permanent assignment)
        const currentGaavMatches: number[] = [];
        const registeredGaavMatches: number[] = [];

        for (const [officerId, officerData] of officerGavMap.entries()) {
          // Check Taluka Match (if both have taluka info)
          if (surveyTalukaLower && officerData.taluka) {
            // Flexible taluka match (e.g., "Nagar" in "Ahmednagar")
            if (surveyTalukaLower !== officerData.taluka &&
              !officerData.taluka.includes(surveyTalukaLower) &&
              !surveyTalukaLower.includes(officerData.taluka)) {
              continue; // Taluka mismatch
            }
          }

          // Check Current Gaav Match (Priority 1)
          if (officerData.current_gaav) {
            const normCurrent = normalizeVillage(officerData.current_gaav);
            if (surveyVillageNormalized === normCurrent ||
              surveyVillageNormalized.includes(normCurrent) ||
              normCurrent.includes(surveyVillageNormalized)) {
              currentGaavMatches.push(officerId);
              continue; // If it matches current, skip checking registered for this officer
            }
          }

          // Check Registered Gaavs Match (Priority 2)
          const hasVillageMatch = officerData.villages.some((v: string) => {
            const normalizedV = normalizeVillage(v);
            return surveyVillageNormalized === normalizedV ||
              surveyVillageNormalized.includes(normalizedV) ||
              normalizedV.includes(surveyVillageNormalized);
          });

          if (hasVillageMatch) {
            registeredGaavMatches.push(officerId);
          }
        }

        // Select the best matching group
        let matchingOfficers = currentGaavMatches.length > 0 ? currentGaavMatches : registeredGaavMatches;

        if (matchingOfficers.length > 0) {
          Logger.info('AUTO_ASSIGN_VILLAGE_MATCH_FOUND', {
            survey_id: survey.id,
            village: surveyVillage,
            matching_officers: matchingOfficers,
            priority: currentGaavMatches.length > 0 ? 'CURRENT_GAAV' : 'REGISTERED_GAAV'
          });
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

        // --- SEQUENTIAL ROUND-ROBIN (LRU) LOGIC ---
        // Find the officer who received an assignment the longest time ago (or never)
        let matchedOfficerId: number | null = null;

        try {
          // Query the last assignment time for all candidate officers
          // Using a prepared query with IN clause
          const [lastAssignments]: any = await conn.query(`
            SELECT field_officer_id, MAX(assigned_at) as last_assigned
            FROM survey_assignments
            WHERE field_officer_id IN (?)
            GROUP BY field_officer_id
          `, [matchingOfficers]);

          const lastAssignedMap = new Map<number, Date>();
          if (Array.isArray(lastAssignments)) {
            lastAssignments.forEach((row: any) => {
              lastAssignedMap.set(Number(row.field_officer_id), new Date(row.last_assigned));
            });
          }

          // Sort matching officers: 
          // 1. Those who NEVER had an assignment (date = 0)
          // 2. Those who had the oldest assignment (earliest date)
          matchingOfficers.sort((a, b) => {
            const dateA = lastAssignedMap.get(a)?.getTime() || 0;
            const dateB = lastAssignedMap.get(b)?.getTime() || 0;
            return dateA - dateB;
          });

          matchedOfficerId = matchingOfficers[0];

          Logger.info('AUTO_ASSIGN_ROUND_ROBIN_MATCH', {
            survey_id: survey.id,
            village: surveyVillage,
            candidates: matchingOfficers,
            matched: matchedOfficerId,
            last_assigned: lastAssignedMap.get(matchedOfficerId) || 'NEVER'
          });

        } catch (rrError) {
          Logger.error('AUTO_ASSIGN_ROUND_ROBIN_FAILED', { error: (rrError as any).message });
          // Fallback to first officer if query fails
          matchedOfficerId = matchingOfficers[0];
        }

        if (matchedOfficerId) {
          // Assign survey to field officer
          await conn.query(`
            UPDATE surveys
            SET user_id = ?,
                assigned_to = ?,
                source = COALESCE(source, 'Divyang Self'),
                updated_at = NOW()
            WHERE id = ?
          `, [matchedOfficerId, matchedOfficerId, survey.id]);

          // Create explicit assignment record used for tracking
          try {
            const [insertResult]: any = await conn.execute(`
               INSERT INTO survey_assignments 
               (survey_id, field_officer_id, source, status, assigned_at)
               VALUES (?, ?, ?, 'pending', NOW())
             `, [survey.id, matchedOfficerId, survey.source || 'Divyang Self']);

            const insertId = (insertResult as any)?.insertId || ((insertResult as any[])?.[0]?.insertId);

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
                    action: 'auto_assign_sequential'
                  })
                ]
              );
            } catch (logError) {
              console.error('ACTIVITY_LOG_ASSIGN_FAILED:', logError);
            }

            // Create notification for the field officer
            const notificationTitle = 'नवीन सर्वेक्षण सोपवले (New Survey Assigned)';
            const notificationMessage = `${surveyVillage} गावातील एक नवीन सर्वेक्षण तुम्हाला सोपवण्यात आले आहे.`;

            await conn.execute(`
              INSERT INTO notifications (user_id, type, title, message, data, created_at)
              VALUES (?, 'survey_assigned', ?, ?, ?, NOW())
            `, [
              matchedOfficerId,
              notificationTitle,
              notificationMessage,
              JSON.stringify({
                survey_id: survey.id,
                survey_aadhar_id: survey.aadhaar_id,
                village: surveyVillage
              })
            ]);

            // Try to send push notification
            try {
              await sendFCMPushNotification(matchedOfficerId, notificationTitle, notificationMessage, {
                survey_id: survey.id.toString(),
                survey_aadhar_id: survey.aadhaar_id.toString(),
                type: 'survey_assigned'
              });
            } catch (pushError: any) {
              Logger.error('AUTO_ASSIGN_PUSH_ERROR', { error: pushError.message });
            }

          } catch (assignError: any) {
            Logger.error('AUTO_ASSIGN_INSERT_ERROR', {
              survey_id: survey.id,
              officer_id: matchedOfficerId,
              error: assignError?.message || String(assignError)
            });
          }

          assignedCount++;
          assignmentDetails.push({
            survey_id: survey.id,
            officer_id: matchedOfficerId,
            village: surveyVillage
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
      message: `Processed ${unassignedSurveys.length} surveys, assigned ${assignedCount} using sequential round-robin`,
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


