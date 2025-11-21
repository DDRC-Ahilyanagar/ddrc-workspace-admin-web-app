import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

const VALID_STATUSES = ['approved', 'declined'];
const DEFAULT_MOBILE_ROLE = 'field_officer';

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
    'SELECT id, status, name, phone FROM access_requests WHERE id = ? LIMIT 1',
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

  if (status === 'approved') {
    try {
      await ensureMobileUserExists(pool, existing[0]);
    } catch (err: any) {
      Logger.error('ACCESS_REQUEST_USER_SYNC_FAILED', {
        id,
        error: err?.message ?? err,
      });
      return NextResponse.json(
        { ok: false, error: 'वापरकर्ता तयार करण्यात अडचण आली. कृपया पुन्हा प्रयत्न करा.' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, updated: result?.affectedRows === 1 });
});

async function ensureMobileUserExists(pool: ReturnType<typeof getDbPool>, requestRow: any) {
  const phone = (requestRow?.phone ?? '').toString().trim();
  if (!phone) {
    throw new Error('access_request_missing_phone');
  }
  const displayName = (requestRow?.name ?? '').toString().trim() || 'Field Officer';

  const [existingUser]: any = await pool.query(
    'SELECT id, user_type, user_type_id FROM users WHERE contact_number = ? LIMIT 1',
    [phone],
  );

  const [foType]: any = await pool.query(
    `SELECT id FROM user_types WHERE LOWER(user_type) IN ('field officer', 'field_officer') LIMIT 1`,
  );
  const fieldOfficerTypeId =
    Array.isArray(foType) && foType.length > 0 ? foType[0]?.id ?? null : null;

  if (!Array.isArray(existingUser) || existingUser.length === 0) {
    await pool.query(
      `INSERT INTO users (name, contact_number, user_type, user_type_id, status, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', 1, NOW(), NOW())`,
      [displayName, phone, DEFAULT_MOBILE_ROLE, fieldOfficerTypeId],
    );
    Logger.info('ACCESS_REQUEST_USER_AUTO_CREATED', {
      phone,
      name: displayName,
      user_type: DEFAULT_MOBILE_ROLE,
    });
    return;
  }

  const existingId = existingUser[0]?.id;
  if (!existingId) return;

  const params: any[] = [DEFAULT_MOBILE_ROLE];
  let sql = `
    UPDATE users
       SET status = 'active',
           is_active = 1,
           user_type = CASE
             WHEN user_type IS NULL OR user_type = '' THEN ?
             ELSE user_type
           END`;

  if (fieldOfficerTypeId) {
    sql += `,
           user_type_id = COALESCE(user_type_id, ?)`;
    params.push(fieldOfficerTypeId);
  }

  sql += `,
           updated_at = NOW()
     WHERE id = ?
     LIMIT 1`;
  params.push(existingId);

  await pool.query(sql, params);
  Logger.info('ACCESS_REQUEST_USER_AUTO_ACTIVATED', { user_id: existingId, phone });
}


