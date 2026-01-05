import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/auth';
import type { PoolConnection } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/admin/surveys/{id}:
 *   get:
 *     summary: Get survey details with all answers
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Survey details retrieved successfully
 *       404:
 *         description: Survey not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Next.js 15+ (Promise) and older versions (object)
    const resolvedParams = params instanceof Promise ? await params : params;
    const surveyId = parseInt(resolvedParams.id || '0');
    if (!surveyId || surveyId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid survey ID' },
        { status: 422 }
      );
    }

    // Check authentication and user role
    let user: any = null;
    let userType = '';
    try {
      const authResult = await verifyAuth(request);
      user = authResult.user;
      if (user) {
        userType = (user.user_type || '').toLowerCase();
      }
    } catch (authError) {
      // Auth is optional for this endpoint - continue without user info
      Logger.info('survey_details_get_no_auth', { survey_id: surveyId });
    }

    const pool = getDbPool();
    let conn: PoolConnection | null = null;
    try {
      conn = await pool.getConnection();
      // Get survey basic info
      // Priority: Use surveys.user_id (field officer who created survey) over survey_aadhar.user_id (who uploaded Aadhaar)
      // Also get survey_json directly from the JOIN to avoid separate query
      const [surveyRows]: any = await conn.query(
        `SELECT 
          sa.id,
          sa.aadhar_no,
          COALESCE(s.user_id, sa.user_id) AS user_id,
          sa.front_image,
          sa.back_image,
          sa.holder_name,
          sa.address_text,
          sa.pincode,
          sa.taluka,
          sa.district,
          sa.gender,
          sa.dob,
          sa.created_at,
          sa.updated_at,
          u.name AS user_name,
          u.contact_number AS user_phone,
          s.id AS survey_table_id,
          s.aadhaar_id AS survey_aadhaar_id,
          s.survey_json AS survey_json_from_join,
          s.no_of_questions_answered AS no_of_questions_answered_from_join,
          s.no_of_questions_unanswered AS no_of_questions_unanswered_from_join
        FROM survey_aadhar sa
        LEFT JOIN surveys s ON s.aadhaar_id = sa.id
        LEFT JOIN users u ON u.id = COALESCE(s.user_id, sa.user_id)
        WHERE sa.id = ? LIMIT 1`,
        [surveyId]
      );
      
      Logger.info('survey_details_survey_aadhar_query', {
        survey_id: surveyId,
        found_records: Array.isArray(surveyRows) ? surveyRows.length : 0,
        survey_table_id: Array.isArray(surveyRows) && surveyRows.length > 0 ? surveyRows[0]?.survey_table_id : null,
        survey_aadhaar_id: Array.isArray(surveyRows) && surveyRows.length > 0 ? surveyRows[0]?.survey_aadhaar_id : null,
      });

      if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Survey not found' },
          { status: 404 }
        );
      }

      const survey = surveyRows[0];
      const surveyTableId = surveyRows[0]?.survey_table_id; // Get the surveys.id from the JOIN
      const surveyJsonFromJoin = surveyRows[0]?.survey_json_from_join;
      const noOfQuestionsAnsweredFromJoin = surveyRows[0]?.no_of_questions_answered_from_join;
      const noOfQuestionsUnansweredFromJoin = surveyRows[0]?.no_of_questions_unanswered_from_join;

      Logger.info('survey_details_from_join', {
        survey_id: surveyId,
        survey_table_id: surveyTableId,
        has_survey_json_from_join: !!surveyJsonFromJoin,
        survey_json_type: typeof surveyJsonFromJoin,
        no_of_questions_answered: noOfQuestionsAnsweredFromJoin,
      });

      // Check if verification columns exist (outside try block for scope)
      let hasVerificationColumns = false;
      try {
        const [columnCheck]: any = await conn.query(
          `SELECT COLUMN_NAME 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'surveys' 
             AND COLUMN_NAME IN ('verification_status', 'assigned_to', 'verified_by', 'verified_at', 'admin_corrections')
           LIMIT 5`
        );
        hasVerificationColumns = Array.isArray(columnCheck) && columnCheck.length > 0;
      } catch (colCheckError: any) {
        Logger.info('verification_columns_check_failed', { error: colCheckError?.message });
        hasVerificationColumns = false;
      }

      // Try to get survey JSON from surveys table first (primary source)
      let answers: any[] = [];
      let answersBySection: Record<string, any[]> = {};
      let surveyRecord: any = null;
      
      try {
        // If we got survey_json from the JOIN, use it directly
        if (surveyJsonFromJoin) {
          Logger.info('survey_details_using_json_from_join', {
            survey_id: surveyId,
            note: 'Using survey_json from JOIN instead of separate query',
          });
          
          surveyRecord = {
            survey_json: surveyJsonFromJoin,
            no_of_questions_answered: noOfQuestionsAnsweredFromJoin,
            no_of_questions_unanswered: noOfQuestionsUnansweredFromJoin,
          };
        } else {
          // Fallback: Query surveys table separately
          const verificationFields = hasVerificationColumns
            ? `, s.verification_status, s.assigned_to, s.verified_by, s.verified_at, s.admin_corrections`
            : '';
          
          // Build query params - use surveyTableId from JOIN if available, otherwise use surveyId
          const queryParams: any[] = [surveyId, surveyId];
          if (surveyTableId) {
            queryParams.push(surveyTableId);
          }
          
          // Try by aadhaar_id first (most common), then by survey ID, then by the survey_table_id from the JOIN
          let [surveyJsonRows]: any = await conn.query(
            `SELECT survey_json, no_of_questions_answered, no_of_questions_unanswered${verificationFields}
             FROM surveys s
             WHERE s.aadhaar_id = ? OR s.id = ?${surveyTableId ? ' OR s.id = ?' : ''}
             ORDER BY s.id DESC
             LIMIT 1`,
            queryParams
          );
          
          Logger.info('survey_details_first_query_attempt', {
            survey_id: surveyId,
            survey_table_id_from_join: surveyTableId,
            found_records: Array.isArray(surveyJsonRows) ? surveyJsonRows.length : 0,
            query_params: queryParams,
          });
          
          // If no result, try with just aadhaar_id (most common case)
          if (!Array.isArray(surveyJsonRows) || surveyJsonRows.length === 0) {
            [surveyJsonRows] = await conn.query(
              `SELECT survey_json, no_of_questions_answered, no_of_questions_unanswered${verificationFields}
               FROM surveys s
               WHERE s.aadhaar_id = ? LIMIT 1`,
              [surveyId]
            );
            
            Logger.info('survey_details_second_query_attempt', {
              survey_id: surveyId,
              found_records: Array.isArray(surveyJsonRows) ? surveyJsonRows.length : 0,
              query_params: [surveyId],
            });
          }
          
          // Debug: Check what surveys exist for this aadhaar_id
          if (!Array.isArray(surveyJsonRows) || surveyJsonRows.length === 0) {
            const [debugRows]: any = await conn.query(
              `SELECT id, aadhaar_id, no_of_questions_answered, 
               CASE WHEN survey_json IS NULL THEN 'NULL' 
                    WHEN survey_json = '' THEN 'EMPTY' 
                    ELSE CONCAT('HAS_DATA(', LENGTH(survey_json), ' chars)') END AS json_status
               FROM surveys 
               WHERE aadhaar_id = ? OR id = ?`,
              [surveyId, surveyId]
            );
            
            Logger.info('survey_details_debug_query', {
              survey_id: surveyId,
              debug_results: Array.isArray(debugRows) ? debugRows : [],
            });
          }
          
          if (Array.isArray(surveyJsonRows) && surveyJsonRows.length > 0) {
            surveyRecord = surveyJsonRows[0];
          }
        }
        
        // Process surveyRecord (whether from JOIN or separate query)
        if (surveyRecord) {
          Logger.info('survey_details_surveys_record_found', {
            survey_id: surveyId,
            aadhaar_id: surveyId,
            has_survey_json: !!surveyRecord.survey_json,
            survey_json_type: typeof surveyRecord.survey_json,
            no_of_questions_answered: surveyRecord.no_of_questions_answered,
            no_of_questions_unanswered: surveyRecord.no_of_questions_unanswered,
          });
          
          if (surveyRecord.survey_json) {
            let jsonStr = surveyRecord.survey_json;
            // Handle Buffer objects (MySQL TEXT/BLOB columns may return Buffers)
            if (Buffer.isBuffer(jsonStr)) {
              jsonStr = jsonStr.toString('utf8');
            }
            let surveyJson: any;
            // Handle if it's already an object
            if (typeof jsonStr === 'object' && jsonStr !== null && !Array.isArray(jsonStr)) {
              surveyJson = jsonStr;
            } else {
              try {
                surveyJson = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
              } catch (parseError: any) {
                Logger.error('survey_details_json_parse_failed', {
                  survey_id: surveyId,
                  error: parseError?.message,
                  json_preview: typeof jsonStr === 'string' ? jsonStr.substring(0, 200) : 'not a string',
                  json_type: typeof jsonStr,
                });
                surveyJson = null;
              }
            }
            
            if (surveyJson) {
              Logger.info('survey_details_json_found', {
                survey_id: surveyId,
                json_answers_count: surveyJson.answers?.length || 0,
                has_answers_key: 'answers' in surveyJson,
                json_keys: Object.keys(surveyJson || {}),
              });
              
              // Extract answers from JSON
              if (surveyJson.answers && Array.isArray(surveyJson.answers) && surveyJson.answers.length > 0) {
                // Enrich answers with question details from questions table
                if (!conn) {
                  throw new Error('Database connection not available');
                }
                const enrichedAnswers = await Promise.all(surveyJson.answers.map(async (ans: any) => {
                  if (!conn) {
                    throw new Error('Database connection not available');
                  }
                  const [qRow]: any = await conn.query(
                    `SELECT q.question, q.question_type, q.options, 
                     COALESCE(s.name, CONCAT('विभाग ', COALESCE(?, q.section_id, 0))) AS section_name
                     FROM questions q
                     LEFT JOIN sections s ON s.id = COALESCE(?, q.section_id)
                     WHERE q.id = ? LIMIT 1`,
                    [ans.section_id, ans.section_id, ans.question_id]
                  );
                  
                  if (Array.isArray(qRow) && qRow.length > 0) {
                    return {
                      id: ans.question_id,
                      question_id: ans.question_id,
                      section_id: ans.section_id,
                      answer: ans.answer,
                      question_marathi: qRow[0].question,
                      question_english: null,
                      question_type: qRow[0].question_type,
                      options: qRow[0].options,
                      section_name: qRow[0].section_name || `विभाग ${ans.section_id || 0}`,
                      created_at: surveyJson.submitted_at || new Date().toISOString(),
                      updated_at: surveyJson.updated_at || surveyJson.submitted_at || new Date().toISOString(),
                    };
                  }
                  return {
                    id: ans.question_id,
                    question_id: ans.question_id,
                    section_id: ans.section_id,
                    answer: ans.answer,
                    question_marathi: null,
                    question_english: null,
                    question_type: null,
                    options: null,
                    section_name: `विभाग ${ans.section_id || 0}`,
                    created_at: surveyJson.submitted_at || new Date().toISOString(),
                    updated_at: surveyJson.updated_at || surveyJson.submitted_at || new Date().toISOString(),
                  };
                }));
                
                answers = enrichedAnswers;
                
                // Extract name, DOB, gender from JSON to update survey_aadhar if missing
                if (!survey.holder_name || !survey.dob || !survey.gender) {
                  const updates: string[] = [];
                  const values: any[] = [];
                  
                  for (const ans of surveyJson.answers) {
                    const [qRow]: any = await conn.query(
                      'SELECT question FROM questions WHERE id = ? LIMIT 1',
                      [ans.question_id]
                    );
                    if (Array.isArray(qRow) && qRow.length > 0) {
                      const qLabel = String(qRow[0].question || '').toLowerCase();
                      const answerValue = String(ans.answer || '').trim();
                      
                      if (!survey.holder_name && (qLabel.includes('नाव') || qLabel.includes('name')) && answerValue && answerValue !== '--') {
                        updates.push('holder_name = ?');
                        values.push(answerValue);
                        survey.holder_name = answerValue;
                      }
                      
                      if (!survey.dob && (qLabel.includes('जन्म') || qLabel.includes('तारीख') || qLabel.includes('dob') || qLabel.includes('birth')) && answerValue && answerValue !== '--') {
                        updates.push('dob = ?');
                        values.push(answerValue);
                        survey.dob = answerValue;
                      }
                      
                      if (!survey.gender && (qLabel.includes('लिंग') || qLabel.includes('gender')) && answerValue && answerValue !== '--') {
                        const genderUpper = answerValue.toUpperCase();
                        let normalizedGender = answerValue;
                        if (genderUpper.includes('MALE') || genderUpper === 'M' || genderUpper.includes('पुरुष')) {
                          normalizedGender = 'Male';
                        } else if (genderUpper.includes('FEMALE') || genderUpper === 'F' || genderUpper.includes('स्त्री')) {
                          normalizedGender = 'Female';
                        }
                        updates.push('gender = ?');
                        values.push(normalizedGender);
                        survey.gender = normalizedGender;
                      }
                    }
                  }
                  
                  if (updates.length > 0) {
                    values.push(surveyId);
                    await conn.query(
                      `UPDATE survey_aadhar SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
                      values
                    );
                  }
                }
                
                // Group by section
                answers.forEach((ans: any) => {
                  const sectionName = ans.section_name || `विभाग ${ans.section_id || 0}`;
                  if (!answersBySection[sectionName]) {
                    answersBySection[sectionName] = [];
                  }
                  answersBySection[sectionName].push(ans);
                });
              } else {
                Logger.info('survey_details_no_answers_in_json', {
                  survey_id: surveyId,
                  note: 'survey_json exists but answers array is empty or missing',
                  json_keys: Object.keys(surveyJson || {}),
                });
              }
            } else {
              Logger.info('survey_details_json_parse_failed_or_null', {
                survey_id: surveyId,
                note: 'survey_json exists but failed to parse or is null',
              });
            }
          } else {
            Logger.info('survey_details_no_json_in_record', {
              survey_id: surveyId,
              note: 'surveys table record exists but survey_json is null/empty',
            });
          }
        } else {
          Logger.info('survey_details_no_surveys_record', {
            survey_id: surveyId,
            note: 'No record found in surveys table for this aadhaar_id',
          });
          
          // Fallback: Check if answers are stored in the answers table (public-submit route style)
          try {
            const [surveyIdRows]: any = await conn.query(
              `SELECT id FROM surveys WHERE aadhaar_id = ? OR id = ? LIMIT 1`,
              [surveyId, surveyId]
            );
            
            if (Array.isArray(surveyIdRows) && surveyIdRows.length > 0) {
              const actualSurveyId = surveyIdRows[0].id;
              const [answerRows]: any = await conn.query(
                `SELECT a.question_id, a.section_id, a.answer, 
                 q.question, q.question_type, q.options,
                 COALESCE(s.name, CONCAT('विभाग ', COALESCE(a.section_id, 0))) AS section_name
                 FROM answers a
                 LEFT JOIN questions q ON q.id = a.question_id
                 LEFT JOIN sections s ON s.id = a.section_id
                 WHERE a.aadhar_id = ?
                 ORDER BY a.section_id, a.question_id`,
                [surveyId]
              );
              
              if (Array.isArray(answerRows) && answerRows.length > 0) {
                answers = answerRows.map((row: any) => ({
                  id: row.question_id,
                  question_id: row.question_id,
                  section_id: row.section_id,
                  answer: row.answer,
                  question_marathi: row.question,
                  question_english: null,
                  question_type: row.question_type,
                  options: row.options,
                  section_name: row.section_name || `विभाग ${row.section_id || 0}`,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }));
                
                // Group by section
                answers.forEach((ans: any) => {
                  const sectionName = ans.section_name || `विभाग ${ans.section_id || 0}`;
                  if (!answersBySection[sectionName]) {
                    answersBySection[sectionName] = [];
                  }
                  answersBySection[sectionName].push(ans);
                });
                
                Logger.info('survey_details_answers_from_table', {
                  survey_id: surveyId,
                  answers_count: answers.length,
                  note: 'Found answers in answers table (public-submit style)',
                });
              }
            }
          } catch (fallbackError: any) {
            Logger.info('survey_details_fallback_failed', {
              survey_id: surveyId,
              error: fallbackError?.message,
              note: 'Fallback to answers table failed',
            });
          }
        }
      } catch (jsonError: any) {
        Logger.error('survey_json_read_failed', { 
          error: jsonError.message,
          survey_id: surveyId,
          stack: jsonError.stack,
        });
      }
      
      // Log if no data found
      if (answers.length === 0) {
        Logger.info('survey_details_no_data', {
          survey_id: surveyId,
          note: 'No survey data found in surveys.survey_json or answers table. Survey may not have been submitted yet.',
        });
      }

      // Deduplicate answers by question_id within each section (keep latest)
      const answerMap = new Map<string, any>();
      answers.forEach((ans: any) => {
        const key = `${ans.section_id || 0}_${ans.question_id}`;
        const existing = answerMap.get(key);
        if (!existing || new Date(ans.updated_at || ans.created_at) > new Date(existing.updated_at || existing.created_at)) {
          answerMap.set(key, ans);
        }
      });
      const uniqueAnswers = Array.from(answerMap.values());
      
      // Use surveys table for answer count and status (primary source), fallback to calculated values
      let answerCount: number;
      let status: string;
      
      Logger.info('survey_details_answer_count_calculation', {
        survey_id: surveyId,
        has_survey_record: !!surveyRecord,
        survey_record_no_of_answered: surveyRecord?.no_of_questions_answered,
        unique_answers_length: uniqueAnswers.length,
        original_answers_length: answers.length,
      });
      
      if (surveyRecord) {
        // Use data from surveys table (authoritative source)
        answerCount = surveyRecord.no_of_questions_answered || uniqueAnswers.length || 0;
        status = answerCount > 0 ? 'Completed' : 'Pending';
        Logger.info('survey_details_using_surveys_table', {
          survey_id: surveyId,
          answer_count: answerCount,
          status,
          no_of_questions_answered: surveyRecord.no_of_questions_answered,
          unique_answers_count: uniqueAnswers.length,
        });
      } else {
        // Fallback: calculate from answers array
        answerCount = uniqueAnswers.length;
        status = answerCount > 0 ? 'Completed' : 'Pending';
        Logger.info('survey_details_using_calculated_count', {
          survey_id: surveyId,
          answer_count: answerCount,
          status,
          note: 'No surveys table record found, using calculated count',
        });
      }

      // Rebuild answersBySection from unique answers
      const originalAnswersCount = answers.length;
      answersBySection = {};
      uniqueAnswers.forEach((ans: any) => {
        let sectionName = ans.section_name;
        if (!sectionName || sectionName === 'Section NaN' || sectionName === 'Section null' || sectionName === 'Section NULL') {
          const sectionId = ans.section_id || ans.section_id || 0;
          sectionName = sectionId > 0 ? `विभाग ${sectionId}` : 'अज्ञात विभाग';
        }
        if (!answersBySection[sectionName]) {
          answersBySection[sectionName] = [];
        }
        answersBySection[sectionName].push(ans);
      });

      // Update answers to use unique answers for consistency
      answers = uniqueAnswers;

      // Sort answers within each section by question_id
      Object.keys(answersBySection).forEach((sectionName) => {
        answersBySection[sectionName].sort((a: any, b: any) => {
          return (a.question_id || 0) - (b.question_id || 0);
        });
      });

      Logger.info('survey_details_fetched', {
        survey_id: surveyId,
        answer_count: answerCount,
        unique_answers_count: uniqueAnswers.length,
        original_answers_count: originalAnswersCount,
        sections_count: Object.keys(answersBySection).length,
        sections: Object.keys(answersBySection),
      });

      // Get verification data from surveyRecord if available
      const verificationData = surveyRecord && hasVerificationColumns ? {
        verification_status: surveyRecord.verification_status || 'pending',
        assigned_to: surveyRecord.assigned_to || null,
        verified_by: surveyRecord.verified_by || null,
        verified_at: surveyRecord.verified_at || null,
        admin_corrections: surveyRecord.admin_corrections || null,
      } : {
        verification_status: 'pending',
        assigned_to: null,
        verified_by: null,
        verified_at: null,
        admin_corrections: null,
      };

      return NextResponse.json({
        ok: true,
        data: {
          survey: {
            id: survey.id,
            aadhar_no: survey.aadhar_no,
            user_id: survey.user_id,
            user_name: survey.user_name,
            user_phone: survey.user_phone,
            front_image: survey.front_image,
            back_image: survey.back_image,
            holder_name: survey.holder_name,
            address_text: survey.address_text,
            pincode: survey.pincode,
            taluka: survey.taluka,
            district: survey.district,
            gender: survey.gender,
            dob: survey.dob,
            status,
            answer_count: answerCount,
            created_at: survey.created_at,
            updated_at: survey.updated_at,
            ...verificationData,
          },
          answers,
          answersBySection,
        },
      });
    } finally {
      if (conn) {
        conn.release();
      }
    }
  } catch (e: any) {
    Logger.error('survey_details_get_error', { error: e.message });
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}

