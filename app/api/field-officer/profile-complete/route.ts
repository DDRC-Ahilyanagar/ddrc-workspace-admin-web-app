import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Check if field officer profile is complete
 * GET /api/field-officer/profile-complete?user_id=...
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'User ID is required' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      const [profiles]: any = await conn.query(
        `SELECT profile_complete 
         FROM field_officer_profiles 
         WHERE user_id = ?`,
        [userId]
      );

      const profile = Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;
      const isComplete = profile?.profile_complete === 1;

      return NextResponse.json({
        ok: true,
        profile_complete: isComplete,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('profile_complete_check_failed', { error: error.message });
    // If table doesn't exist, assume profile is incomplete
    return NextResponse.json({
      ok: true,
      profile_complete: false,
    });
  }
}





