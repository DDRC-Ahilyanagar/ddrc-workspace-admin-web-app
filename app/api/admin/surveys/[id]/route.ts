import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

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

    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      // Get survey basic info
      const [surveyRows]: any = await conn.query(
        `SELECT 
          sa.id,
          sa.aadhar_no,
          sa.user_id,
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
          u.contact_number AS user_phone
        FROM survey_aadhar sa
        LEFT JOIN users u ON u.id = sa.user_id
        WHERE sa.id = ? LIMIT 1`,
        [surveyId]
      );

      if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Survey not found' },
          { status: 404 }
        );
      }

      const survey = surveyRows[0];

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
        const verificationFields = hasVerificationColumns
          ? `, s.verification_status, s.assigned_to, s.verified_by, s.verified_at, s.admin_corrections`
          : '';
        
        const [surveyJsonRows]: any = await conn.query(
          `SELECT survey_json, no_of_questions_answered, no_of_questions_unanswered${verificationFields}
           FROM surveys s
           WHERE s.aadhaar_id = ? LIMIT 1`,
          [surveyId]
        );
        
        if (Array.isArray(surveyJsonRows) && surveyJsonRows.length > 0) {
          surveyRecord = surveyJsonRows[0];
          
          if (surveyJsonRows[0].survey_json) {
            const jsonStr = surveyJsonRows[0].survey_json;
            const surveyJson = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
            
            Logger.info('survey_details_json_found', {
              survey_id: surveyId,
              json_answers_count: surveyJson.answers?.length || 0,
            });
            
            // Extract answers from JSON
            if (surveyJson.answers && Array.isArray(surveyJson.answers)) {
            // Enrich answers with question details from questions table
            const enrichedAnswers = await Promise.all(surveyJson.answers.map(async (ans: any) => {
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
        }
      } catch (jsonError: any) {
        Logger.error('survey_json_read_failed', { 
          error: jsonError.message,
          survey_id: surveyId,
          stack: jsonError.stack,
        });
      }
      
      // No fallback - all data must come from JSON in surveys table
      if (answers.length === 0) {
        Logger.info('survey_details_no_data', {
          survey_id: surveyId,
          note: 'No survey data found in surveys.survey_json. Survey may not have been submitted yet.',
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
      
      if (surveyRecord) {
        // Use data from surveys table (authoritative source)
        answerCount = surveyRecord.no_of_questions_answered || 0;
        status = answerCount > 0 ? 'Completed' : 'Pending';
        Logger.info('survey_details_using_surveys_table', {
          survey_id: surveyId,
          answer_count: answerCount,
          status,
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

      Logger.info('survey_details_fetched', {
        survey_id: surveyId,
        answer_count: answerCount,
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
      conn.release();
    }
  } catch (e: any) {
    Logger.error('survey_details_get_error', { error: e.message });
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}

