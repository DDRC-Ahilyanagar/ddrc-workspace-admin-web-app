import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const headerSource = req.headers.get('x-source')?.toString().toLowerCase() ?? '';
    const headerRole = req.headers.get('x-role')?.toString().toLowerCase() ?? '';

    const source = (body.source || headerSource || '').toString().toLowerCase();
    const role = (body.role || headerRole || '').toString().toLowerCase();
    const phone = (body.phone || '').replace(/\D/g, '');
    const userId = parseInt(body.user_id || '0');

    if (source === 'web' && role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'forbidden_role' },
        { status: 403 }
      );
    }

    const allowedMobileRoles = ['field_officer', 'supervisor', 'therapy_specialist', 'admin'];
    if (source && source !== 'web' && role && !allowedMobileRoles.includes(role)) {
      return NextResponse.json(
        { ok: false, error: 'forbidden_role' },
        { status: 403 }
      );
    }

    const pool = getDbPool();

    // Resolve target user
    const params: any[] = [];
    let where = '';
    if (phone) {
      where = 'contact_number = ?';
      params.push(phone);
    } else if (userId > 0) {
      where = 'id = ?';
      params.push(userId);
    } else {
      return NextResponse.json({ ok: false, error: 'phone_or_user_id_required' }, { status: 422 });
    }

    const [uRows] = await pool.query(
      `SELECT u.id, u.name, u.contact_number, u.user_type, ut.user_type AS related_type
       FROM users u
       LEFT JOIN user_types ut ON ut.id = u.user_type_id
       WHERE ${where} LIMIT 1`,
      params
    );
    const user = Array.isArray(uRows) && (uRows as any[]).length > 0 ? (uRows as any[])[0] : null;
    if (!user) {
      return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
    }
    
    // Determine effective user_type (from user_type column or user_types table)
    const userType = (user.user_type || '').toString().trim().toLowerCase();
    const relatedType = (user.related_type || '').toString().trim().toLowerCase();
    const effectiveUserType = userType || relatedType || '';

    // Parallel work (DB IO is async; leverage pool.query in parallel).
    const recentPromise = pool
      .query(
        `SELECT sa.id, sa.aadhar_no, sa.created_at, sa.updated_at
         FROM survey_aadhar sa
         WHERE sa.user_id = ?
         ORDER BY sa.id DESC
         LIMIT 5`,
        [user.id]
      )
      .then(([r]) => (Array.isArray(r) ? (r as any[]) : []))
      .catch(() => [] as any[]);

    // Debug: Check total surveys count
    const debugCountPromise = pool
      .query(`SELECT COUNT(*) as total FROM surveys WHERE user_id = ?`, [user.id])
      .then(([rows]) => {
        const total = Array.isArray(rows) && (rows as any[]).length > 0 ? Number((rows as any[])[0]?.total) : 0;
        console.log(`Total surveys for user ${user.id}: ${total}`);
        return total;
      })
      .catch(() => 0);

    // Get all mandatory/required questions (is_required = 1)
    const requiredQuestionsPromise = pool
      .query(
        `SELECT id FROM questions 
         WHERE is_required = 1
           AND (status = 'Active' OR status IS NULL OR status = '')
         ORDER BY id`,
        []
      )
      .then(([rows]) => {
        const requiredIds = new Set<number>();
        if (Array.isArray(rows)) {
          (rows as any[]).forEach((r: any) => {
            if (r?.id) requiredIds.add(Number(r.id));
          });
        }
        console.log(`Found ${requiredIds.size} required questions`);
        return requiredIds;
      })
      .catch((err) => {
        console.error('Error fetching required questions:', err);
        return new Set<number>();
      });

    const countsPromise = pool
      .query(
        `SELECT id, survey_json, no_of_questions_answered, no_of_questions_unanswered
         FROM surveys WHERE user_id = ?`,
        [user.id]
      )
      .then(async (surveysResult) => {
        const requiredQuestionIds = await requiredQuestionsPromise;
        const totalSurveys = await debugCountPromise;
        
        const surveys = Array.isArray(surveysResult[0]) ? (surveysResult[0] as any[]) : [];
        let completed = 0;
        let pending = 0;

        for (const survey of surveys) {
          if (!survey.survey_json) {
            pending++;
            continue;
          }

          try {
            const surveyData = typeof survey.survey_json === 'string' 
              ? JSON.parse(survey.survey_json) 
              : survey.survey_json;
            
            const answers = surveyData.answers || [];
            const answeredQuestionIds = new Set<number>();
            
            // Collect all answered question IDs (excluding '--' answers)
            answers.forEach((ans: any) => {
              const qid = Number(ans.question_id);
              const answer = String(ans.answer || '').trim();
              if (qid && answer && answer !== '--' && answer !== '') {
                answeredQuestionIds.add(qid);
              }
            });

            // Check if all required questions are answered
            let allRequiredAnswered = true;
            for (const reqId of requiredQuestionIds) {
              if (!answeredQuestionIds.has(reqId)) {
                allRequiredAnswered = false;
                break;
              }
            }

            if (allRequiredAnswered && requiredQuestionIds.size > 0) {
              completed++;
            } else {
              pending++;
            }
          } catch (parseError) {
            console.error('Error parsing survey JSON for survey', survey.id, ':', parseError);
            pending++;
          }
        }

        console.log(`Dashboard counts for user ${user.id}: total=${totalSurveys}, required_questions=${requiredQuestionIds.size}, completed=${completed}, pending=${pending}`);
        return { completed, pending };
      })
      .catch((err) => {
        console.error('Dashboard counts query error for user', user.id, ':', err);
        return { completed: 0, pending: 0 };
      });

    // Fetch rate in parallel too
    const ratePromise = pool
      .query(`SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1`, ['rate_per_survey_field_officer'])
      .then(([rows]) => {
        const val = Array.isArray(rows) && (rows as any[]).length ? (rows as any[])[0].setting_value : null;
        const parsed = parseFloat(val || '10');
        return isFinite(parsed) && parsed >= 0 ? parsed : 10;
      })
      .catch(() => 10);

    const [recent, counts, rate] = await Promise.all([recentPromise, countsPromise, ratePromise]);
    const wallet = (counts?.completed || 0) * (rate || 10);

    return NextResponse.json({
      ok: true,
      user: { 
        id: user.id, 
        name: user.name, 
        phone: user.contact_number,
        user_type: effectiveUserType,
      },
      wallet,
      rate,
      counts: counts || { completed: 0, pending: 0 },
      recent_surveys: recent,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}


