import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * List all admin users with their email addresses
 * This is a diagnostic endpoint to check which admin emails are in the database
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { user, error } = await verifyAuth(request);
    if (!user || error) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only admin can view this list
    const userType = (user?.user_type || '').toLowerCase().trim();
    if (userType !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Only admins can view this list' },
        { status: 403 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();
    
    try {
      // Get all admin users (with and without email)
      const [allAdminRows]: any = await conn.query(`
        SELECT 
          u.id, 
          u.name, 
          u.email, 
          u.contact_number,
          u.user_type,
          u.status,
          u.is_active,
          CASE 
            WHEN u.email IS NULL THEN 'No Email'
            WHEN u.email = '' THEN 'Empty Email'
            WHEN u.email NOT LIKE '%@%' THEN 'Invalid Email Format'
            WHEN (u.status != 'active' AND u.is_active != 1 AND u.status IS NOT NULL) THEN 'Inactive'
            ELSE 'Valid'
          END AS email_status
        FROM users u
        WHERE u.user_type = 'admin'
        ORDER BY u.id
      `);

      const allAdmins = Array.isArray(allAdminRows) ? allAdminRows : [];

      // Get only valid admin emails (what the email service would use)
      const [validAdminRows]: any = await conn.query(`
        SELECT u.id, u.name, u.email, u.contact_number
        FROM users u
        WHERE u.user_type = 'admin'
        AND (u.status = 'active' OR u.is_active = 1 OR u.status IS NULL)
        AND u.email IS NOT NULL
        AND u.email != ''
        AND u.email LIKE '%@%'
        ORDER BY u.name
      `);

      const validAdmins = Array.isArray(validAdminRows) ? validAdminRows : [];

      return NextResponse.json({
        ok: true,
        summary: {
          total_admins: allAdmins.length,
          valid_email_admins: validAdmins.length,
          invalid_email_admins: allAdmins.length - validAdmins.length,
        },
        all_admins: allAdmins,
        valid_email_admins: validAdmins,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to list admin emails',
      },
      { status: 500 }
    );
  }
}

