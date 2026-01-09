import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { getAllLocations, isOnline } from '@/lib/location-store';

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
    // Step 1: Get question ID for village/GAV
    const [villageQuestionRows]: any = await conn.query(`
      SELECT id FROM questions 
      WHERE (question LIKE '%गाव%' OR question LIKE '%village%' OR question LIKE '%ग्राम%')
      AND (status = 'Active' OR status IS NULL)
      ORDER BY id ASC
      LIMIT 1
    `);

    let villageQuestionId: number | null = null;
    if (Array.isArray(villageQuestionRows) && villageQuestionRows.length > 0) {
      villageQuestionId = Number(villageQuestionRows[0].id);
    }

    if (!villageQuestionId) {
      Logger.error('AUTO_ASSIGN_NO_VILLAGE_QUESTION', {
        message: 'Could not find village question in questions table'
      });
      return {
        ok: false,
        assigned: 0,
        checked: 0,
        message: 'Village question not found in database',
        details: []
      };
    }

    // Step 2: Find unassigned surveys (source = 'Divyang Self' and user_id = 1)
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
      WHERE (s.source = 'Divyang Self' OR s.source IS NULL)
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

    // Step 3: Get all online field officers
    const allLocations = getAllLocations();
    const onlineOfficerIds = new Set<number>();
    
    for (const location of allLocations) {
      if (isOnline(location.user_id)) {
        onlineOfficerIds.add(location.user_id);
      }
    }

    if (onlineOfficerIds.size === 0) {
      Logger.info('AUTO_ASSIGN_NO_ONLINE_OFFICERS', {
        message: 'No field officers are currently online'
      });
      return {
        ok: true,
        assigned: 0,
        checked: unassignedSurveys.length,
        message: 'No online field officers found',
        details: []
      };
    }

    Logger.info('AUTO_ASSIGN_ONLINE_OFFICERS', {
      count: onlineOfficerIds.size,
      officer_ids: Array.from(onlineOfficerIds)
    });

    // Step 4: Get GAV for each online field officer from their latest survey
    const officerGavMap = new Map<number, string>(); // officer_id -> village/GAV

    for (const officerId of onlineOfficerIds) {
      try {
        const [officerSurveys]: any = await conn.query(`
          SELECT survey_json
          FROM surveys
          WHERE user_id = ?
          AND survey_json IS NOT NULL
          AND survey_json != ''
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 1
        `, [officerId]);

        if (Array.isArray(officerSurveys) && officerSurveys.length > 0) {
          const surveyJsonRaw = officerSurveys[0].survey_json;
          try {
            const surveyJson = typeof surveyJsonRaw === 'string' 
              ? JSON.parse(surveyJsonRaw) 
              : surveyJsonRaw;

            // Extract village/GAV from survey_json
            const village = extractVillageFromSurveyJson(surveyJson, villageQuestionId);
            if (village && village.trim().length > 0) {
              officerGavMap.set(officerId, village.trim().toLowerCase());
              Logger.info('AUTO_ASSIGN_OFFICER_GAV', {
                officer_id: officerId,
                village: village
              });
            }
          } catch (parseError) {
            Logger.error('AUTO_ASSIGN_PARSE_OFFICER_SURVEY', {
              officer_id: officerId,
              error: (parseError as any)?.message
            });
          }
        }
      } catch (error) {
        Logger.error('AUTO_ASSIGN_FETCH_OFFICER_GAV', {
          officer_id: officerId,
          error: (error as any)?.message
        });
      }
    }

    if (officerGavMap.size === 0) {
      Logger.info('AUTO_ASSIGN_NO_OFFICER_GAV', {
        message: 'No field officers have GAV in their surveys'
      });
      return {
        ok: true,
        assigned: 0,
        checked: unassignedSurveys.length,
        message: 'No field officers have GAV information',
        details: []
      };
    }

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

        // Extract village/GAV from survey
        const surveyVillage = extractVillageFromSurveyJson(surveyJson, villageQuestionId);
        
        if (!surveyVillage || surveyVillage.trim().length === 0) {
          continue; // Skip surveys without village information
        }

        const surveyVillageLower = surveyVillage.trim().toLowerCase();

        // Find all matching field officers for this GAV
        const matchingOfficers: number[] = [];
        for (const [officerId, officerVillage] of officerGavMap.entries()) {
          // Exact match or contains match
          if (surveyVillageLower === officerVillage || 
              surveyVillageLower.includes(officerVillage) ||
              officerVillage.includes(surveyVillageLower)) {
            matchingOfficers.push(officerId);
          }
        }

        if (matchingOfficers.length === 0) {
          continue; // No matching officers
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

