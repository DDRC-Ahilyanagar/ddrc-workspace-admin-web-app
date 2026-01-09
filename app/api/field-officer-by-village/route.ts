import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Get field officer assigned to a village
 * Used by public form to show concerned officer name
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const village = searchParams.get('village');
    const taluka = searchParams.get('taluka');

    if (!village) {
      return NextResponse.json(
        { ok: false, error: 'Village parameter is required' },
        { status: 400 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Get field officers and their assigned villages
      // First, try to find field officer by saved territory (village)
      let query = `
        SELECT u.id, u.name, u.contact_number, u.email
        FROM users u
        WHERE u.user_type = 'field_officer'
        AND u.status = 'active'
        AND u.is_active = 1
      `;

      // If taluka is provided, we can filter more precisely
      // For now, we'll return the first active field officer
      // You can extend this to match by saved territory in SharedPreferences
      // or create a territory_assignment table

      const [officers]: any = await conn.query(query);

      if (!Array.isArray(officers) || officers.length === 0) {
        return NextResponse.json({
          ok: true,
          officer: null,
          message: 'No field officer found for this village',
        });
      }

      // For now, return the first field officer
      // TODO: Implement proper village-to-officer mapping
      // This could be done by:
      // 1. Creating a territory_assignment table
      // 2. Storing officer's selected village in a user_preferences table
      // 3. Matching based on village name

      const officer = officers[0];

      return NextResponse.json({
        ok: true,
        officer: {
          id: officer.id,
          name: officer.name,
          phone: officer.contact_number,
          email: officer.email,
        },
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('Error fetching field officer:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Failed to fetch field officer',
      },
      { status: 500 }
    );
  }
}




