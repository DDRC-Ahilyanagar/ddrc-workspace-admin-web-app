import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const headerSource = req.headers.get('x-source')?.toString().toLowerCase() ?? '';
    const headerRole = req.headers.get('x-role')?.toString().toLowerCase() ?? '';

    const source = (body.source || headerSource || '').toString().toLowerCase();
    const role = (body.role || headerRole || '').toString().toLowerCase();
    const phone = (body.phone || '').replace(/\D/g, '');
    const userId = parseInt(body.user_id || '0');

    if (source === 'web' && role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'forbidden_role' },
        { status: 403 }
      );
    }

    const allowedMobileRoles = ['field_officer', 'supervisor', 'therapy_specialist', 'admin'];
    if (source && source !== 'web' && role && !allowedMobileRoles.includes(role)) {
      return NextResponse.json(
        { ok: false, error: 'forbidden_role' },
        { status: 403 }
      );
    }

    const pool = getDbPool();

    // Resolve target user
    const params: any[] = [];
    let where = '';
    if (phone) {
      where = 'contact_number = ?';
      params.push(phone);
    } else if (userId > 0) {
      where = 'id = ?';
      params.push(userId);
    } else {
      return NextResponse.json({ ok: false, error: 'phone_or_user_id_required' }, { status: 422 });
    }

    const [uRows] = await pool.query(
      `SELECT id, name, contact_number FROM users WHERE ${where} LIMIT 1`,
      params
    );
    const user = Array.isArray(uRows) && (uRows as any[]).length > 0 ? (uRows as any[])[0] : null;
    if (!user) {
      return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
    }

    // Parallel work (DB IO is async; leverage pool.query in parallel).
    const recentPromise = pool
      .query(
        `SELECT sa.id, sa.aadhar_no, sa.created_at, sa.updated_at
         FROM survey_aadhar sa
         WHERE sa.user_id = ?
         ORDER BY sa.id DESC
         LIMIT 5`,
        [user.id]
      )
      .then(([r]) => (Array.isArray(r) ? (r as any[]) : []))
      .catch(() => [] as any[]);

    const countsPromise = pool
      .query(
        `SELECT 
           SUM(CASE WHEN no_of_questions_unanswered = 0 THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN no_of_questions_unanswered > 0 OR no_of_questions_unanswered IS NULL THEN 1 ELSE 0 END) AS pending
         FROM surveys WHERE user_id = ?`,
        [user.id]
      )
      .then(([rows]) => {
        if (Array.isArray(rows) && (rows as any[]).length > 0) {
          const r = (rows as any[])[0];
          return {
            completed: parseInt(r?.completed || 0),
            pending: parseInt(r?.pending || 0),
          };
        }
        return { completed: 0, pending: 0 };
      })
      .catch(() => ({ completed: 0, pending: 0 }));

    // Fetch rate in parallel too
    const ratePromise = pool
      .query(`SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1`, ['rate_per_survey_field_officer'])
      .then(([rows]) => {
        const val = Array.isArray(rows) && (rows as any[]).length ? (rows as any[])[0].setting_value : null;
        const parsed = parseFloat(val || '10');
        return isFinite(parsed) && parsed >= 0 ? parsed : 10;
      })
      .catch(() => 10);

    const [recent, counts, rate] = await Promise.all([recentPromise, countsPromise, ratePromise]);
    const wallet = (counts?.completed || 0) * (rate || 10);

    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, phone: user.contact_number },
      wallet,
      rate,
      counts: counts || { completed: 0, pending: 0 },
      recent_surveys: recent,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}


