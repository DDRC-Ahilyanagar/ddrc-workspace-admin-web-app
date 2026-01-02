import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/surveys/[id]/verify
 * Admin adds corrections to a survey
 */
export const POST = requireAuth(async (request: NextRequest, user) => {
  // Only admin can add corrections
  if (user.user_type?.toLowerCase() !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'Only admin can add corrections' },
      { status: 403 }
    );
  }

  const surveyId = request.nextUrl.pathname.split('/').filter(Boolean).slice(-2)[0];
  if (!surveyId) {
    return NextResponse.json({ ok: false, error: 'Survey ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const corrections = (body.corrections || '').trim();

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Check if survey exists
      const [surveyRows]: any = await conn.query(
        `SELECT id FROM surveys WHERE id = ? LIMIT 1`,
        [surveyId]
      );

      if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
        return NextResponse.json({ ok: false, error: 'Survey not found' }, { status: 404 });
      }

      // Update survey with corrections and set status to under_review
      await conn.query(
        `UPDATE surveys 
         SET admin_corrections = ?,
             verification_status = 'under_review',
             updated_at = NOW()
         WHERE id = ?`,
        [corrections || null, surveyId]
      );

      Logger.info('SURVEY_CORRECTIONS_ADDED', {
        survey_id: surveyId,
        admin_id: user.id,
        has_corrections: !!corrections,
      });

      return NextResponse.json({ ok: true, message: 'Corrections added successfully' });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('SURVEY_CORRECTIONS_ERROR', { error: error?.message || String(error) });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to add corrections' },
      { status: 500 }
    );
  }
});

