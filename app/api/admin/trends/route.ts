import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS survey_aadhar (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          aadhar_no VARCHAR(20) NOT NULL,
          user_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
          front_image TEXT NULL,
          back_image TEXT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY unique_aadhar (aadhar_no)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      // last 14 days trend
      const [rows] = await conn.query(
        `SELECT DATE(created_at) AS d, COUNT(*) AS c
         FROM survey_aadhar
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
         GROUP BY DATE(created_at)
         ORDER BY d ASC`
      );
      const days: string[] = [];
      const counts: number[] = [];
      const map = new Map<string, number>();
      for (const r of rows as any[]) map.set(String(r.d).slice(0,10), Number(r.c)||0);
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0,10);
        days.push(key);
        counts.push(map.get(key) || 0);
      }
      return NextResponse.json({ ok: true, data: { days, counts } });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    Logger.error('admin_trends_error', { error: e.message });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}


