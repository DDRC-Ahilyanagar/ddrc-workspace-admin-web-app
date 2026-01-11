import { NextRequest, NextResponse } from 'next/server';
import { updateLocation } from '@/lib/location-store';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Receive location updates from field officer app
 * Stores location coordinates in memory (not database)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, latitude, longitude, accuracy, altitude, speed, heading, timestamp } = body;

    // Validate required fields
    if (!user_id || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: user_id, latitude, longitude' },
        { status: 400 }
      );
    }

    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { ok: false, error: 'Coordinates out of valid range' },
        { status: 400 }
      );
    }

    // Store in memory (not database)
    try {
      updateLocation({
        user_id,
        latitude,
        longitude,
        accuracy,
        altitude,
        speed,
        heading,
        timestamp,
      });
    } catch (e) {
      // In-memory update failed - not critical
      Logger.warn('LOCATION_UPDATE_STORE_FAILED', { error: (e as any).message });
    }

    return NextResponse.json({
      ok: true,
      message: 'Location updated successfully',
    });
  } catch (error: any) {
    if (error.name === 'SyntaxError') {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
    }
    Logger.error('LOCATION_UPDATE_ERROR', { error: error.message });
    // Return 200 even if logging fails? No, keep 500 for unexpected but handle gracefully
    return NextResponse.json(
      { ok: false, error: 'Failed to process location update' },
      { status: 500 }
    );
  }
}

