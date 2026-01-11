import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/users/change-role
 * Change user role between field_officer and verification_officer
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.user || authResult.error) {
      return NextResponse.json(
        { ok: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const admin = authResult.user;
    const adminType = (admin.user_type || '').toLowerCase().trim();
    
    // Only admins can change roles
    if (adminType !== 'admin' && adminType !== 'administrator') {
      return NextResponse.json(
        { ok: false, error: 'Only administrators can change user roles' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { user_id, new_role } = body;

    if (!user_id || !new_role) {
      return NextResponse.json(
        { ok: false, error: 'user_id and new_role are required' },
        { status: 400 }
      );
    }

    // Validate new_role
    const normalizedRole = new_role.toLowerCase().trim();
    if (normalizedRole !== 'field_officer' && normalizedRole !== 'verification_officer' && 
        normalizedRole !== 'field officer' && normalizedRole !== 'verification officer') {
      return NextResponse.json(
        { ok: false, error: 'new_role must be either field_officer or verification_officer' },
        { status: 400 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Get user_type_id for the new role
      const roleType = normalizedRole === 'field_officer' || normalizedRole === 'field officer' 
        ? 'field_officer' 
        : 'verification_officer';
      
      const [typeRows]: any = await conn.query(
        `SELECT id FROM user_types WHERE LOWER(TRIM(user_type)) = ? LIMIT 1`,
        [roleType]
      );

      let userTypeId = null;
      if (Array.isArray(typeRows) && typeRows.length > 0) {
        userTypeId = typeRows[0].id;
      } else {
        // Create user type if it doesn't exist
        const [insertResult]: any = await conn.query(
          `INSERT INTO user_types (user_type, created_at, updated_at) VALUES (?, NOW(), NOW())`,
          [roleType]
        );
        userTypeId = (insertResult as any).insertId;
      }

      // Get current user data (including status)
      const [userRows]: any = await conn.query(
        `SELECT id, name, user_type, user_type_id, status FROM users WHERE id = ? LIMIT 1`,
        [user_id]
      );

      if (!Array.isArray(userRows) || userRows.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'User not found' },
          { status: 404 }
        );
      }

      const currentUser = userRows[0];
      const currentRole = (currentUser.user_type || '').toLowerCase().trim();
      const currentStatus = currentUser.status || 'active'; // Preserve existing status or default to 'active'

      // Check if role is already the same
      if ((currentRole === 'field_officer' || currentRole === 'field officer') && 
          (normalizedRole === 'field_officer' || normalizedRole === 'field officer')) {
        return NextResponse.json(
          { ok: false, error: 'User is already a field officer' },
          { status: 400 }
        );
      }

      if ((currentRole === 'verification_officer' || currentRole === 'verification officer') && 
          (normalizedRole === 'verification_officer' || normalizedRole === 'verification officer')) {
        return NextResponse.json(
          { ok: false, error: 'User is already a verification officer' },
          { status: 400 }
        );
      }

      // Update user role (preserve existing status)
      await conn.query(
        `UPDATE users 
         SET user_type = ?, 
             user_type_id = ?, 
             status = ?,
             updated_at = NOW(), 
             updated_by = ?
         WHERE id = ?`,
        [roleType, userTypeId, currentStatus, admin.id, user_id]
      );

      Logger.info('USER_ROLE_CHANGED', {
        user_id: user_id,
        user_name: currentUser.name,
        old_role: currentUser.user_type,
        new_role: roleType,
        changed_by: admin.id,
        changed_by_name: admin.name
      });

      return NextResponse.json({
        ok: true,
        message: `User role changed from ${currentUser.user_type} to ${roleType}`,
        user: {
          id: user_id,
          name: currentUser.name,
          old_role: currentUser.user_type,
          new_role: roleType
        }
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('CHANGE_USER_ROLE_ERROR', {
      error: error?.message || String(error),
      stack: error?.stack
    });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to change user role' },
      { status: 500 }
    );
  }
}
