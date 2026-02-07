import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const pool = getDbPool();
        const conn = await pool.getConnection();
        try {
            const url = new URL(req.url);
            const sectionId = url.searchParams.get('section_id');

            let sql = "UPDATE questions SET is_required = '1' WHERE is_active = 1";
            const params = [];

            if (sectionId) {
                sql += ' AND section_id = ?';
                params.push(sectionId);
            }

            Logger.info('mark_all_required', { sql, params });
            await conn.query(sql, params);

            return NextResponse.json({ ok: true });
        } finally {
            conn.release();
        }
    } catch (e: any) {
        Logger.error('mark_all_required_error', { error: e.message });
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
