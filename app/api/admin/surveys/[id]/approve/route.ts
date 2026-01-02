import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/surveys/[id]/approve
 * Admin approves a verified survey
 */
export const POST = requireAuth(async (request: NextRequest, user) => {
  // Only admin can approve
  if (user.user_type?.toLowerCase() !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'Only admin can approve surveys' },
      { status: 403 }
    );
  }

  const surveyId = request.nextUrl.pathname.split('/').filter(Boolean).slice(-2)[0];
  if (!surveyId) {
    return NextResponse.json({ ok: false, error: 'Survey ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const action = (body.action || 'approve').toLowerCase(); // 'approve' or 'reject'

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Check if survey exists and is verified
      const [surveyRows]: any = await conn.query(
        `SELECT id, verification_status FROM surveys WHERE id = ? LIMIT 1`,
        [surveyId]
      );

      if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
        return NextResponse.json({ ok: false, error: 'Survey not found' }, { status: 404 });
      }

      const survey = surveyRows[0];
      if (survey.verification_status !== 'verified') {
        return NextResponse.json(
          { ok: false, error: 'Survey must be verified before approval' },
          { status: 400 }
        );
      }

      // Update survey approval status
      const approvalStatus = action === 'approve' ? 'approved' : 'rejected';
      await conn.query(
        `UPDATE surveys 
         SET admin_approval_status = ?,
             approved_by = ?,
             approved_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [approvalStatus, user.id, surveyId]
      );

      Logger.info('SURVEY_APPROVAL_UPDATED', {
        survey_id: surveyId,
        admin_id: user.id,
        action: approvalStatus,
      });

      return NextResponse.json({
        ok: true,
        message: `Survey ${approvalStatus} successfully`,
        status: approvalStatus,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('SURVEY_APPROVAL_ERROR', { error: error?.message || String(error) });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to update approval status' },
      { status: 500 }
    );
  }
});

