import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Very simple in-memory cache (per server instance)
const cache: { data?: any; at?: number } = {};
const CACHE_TTL_MS = 30_000; // 30s

export async function GET(req: NextRequest) {
  try {
    const now = Date.now();
    if (cache.data && cache.at && now - cache.at < CACHE_TTL_MS) {
      return NextResponse.json(cache.data);
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      // Fetch directly from the DB view provided by the user
      const [rows]: any = await conn.query(
        'SELECT * FROM view_sections_with_questions WHERE question_id IS NOT NULL AND question_is_active = 1 ORDER BY question_sort_order ASC, question_id ASC'
      );
      const questions = Array.isArray(rows) ? JSON.parse(JSON.stringify(rows)) : [];

      // Build unique sections list (Marathi title only, as requested)
      const sectionSet = new Set<string>();
      for (const q of rows) {
        if (q.section_title_marathi && typeof q.section_title_marathi === 'string') {
          sectionSet.add(q.section_title_marathi);
        }
      }
      const sections = Array.from(sectionSet);

      const payload = { ok: true, data: { questions, sections } };
      cache.data = payload;
      cache.at = now;
      return NextResponse.json(payload);
    } finally {
      conn.release();
    }
  } catch (e: any) {
    Logger.error('questions_view_get_error', { error: e?.message });
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to load' }, { status: 500 });
  }
}


