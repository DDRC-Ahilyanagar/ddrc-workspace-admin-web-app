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

    // Debug: Check total surveys count
    const debugCountPromise = pool
      .query(`SELECT COUNT(*) as total FROM surveys WHERE user_id = ?`, [user.id])
      .then(([rows]) => {
        const total = Array.isArray(rows) && (rows as any[]).length > 0 ? Number((rows as any[])[0]?.total) : 0;
        console.log(`Total surveys for user ${user.id}: ${total}`);
        return total;
      })
      .catch(() => 0);

    const countsPromise = pool
      .query(
        `SELECT 
           COALESCE(SUM(CASE WHEN no_of_questions_unanswered = 0 THEN 1 ELSE 0 END), 0) AS completed,
           COALESCE(SUM(CASE WHEN no_of_questions_unanswered > 0 THEN 1 ELSE 0 END), 0) AS pending
         FROM surveys WHERE user_id = ?`,
        [user.id]
      )
      .then(async ([rows]) => {
        const totalSurveys = await debugCountPromise;
        if (Array.isArray(rows) && (rows as any[]).length > 0) {
          const r = (rows as any[])[0];
          const completed = Number(r?.completed) || 0;
          const pending = Number(r?.pending) || 0;
          console.log(`Dashboard counts for user ${user.id}: total=${totalSurveys}, completed=${completed}, pending=${pending}, raw:`, r);
          return { completed, pending };
        }
        console.log(`Dashboard counts for user ${user.id}: No rows returned, total surveys: ${totalSurveys}`);
        return { completed: 0, pending: 0 };
      })
      .catch((err) => {
        console.error('Dashboard counts query error for user', user.id, ':', err);
        return { completed: 0, pending: 0 };
      });

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


