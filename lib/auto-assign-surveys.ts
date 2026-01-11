import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { getAllLocations, isOnline } from '@/lib/location-store';
import { sendFCMPushNotification } from './fcm';

/**
 * Extract village/GAV from survey_json
 */
function extractVillageFromSurveyJson(surveyJson: any, villageQuestionId: number): string | null {
  if (!surveyJson || typeof surveyJson !== 'object') {
    return null;
  }

  try {
    // Try different structures
    // Structure 1: surveyJson.answers is an array
    if (Array.isArray(surveyJson.answers)) {
      const villageAnswer = surveyJson.answers.find((ans: any) => {
        const qid = Number(ans.question_id || ans.questionId || 0);
        return qid === villageQuestionId;
      });
      if (villageAnswer) {
        return String(villageAnswer.answer || villageAnswer.value || '').trim();
      }
    }

    // Structure 2: surveyJson[villageQuestionId] directly
    if (surveyJson[villageQuestionId]) {
      return String(surveyJson[villageQuestionId]).trim();
    }

    // Structure 3: surveyJson.answers is an object with question_id as keys
    if (surveyJson.answers && typeof surveyJson.answers === 'object' && !Array.isArray(surveyJson.answers)) {
      if (surveyJson.answers[villageQuestionId]) {
        return String(surveyJson.answers[villageQuestionId]).trim();
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
      WHERE (s.source = 'Divyang Self' OR s.source = 'Excel Import' OR s.source IS NULL)
      AND (s.user_id = 1 OR s.user_id IS NULL)
      AND s.survey_json IS NOT NULL
      AND s.survey_json != ''
    `;

    const queryParams: any[] = [];
    if (surveyId) {
      query += ` AND s.id = ?`;
      queryParams.push(surveyId);
    }

    query += ` ORDER BY s.created_at DESC`;

    const [unassignedSurveys]: any = await conn.query(query, queryParams);

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

    // Step 3: Get active field officers and their assigned villages from PROFILE
    const officerGavMap = new Map<number, any>(); // officer_id -> { taluka, villages[] }

    try {
      const [activeOfficers]: any = await conn.query(`
        SELECT u.id, p.primary_gaav, p.additional_gaavs, p.taluka
        FROM users u
        JOIN field_officer_profiles p ON u.id = p.user_id
        WHERE (u.user_type = 'field_officer' OR u.user_type = 'field officer')
        AND (u.status = 'active' OR u.status IS NULL)
        AND u.is_active = 1
      `);

      if (Array.isArray(activeOfficers)) {
        for (const officer of activeOfficers) {
          const villages: string[] = [];

          if (officer.primary_gaav) {
            villages.push(officer.primary_gaav.trim().toLowerCase());
          }

          if (officer.additional_gaavs) {
            try {
              const add = typeof officer.additional_gaavs === 'string'
                ? JSON.parse(officer.additional_gaavs)
                : officer.additional_gaavs;
              if (Array.isArray(add)) {
                add.forEach((v: any) => {
                  if (v) villages.push(String(v).trim().toLowerCase());
                });
              }
            } catch (e) { /* ignore */ }
          }

          const taluka = officer.taluka ? officer.taluka.trim().toLowerCase() : null;

          if (villages.length > 0) {
            officerGavMap.set(officer.id, { taluka, villages });
          }
        }
      }
    } catch (profileError) {
      Logger.error('AUTO_ASSIGN_PROFILE_ERROR', { error: (profileError as any)?.message });
    }

    if (officerGavMap.size === 0) {
      Logger.info('AUTO_ASSIGN_NO_PROFILES', {
        message: 'No field officers have configured villages in their profile'
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
                const assignedVillageLower = assignedVillage.trim().toLowerCase();
                // Check if this survey's GAV matches the target GAV
                if (assignedVillageLower === gav ||
                  assignedVillageLower.includes(gav) ||
                  gav.includes(assignedVillageLower)) {
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

        // Extract village and taluka from survey
        const surveyVillage = extractVillageFromSurveyJson(surveyJson, villageQuestionId);
        const surveyTaluka = talukaQuestionId ? extractVillageFromSurveyJson(surveyJson, talukaQuestionId) : null;

        if (!surveyVillage || surveyVillage.trim().length === 0) {
          continue;
        }

        const surveyVillageLower = surveyVillage.trim().toLowerCase();
        const surveyTalukaLower = surveyTaluka ? surveyTaluka.trim().toLowerCase() : null;

        // Find matching field officers
        const matchingOfficers: number[] = [];
        for (const [officerId, officerData] of officerGavMap.entries()) {
          // Check Taluka Match (if both have taluka info)
          if (surveyTalukaLower && officerData.taluka) {
            if (surveyTalukaLower !== officerData.taluka && !officerData.taluka.includes(surveyTalukaLower) && !surveyTalukaLower.includes(officerData.taluka)) {
              continue; // Taluka mismatch
            }
          }

          // Check Village Match
          const hasVillageMatch = officerData.villages.some((v: string) =>
            surveyVillageLower === v ||
            surveyVillageLower.includes(v) ||
            v.includes(surveyVillageLower)
          );

          if (hasVillageMatch) {
            matchingOfficers.push(officerId);
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
          const count = await getAssignmentCount(officerId, surveyVillageLower);
          officerCounts.set(officerId, count);
          if (count < minCount) {
            minCount = count;
            matchedOfficerId = officerId;
          }
        }

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
          try {
            await conn.execute(`
               INSERT INTO survey_assignments 
               (survey_id, field_officer_id, source, status, assigned_at)
               VALUES (?, ?, ?, 'pending', NOW())
             `, [survey.id, matchedOfficerId, survey.source || 'Divyang Self']);

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
            Logger.error('AUTO_ASSIGN_INSERT_ERROR', { error: (assignError as any)?.message });
          }

          // Update the cache to reflect the new assignment
          const cacheKey = `${matchedOfficerId}_${surveyVillageLower}`;
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

