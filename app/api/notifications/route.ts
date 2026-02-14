import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * Get notifications for the current user (field officer)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.user || authResult.error) {
      return NextResponse.json(
        { ok: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = authResult.user;
    const userType = (user.user_type || '').toLowerCase();

    Logger.info('GET_NOTIFICATIONS_POLLING', {
      user_id: user.id,
      phone: user.phone,
      unread_only: request.nextUrl.searchParams.get('unread_only') === 'true'
    });


    // Only field officers can get notifications
    if (userType !== 'field_officer' && userType !== 'field officer') {
      return NextResponse.json(
        { ok: false, error: 'Only field officers can access notifications' },
        { status: 403 }
      );
    }

    let conn;
    try {
      const pool = getDbPool();
      conn = await pool.getConnection();
    } catch (dbError: any) {
      Logger.error('NOTIFICATIONS_DB_CONNECTION_FAILED', { error: dbError.message });
      return NextResponse.json(
        { ok: false, error: 'Database service unavailable' },
        { status: 503 }
      );
    }

    try {

      // Get query parameters
      const url = new URL(request.url);
      const unreadOnly = url.searchParams.get('unread_only') === 'true';
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);

      let query = `
        SELECT 
          id,
          type,
          title,
          message,
          data,
          is_read,
          read_at,
          created_at
        FROM notifications
        WHERE user_id = ?
      `;

      const params: any[] = [user.id];

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
          id: row.id,
          type: row.type,
          title: row.title,
          message: row.message,
          data: data,
          is_read: row.is_read === 1,
          read_at: row.read_at,
          created_at: row.created_at,
        };
      }) : [];

      // Get unread count
      const [countRows]: any = await conn.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
        [user.id]
      );
      const unreadCount = countRows?.[0]?.count || 0;

      // Log the result to debug why client sees 0 unread
      Logger.info('GET_NOTIFICATIONS_RESPONSE', {
        user_id: user.id,
        count: notifications.length,
        unread_count: unreadCount,
        sample: notifications.length > 0 ? {
          id: notifications[0].id,
          is_read: notifications[0].is_read,
          created_at: notifications[0].created_at
        } : null
      });

      return NextResponse.json({
        ok: true,
        notifications: notifications,
        unread_count: unreadCount,
      });

    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('GET_NOTIFICATIONS_ERROR', { error: error?.message || String(error) });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications
 * Mark notification(s) as read
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.user || authResult.error) {
      return NextResponse.json(
        { ok: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = authResult.user;
    const body = await request.json();
    const { notification_id, mark_all_read } = body;

    let conn;
    try {
      const pool = getDbPool();
      conn = await pool.getConnection();
    } catch (dbError: any) {
      return NextResponse.json({ ok: false, error: 'Database service unavailable' }, { status: 503 });
    }

    try {
      if (mark_all_read) {
        // Mark all notifications as read for this user
        await conn.query(
          `UPDATE notifications 
           SET is_read = 1, read_at = NOW() 
           WHERE user_id = ? AND is_read = 0`,
          [user.id]
        );
      } else if (notification_id) {
        // Mark specific notification as read
        await conn.query(
          `UPDATE notifications 
           SET is_read = 1, read_at = NOW() 
           WHERE id = ? AND user_id = ?`,
          [notification_id, user.id]
        );
      } else {
        return NextResponse.json(
          { ok: false, error: 'notification_id or mark_all_read required' },
          { status: 400 }
        );
      }

      return NextResponse.json({ ok: true, message: 'Notification(s) marked as read' });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('MARK_NOTIFICATION_READ_ERROR', { error: error?.message || String(error) });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}

