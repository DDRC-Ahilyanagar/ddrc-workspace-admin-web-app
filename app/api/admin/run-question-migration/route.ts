import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { readFile } from 'fs/promises';
import path from 'path';

const MIGRATION_HEADER = 'x-migration-key';
const DEFAULT_MIGRATION_KEY = 'CHANGE_ME_SECRET';

export const POST = async (request: NextRequest) => {
  try {
    const headerKey = request.headers.get(MIGRATION_HEADER);
    const expectedKey =
      process.env.QUESTION_MIGRATION_KEY || DEFAULT_MIGRATION_KEY;

    if (!headerKey || headerKey !== expectedKey) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const sqlPath = path.join(process.cwd(), 'add_questions.sql');
    const sql = await readFile(sqlPath, 'utf8');

    const pool = getDbPool();

    // mysql2 supports multi-statement execution through query().
    // Ensure your MySQL user has appropriate permissions.
    await pool.query(sql);

    return NextResponse.json({
      ok: true,
      message: 'Questions migration executed.',
    });
  } catch (error: any) {
    console.error('RUN_QUESTION_MIGRATION_FAILED', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'migration failed' },
      { status: 500 }
    );
  }
};


