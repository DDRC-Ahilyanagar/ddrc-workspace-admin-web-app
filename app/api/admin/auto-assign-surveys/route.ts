import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { getAllLocations, isOnline } from '@/lib/location-store';

export const dynamic = 'force-dynamic';

/**
 * Auto-assign surveys based on GAV (village) matching
 * This endpoint is called by the scheduled job every 5 minutes
 * 
 * Logic:
 * 1. Find unassigned surveys (source = 'Divyang Self' and user_id = 1)
 * 2. Extract GAV (village) from survey_json
 * 3. Find online field officers and their GAV (from their latest survey)
 * 4. Match and assign surveys to field officers with matching GAV
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add API token check for security
    // Only require token if it's set in environment
    const authHeader = request.headers.get('authorization');
    const apiToken = process.env.AUTO_ASSIGN_API_TOKEN || '';
    
    // If API token is configured, require it; otherwise allow without auth (for internal calls)
    if (apiToken && apiToken.trim() !== '') {
      if (!authHeader || authHeader !== `Bearer ${apiToken}`) {
        Logger.warn('AUTO_ASSIGN_UNAUTHORIZED', {
          hasHeader: !!authHeader,
          hasToken: !!apiToken,
        });
        return NextResponse.json(
          { ok: false, error: 'Unauthorized: Valid API token required' },
          { status: 401 }
        );
      }
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Step 1: Get question ID for village/GAV
      // Try to find question with text containing "गाव" or "village"
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
        return NextResponse.json({
          ok: false,
          error: 'Village question not found in database',
          assigned: 0
        });
      }

      Logger.info('AUTO_ASSIGN_VILLAGE_QUESTION_FOUND', {
        question_id: villageQuestionId
      });

      // Step 2: Find unassigned surveys (source = 'Divyang Self' and user_id = 1)
      const [unassignedSurveys]: any = await conn.query(`
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
        ORDER BY s.created_at DESC
      `);

      if (!Array.isArray(unassignedSurveys) || unassignedSurveys.length === 0) {
        Logger.info('AUTO_ASSIGN_NO_UNASSIGNED_SURVEYS', {
          count: 0
        });
        return NextResponse.json({
          ok: true,
          message: 'No unassigned surveys found',
          assigned: 0,
          checked: 0
        });
      }

      Logger.info('AUTO_ASSIGN_FOUND_UNASSIGNED', {
        count: unassignedSurveys.length
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
        return NextResponse.json({
          ok: true,
          message: 'No online field officers found',
          assigned: 0,
          checked: unassignedSurveys.length
        });
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
        return NextResponse.json({
          ok: true,
          message: 'No field officers have GAV information',
          assigned: 0,
          checked: unassignedSurveys.length
        });
      }

      // Step 5: Process each unassigned survey and try to match
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

          // Find matching field officer
          let matchedOfficerId: number | null = null;
          for (const [officerId, officerVillage] of officerGavMap.entries()) {
            // Exact match or contains match
            if (surveyVillageLower === officerVillage || 
                surveyVillageLower.includes(officerVillage) ||
                officerVillage.includes(surveyVillageLower)) {
              matchedOfficerId = officerId;
              break;
            }
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

            assignedCount++;
            assignmentDetails.push({
              survey_id: survey.id,
              officer_id: matchedOfficerId,
              village: surveyVillage
            });

            Logger.info('AUTO_ASSIGN_SURVEY_ASSIGNED', {
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

      return NextResponse.json({
        ok: true,
        message: `Processed ${unassignedSurveys.length} surveys, assigned ${assignedCount}`,
        assigned: assignedCount,
        checked: unassignedSurveys.length,
        details: assignmentDetails
      });

    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('AUTO_ASSIGN_ERROR', {
      error: error?.message || String(error),
      stack: error?.stack
    });
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to auto-assign surveys',
        assigned: 0
      },
      { status: 500 }
    );
  }
}

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

