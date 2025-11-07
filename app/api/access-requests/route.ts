import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { dbQuery } from '@/lib/db';
import { Logger } from '@/lib/logger';

const VALID_STATUSES = ['pending', 'approved', 'declined'];

export const GET = requireAuth(async (request: NextRequest, user) => {
  if (!user.user_type || user.user_type.toLowerCase() !== 'admin') {
    Logger.error('ACCESS_REQUESTS_FORBIDDEN', { user_id: user.id, user_type: user.user_type });
    return NextResponse.json({ ok: false, error: 'परवानगी नाही' }, { status: 403 });
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const conditions: string[] = [];
  const params: any[] = [];

  if (statusParam && VALID_STATUSES.includes(statusParam)) {
    conditions.push('status = ?');
    params.push(statusParam);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await dbQuery<any>(
    `SELECT id,
            name,
            phone,
            selfie_url,
            status,
            admin_note,
            created_at,
            updated_at
     FROM access_requests
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT 200`,
    params
  );

  return NextResponse.json({ ok: true, data: rows });
});


