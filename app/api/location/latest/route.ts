import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { getAllLocations, isOnline } from '@/lib/location-store';
import { requireAuth } from '@/lib/auth';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Get latest location for all field officers (Admin only)
 * Uses in-memory storage (not database)
 */
export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    // Check if user is admin
    const userType = (user?.user_type || '').toLowerCase().trim();
    if (userType !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Only admins can view locations' },
        { status: 403 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Get all active field officers (ensure unique by user_id)
      const [users]: any = await conn.query(`
        SELECT DISTINCT
          id as user_id,
          name,
          contact_number
        FROM users
        WHERE LOWER(TRIM(user_type)) = 'field_officer'
        AND LOWER(TRIM(status)) = 'active'
        AND is_active = 1
        ORDER BY name ASC
      `);

      // Get all locations from memory store
      const allLocations = getAllLocations();
      const locationMap = new Map(allLocations.map(loc => [loc.user_id, loc]));

      // Combine user data with location data
      const locations = users.map((u: any) => {
        const userId = Number(u.user_id);
        const location = locationMap.get(userId);
        return {
          user_id: u.user_id.toString(), // Return as string to client to avoid BigInt serialization issues
          name: u.name,
          contact_number: u.contact_number,
          latitude: location?.latitude || null,
          longitude: location?.longitude || null,
          accuracy: location?.accuracy || null,
          altitude: location?.altitude || null,
          speed: location?.speed || null,
          heading: location?.heading || null,
          timestamp: location?.timestamp || null,
          last_online: location?.last_online ? location.last_online.toISOString() : null,
          is_online: location ? isOnline(u.user_id) ? 1 : 0 : 0,
        };
      });

      // Sort by online status, then timestamp, then name
      locations.sort((a: any, b: any) => {
        if (a.is_online !== b.is_online) return b.is_online - a.is_online;
        if (a.timestamp && b.timestamp) {
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        }
        if (a.timestamp) return -1;
        if (b.timestamp) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      return NextResponse.json({
        ok: true,
        locations: locations || [],
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('Error fetching locations:', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch locations' },
      { status: 500 }
    );
  }
});

