import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { dbQuery } from '@/lib/db';
import { Logger } from '@/lib/logger';

const VALID_STATUSES = ['pending', 'approved', 'declined'];

export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    console.log('Access Requests API called:', { user_id: user.id, user_type: user.user_type });
    
    if (!user.user_type || user.user_type.toLowerCase() !== 'admin') {
      Logger.error('ACCESS_REQUESTS_FORBIDDEN', { user_id: user.id, user_type: user.user_type });
      return NextResponse.json({ ok: false, error: 'परवानगी नाही' }, { status: 403 });
    }

    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status');
    console.log('Access Requests filter status:', statusParam);
    
    const conditions: string[] = [];
    const params: any[] = [];

    if (statusParam && VALID_STATUSES.includes(statusParam)) {
      conditions.push('status = ?');
      params.push(statusParam);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT id,
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
     LIMIT 200`;

    console.log('Access Requests SQL:', sql, 'Params:', params);

    const rows = await dbQuery<any>(sql, params);
    
    console.log('Access Requests query result:', { count: rows?.length || 0, sample: rows?.[0] });

    return NextResponse.json({ ok: true, data: rows || [] });
  } catch (error: any) {
    console.error('Access Requests API error:', error);
    Logger.error('ACCESS_REQUESTS_GET_ERROR', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { ok: false, error: error.message || 'विनंत्या लोड होत नाहीत' },
      { status: 500 }
    );
  }
});


