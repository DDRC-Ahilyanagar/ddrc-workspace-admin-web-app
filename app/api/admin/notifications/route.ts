import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/notifications
 * Get notifications for admin and verification officer users
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
    const userType = (user.user_type || '').toLowerCase().trim();

    // Only admin and verification officers can access this endpoint
    const allowedTypes = ['admin', 'administrator', 'verification_officer', 'verification officer'];
    if (!allowedTypes.includes(userType)) {
      return NextResponse.json(
        { ok: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const unreadOnly = url.searchParams.get('unread_only') === 'true';

      // Fetch notifications targeting this user type OR specifically this user
      let query = `
        SELECT 
          id,
          type,
          title,
          message,
          data,
          is_read,
          created_at
        FROM notifications
        WHERE (target_user_type = ? OR target_user_type = 'admin_all' OR user_id = ?)
      `;

      const params: any[] = [userType, user.id];

      if (unreadOnly) {
        query += ' AND is_read = 0';
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const [rows]: any = await conn.query(query, params);

      const notifications = Array.isArray(rows) ? rows.map((row: any) => {
        let data = null;
        if (row.data) {
          try {
            data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          } catch (e) {
            data = null;
          }
        }
        return {
          ...row,
          data,
          is_read: row.is_read === 1
        };
      }) : [];

      // Get unread count
      const [countRows]: any = await conn.query(
        `SELECT COUNT(*) as count FROM notifications 
         WHERE (target_user_type = ? OR target_user_type = 'admin_all' OR user_id = ?) 
         AND is_read = 0`,
        [userType, user.id]
      );
      const unreadCount = countRows?.[0]?.count || 0;

      return NextResponse.json({
        ok: true,
        notifications,
        unread_count: unreadCount,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('ADMIN_NOTIFICATIONS_API_ERROR', { error: error?.message });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/notifications
 * Mark notification(s) as read
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.user || authResult.error) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notification_id, mark_all_read } = body;

    const user = authResult.user;
    const userType = (user.user_type || '').toLowerCase().trim();

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      if (mark_all_read) {
        // Mark all notifications targeting this user type or specific user as read
        await conn.query(
          `UPDATE notifications 
           SET is_read = 1, read_at = NOW() 
           WHERE (target_user_type = ? OR target_user_type = 'admin_all' OR user_id = ?) 
           AND is_read = 0`,
          [userType, user.id]
        );
      } else if (notification_id) {
        // Mark specific notification as read
        await conn.query(
          `UPDATE notifications 
           SET is_read = 1, read_at = NOW() 
           WHERE id = ?`,
          [notification_id]
        );
      } else {
        return NextResponse.json({ ok: false, error: 'notification_id or mark_all_read required' }, { status: 400 });
      }

      return NextResponse.json({ ok: true, message: 'Notification(s) marked as read' });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('ADMIN_MARK_NOTIFICATION_READ_ERROR', { error: error?.message });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to mark notifications' },
      { status: 500 }
    );
  }
}



