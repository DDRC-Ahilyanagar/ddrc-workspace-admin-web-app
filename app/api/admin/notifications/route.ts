import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/notifications
 * Get notifications for admin users
 * Returns 401 if not logged in or not admin
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    
    // Check if user is authenticated
    if (!authResult.user || authResult.error) {
      return NextResponse.json(
        { ok: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = authResult.user;
    const userType = (user.user_type || '').toLowerCase();

    // Only admin users can access this endpoint
    if (userType !== 'admin' && userType !== 'administrator') {
      return NextResponse.json(
        { ok: false, error: 'Only admin users can access notifications' },
        { status: 403 }
      );
    }

    // For now, return empty notifications array
    // This endpoint can be implemented later if needed
    return NextResponse.json({
      ok: true,
      notifications: [],
      unread_count: 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

