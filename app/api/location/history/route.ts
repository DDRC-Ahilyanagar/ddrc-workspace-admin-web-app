import { NextRequest, NextResponse } from 'next/server';
import { getLocationHistory } from '@/lib/location-store';
import { requireAuth } from '@/lib/auth';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Get location history for a specific field officer (Admin only)
 * Since we're using in-memory storage, this returns only the latest location
 */
export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    // Check if user is admin
    const userType = (user?.user_type || '').toLowerCase().trim();
    if (userType !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Only admins can view location history' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'user_id parameter is required' },
        { status: 400 }
      );
    }

    // Get location history from memory store
    const history = getLocationHistory(parseInt(userId, 10), hours);

    // Format for response
    const locations = history.map(loc => ({
      id: loc.user_id, // Use user_id as id since we don't have database IDs
      user_id: loc.user_id,
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      altitude: loc.altitude,
      speed: loc.speed,
      heading: loc.heading,
      timestamp: loc.timestamp,
    }));

    return NextResponse.json({
      ok: true,
      locations: locations || [],
    });
  } catch (error: any) {
    Logger.error('Error fetching location history:', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch location history' },
      { status: 500 }
    );
  }
});

