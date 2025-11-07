import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { Logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const { user, error } = await verifyAuth(request);
  if (!user || error) {
    return NextResponse.json({ ok: false, error: error || 'Authentication required' }, { status: 401 });
  }

  try {
    const pool = getDbPool();
    // Update both status and is_active to ensure compatibility with different schema versions
    await pool.query(
      "UPDATE users SET status = 'inactive', is_active = 0, updated_at = NOW() WHERE id = ? LIMIT 1",
      [user.id]
    );
    Logger.info('user_deactivated', { user_id: user.id, phone: user.phone });
    return NextResponse.json({ ok: true, message: 'User deactivated successfully' });
  } catch (e: any) {
    Logger.error('user_deactivate_failed', { user_id: user.id, error: e?.message, stack: e?.stack });
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to deactivate' }, { status: 500 });
  }
}


