import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { user, error } = await verifyAuth(request);
  if (!user || error) {
    return NextResponse.json({ ok: false, error: error || 'Authentication required' }, { status: 401 });
  }

  const pool = getDbPool();
  const conn = await pool.getConnection();
  try {
    // Ensure passkey column exists
    try {
      const [cols]: any = await conn.query("SHOW COLUMNS FROM users LIKE 'passkey'");
      if (!Array.isArray(cols) || cols.length === 0) {
        await conn.query('ALTER TABLE users ADD COLUMN passkey INT NULL');
        // Add unique index if column was just created
        try {
          const [idxCheck]: any = await conn.query("SHOW INDEX FROM users WHERE Key_name = 'unique_passkey'");
          if (!Array.isArray(idxCheck) || idxCheck.length === 0) {
            await conn.query('ALTER TABLE users ADD UNIQUE KEY unique_passkey (passkey)');
          }
        } catch {}
      }
    } catch (e: any) {
      // Column might already exist, continue
    }

    // Generate unique 4-digit passkey
    let passkey = 0;
    for (let i = 0; i < 20; i++) {
      const candidate = Math.floor(1000 + Math.random() * 9000);
      const [rows]: any = await conn.query('SELECT id FROM users WHERE passkey = ? LIMIT 1', [candidate]);
      if (!Array.isArray(rows) || rows.length === 0) {
        passkey = candidate;
        break;
      }
    }
    if (!passkey) {
      return NextResponse.json({ ok: false, error: 'Failed to generate unique passkey' }, { status: 500 });
    }

    await conn.query('UPDATE users SET passkey = ? WHERE id = ? LIMIT 1', [passkey, user.id]);
    return NextResponse.json({ ok: true, passkey });
  } finally {
    conn.release();
  }
}


