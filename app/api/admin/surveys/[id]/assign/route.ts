import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/surveys/[id]/assign
 * Admin assigns a survey to a verification officer
 */
export const POST = requireAuth(async (request: NextRequest, user) => {
  // Only admin can assign surveys
  if (user.user_type?.toLowerCase() !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'Only admin can assign surveys' },
      { status: 403 }
    );
  }

  const surveyId = request.nextUrl.pathname.split('/').filter(Boolean).slice(-2)[0];
  if (!surveyId) {
    return NextResponse.json({ ok: false, error: 'Survey ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const verificationOfficerId = parseInt(body.verification_officer_id || '0');

    if (!verificationOfficerId || verificationOfficerId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Valid verification officer ID required' },
        { status: 400 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Verify the user is a verification officer
      const [officerRows]: any = await conn.query(
        `SELECT u.id, u.user_type, ut.user_type AS type_from_table
         FROM users u
         LEFT JOIN user_types ut ON ut.id = u.user_type_id
         WHERE u.id = ? 
           AND (LOWER(COALESCE(u.user_type, ut.user_type, '')) = 'verification_officer')
           AND (u.status = 'active' OR u.is_active = 1)
         LIMIT 1`,
        [verificationOfficerId]
      );

      if (!Array.isArray(officerRows) || officerRows.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Verification officer not found or inactive' },
          { status: 404 }
        );
      }

      // Check if survey exists
      const [surveyRows]: any = await conn.query(
        `SELECT id FROM surveys WHERE id = ? LIMIT 1`,
        [surveyId]
      );

      if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
        return NextResponse.json({ ok: false, error: 'Survey not found' }, { status: 404 });
      }

      // Assign survey
      await conn.query(
        `UPDATE surveys 
         SET assigned_to = ?,
             verification_status = 'under_review',
             updated_at = NOW()
         WHERE id = ?`,
        [verificationOfficerId, surveyId]
      );

      Logger.info('SURVEY_ASSIGNED', {
        survey_id: surveyId,
        verification_officer_id: verificationOfficerId,
        assigned_by: user.id,
      });

      return NextResponse.json({ ok: true, message: 'Survey assigned successfully' });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('SURVEY_ASSIGNMENT_ERROR', { error: error?.message || String(error) });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to assign survey' },
      { status: 500 }
    );
  }
});

