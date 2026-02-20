import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/surveys/[id]/mark-rejected
 * Verification officer marks a survey as rejected
 */
export const POST = requireAuth(async (request: NextRequest, user) => {
  // Only verification officer can mark as rejected
  const userType = user.user_type?.toLowerCase() || '';
  if (userType !== 'verification_officer') {
    return NextResponse.json(
      { ok: false, error: 'Only verification officer can mark surveys as rejected' },
      { status: 403 }
    );
  }

  const surveyId = request.nextUrl.pathname.split('/').filter(Boolean).slice(-2)[0];
  if (!surveyId) {
    return NextResponse.json({ ok: false, error: 'Survey ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const rejectionReason = (body.reason || '').trim();

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Check if survey exists and is assigned to this verification officer
      const [surveyRows]: any = await conn.query(
        `SELECT id, assigned_to, verification_status FROM surveys WHERE id = ? LIMIT 1`,
        [surveyId]
      );

      if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
        return NextResponse.json({ ok: false, error: 'Survey not found' }, { status: 404 });
      }

      const survey = surveyRows[0];

      // Mark as rejected
      await conn.query(
        `UPDATE surveys 
         SET verification_status = 'rejected',
             verified_by = ?,
             verified_at = NOW(),
             admin_corrections = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [user.id, rejectionReason || null, surveyId]
      );

      Logger.info('SURVEY_MARKED_REJECTED', {
        survey_id: surveyId,
        verification_officer_id: user.id,
        has_reason: !!rejectionReason,
      });

      return NextResponse.json({ ok: true, message: 'Survey marked as rejected' });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('SURVEY_REJECTION_ERROR', { error: error?.message || String(error) });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to mark survey as rejected' },
      { status: 500 }
    );
  }
});


