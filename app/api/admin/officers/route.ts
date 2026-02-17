import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getDbPool } from '@/lib/db';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/admin/officers:
 *   get:
 *     summary: Get all officers with their statistics
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Officers list with stats
 */
export async function GET(request: NextRequest) {
  try {
    const pool = await getDbPool();
    const conn = await pool.getConnection();

    try {
      // Get all field officers and verification officers (users with userType = 'field_officer' or 'verification_officer')
      let officers;
      try {
        // Try to get both field_officer and verification_officer using Prisma
        // Since Prisma enum doesn't support OR easily, we'll use raw SQL for this
        const [rawOfficers]: any = await conn.query(
          `SELECT id, name, contact_number, email, user_type, last_login, created_at 
           FROM users 
           WHERE (user_type = 'field_officer' OR user_type = 'verification_officer' OR user_type = 'field officer' OR user_type = 'verification officer')
           AND (is_active = 1 OR is_active = true)
           AND (status = 'active' OR status IS NULL OR status = '')
           ORDER BY name ASC`
        );
        officers = Array.isArray(rawOfficers) ? rawOfficers.map((o: any) => ({
          id: BigInt(o.id),
          name: o.name,
          contactNumber: o.contact_number,
          email: o.email,
          userType: o.user_type,
          lastLogin: o.last_login,
          createdAt: o.created_at,
        })) : [];
        console.log('Officers query result:', { count: officers.length, officers: officers.map((o: any) => ({ id: Number(o.id), name: o.name, userType: o.userType })) });
      } catch (prismaError: any) {
        console.error('Officers query error:', prismaError);
        // Fallback: Use simpler raw SQL query if the above fails
        const [rawOfficers]: any = await conn.query(
          `SELECT id, name, contact_number, email, user_type, last_login, created_at 
           FROM users 
           WHERE (user_type = 'field_officer' OR user_type = 'verification_officer') AND is_active = 1 
           ORDER BY name ASC`
        );
        officers = Array.isArray(rawOfficers) ? rawOfficers.map((o: any) => ({
          id: BigInt(o.id),
          name: o.name,
          contactNumber: o.contact_number,
          email: o.email,
          userType: o.user_type,
          lastLogin: o.last_login,
          createdAt: o.created_at,
        })) : [];
        console.log('Raw SQL query result:', { count: officers.length });
      }

      // Get rate per survey from app_settings
      const [rateRows] = await conn.query(
        `SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1`,
        ['rate_per_survey_field_officer']
      );
      const ratePerSurvey = rateRows && Array.isArray(rateRows) && rateRows.length > 0
        ? parseFloat((rateRows[0] as any).setting_value || '0')
        : 0;

      // Get statistics for each officer
      const officersWithStats = await Promise.all(
        officers.map(async (officer: any) => {
          // Handle BigInt conversion properly
          const userId = typeof officer.id === 'bigint' ? Number(officer.id) : Number(officer.id);
          console.log('Processing officer:', { id: userId, name: officer.name });

          // Get completed surveys (where noOfQuestionsUnanswered = 0)
          const [completedRows] = await conn.query(
            `SELECT COUNT(*) as count FROM surveys 
             WHERE user_id = ? AND no_of_questions_unanswered = 0`,
            [userId]
          );
          const completedCount = completedRows && Array.isArray(completedRows) && completedRows.length > 0
            ? Number((completedRows[0] as any).count || 0)
            : 0;

          // Get incomplete surveys (where noOfQuestionsUnanswered > 0)
          const [incompleteRows] = await conn.query(
            `SELECT COUNT(*) as count FROM surveys 
             WHERE user_id = ? AND no_of_questions_unanswered > 0`,
            [userId]
          );
          const incompleteCount = incompleteRows && Array.isArray(incompleteRows) && incompleteRows.length > 0
            ? Number((incompleteRows[0] as any).count || 0)
            : 0;

          // Get completed forms list
          const [completedFormsList] = await conn.query(
            `SELECT s.id, s.aadhaar_id, sa.aadhar_no, 
                    s.no_of_questions_answered, s.created_at, s.updated_at
             FROM surveys s
             JOIN survey_aadhar sa ON s.aadhaar_id = sa.id
             WHERE s.user_id = ? AND s.no_of_questions_unanswered = 0
             ORDER BY s.updated_at DESC`,
            [userId]
          );

          // Get pending/incomplete forms list
          const [incompleteFormsList] = await conn.query(
            `SELECT s.id, s.aadhaar_id, sa.aadhar_no,
                    s.no_of_questions_answered, s.no_of_questions_unanswered, s.created_at, s.updated_at
             FROM surveys s
             JOIN survey_aadhar sa ON s.aadhaar_id = sa.id
             WHERE s.user_id = ? AND s.no_of_questions_unanswered > 0
             ORDER BY s.updated_at DESC`,
            [userId]
          );

          // Calculate wallet balance (completed surveys * rate)
          const walletBalance = completedCount * ratePerSurvey;

          // Get login activity (last login time)
          const lastLogin = officer.lastLogin
            ? new Date(officer.lastLogin).toISOString()
            : null;

          return {
            id: officer.id.toString(),
            name: officer.name,
            phone: officer.contactNumber || '-',
            email: officer.email || '-',
            userType: officer.userType || 'field_officer',
            completedForms: completedCount,
            incompleteForms: incompleteCount,
            totalForms: completedCount + incompleteCount,
            completedFormsList: Array.isArray(completedFormsList) ? completedFormsList.map((f: any) => ({
              id: f.id.toString(),
              aadhaarId: f.aadhaar_id.toString(),
              aadharNo: f.aadhar_no,
              holderName: (f as any).holder_name || '-',
              questionsAnswered: f.no_of_questions_answered,
              createdAt: f.created_at ? new Date(f.created_at).toISOString() : null,
              updatedAt: f.updated_at ? new Date(f.updated_at).toISOString() : null,
            })) : [],
            incompleteFormsList: Array.isArray(incompleteFormsList) ? incompleteFormsList.map((f: any) => ({
              id: f.id.toString(),
              aadhaarId: f.aadhaar_id.toString(),
              aadharNo: f.aadhar_no,
              holderName: (f as any).holder_name || '-',
              questionsAnswered: f.no_of_questions_answered,
              questionsUnanswered: f.no_of_questions_unanswered,
              createdAt: f.created_at ? new Date(f.created_at).toISOString() : null,
              updatedAt: f.updated_at ? new Date(f.updated_at).toISOString() : null,
            })) : [],
            lastLogin: lastLogin,
            walletBalance: walletBalance.toFixed(2),
            createdAt: officer.createdAt ? new Date(officer.createdAt).toISOString() : null,
          };
        })
      );

      return NextResponse.json({
        ok: true,
        data: officersWithStats,
        ratePerSurvey,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('Error fetching officers:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch officers' },
      { status: 500 }
    );
  }
}

