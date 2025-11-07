import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const KEY = 'rate_per_survey_field_officer';

async function ensureTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      setting_key VARCHAR(191) NOT NULL,
      setting_value VARCHAR(191) NULL,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_key (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function GET() {
  await ensureTable();
  const pool = getDbPool();
  const [rows] = await pool.query(`SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1`, [KEY]);
  const val = Array.isArray(rows) && (rows as any[]).length > 0 ? (rows as any[])[0].setting_value : null;
  const rate = parseFloat(val || '10') || 10;
  return NextResponse.json({ ok: true, rate });
}

export async function PUT(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const rate = parseFloat(String(body.rate ?? ''));
    if (!isFinite(rate) || rate < 0) return NextResponse.json({ ok: false, error: 'invalid_rate' }, { status: 422 });
    const pool = getDbPool();
    await pool.query(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [KEY, String(rate)]
    );
    return NextResponse.json({ ok: true, rate });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}


