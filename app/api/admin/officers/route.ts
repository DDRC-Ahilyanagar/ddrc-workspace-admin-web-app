import { NextRequest, NextResponse } from 'next/server';
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
      // Get all field officers (users with userType = 'field_officer')
      const officers = await prisma.user.findMany({
        where: {
          userType: 'field_officer',
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          contactNumber: true,
          email: true,
          lastLogin: true,
          createdAt: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

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
          const userId = Number(officer.id);

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

