import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

const VALID_STATUSES = ['approved', 'declined'];

export const PATCH = requireAuth(async (request: NextRequest, user) => {
  if (!user.user_type || user.user_type.toLowerCase() !== 'admin') {
    Logger.error('ACCESS_REQUEST_UPDATE_FORBIDDEN', { user_id: user.id, user_type: user.user_type });
    return NextResponse.json({ ok: false, error: 'परवानगी नाही' }, { status: 403 });
  }

  const id = request.nextUrl.pathname.split('/').pop();
  if (!id) {
    return NextResponse.json({ ok: false, error: 'अवैध विनंती' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status?.toString();
  const adminNote = body?.admin_note?.toString() ?? null;

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, error: 'अवैध स्थिती' }, { status: 400 });
  }

  const pool = getDbPool();

  const [existing]: any = await pool.query(
    'SELECT id, status FROM access_requests WHERE id = ? LIMIT 1',
    [id]
  );

  if (!Array.isArray(existing) || existing.length === 0) {
    return NextResponse.json({ ok: false, error: 'विनंती आढळली नाही' }, { status: 404 });
  }

  const [result]: any = await pool.query(
    `UPDATE access_requests
     SET status = ?,
         admin_note = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
     LIMIT 1`,
    [status, adminNote, id]
  );

  Logger.info('ACCESS_REQUEST_STATUS_UPDATED', {
    id,
    status,
    admin_note: adminNote,
    updated_by: user.id,
  });

  return NextResponse.json({ ok: true, updated: result?.affectedRows === 1 });
});


