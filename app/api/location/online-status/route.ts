import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { getAllLocations, isOnline } from '@/lib/location-store';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Get online status for all field officers (polling endpoint)
 * Returns which field officers are online (location update within last 5 minutes)
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
      // Get all active field officers
      const [users]: any = await conn.query(`
        SELECT 
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

      // Build status array
      const statuses = users.map((u: any) => {
        const location = locationMap.get(u.user_id);
        return {
          user_id: u.user_id,
          name: u.name,
          contact_number: u.contact_number,
          is_online: location ? (isOnline(u.user_id) ? 1 : 0) : 0,
          last_location_update: location?.timestamp || null,
          last_online: location?.last_online ? location.last_online.toISOString() : null,
        };
      });

      // Sort by online status, then name
      statuses.sort((a: any, b: any) => {
        if (a.is_online !== b.is_online) return b.is_online - a.is_online;
        return (a.name || '').localeCompare(b.name || '');
      });

      return NextResponse.json({
        ok: true,
        statuses: statuses || [],
        timestamp: new Date().toISOString(),
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('Error fetching online status:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch online status' },
      { status: 500 }
    );
  }
});

