import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const authResult = await verifyAuth(request);
        const user = authResult.user;

        const body = await request.json();
        const { type, taluka, village, aadhaar_id, details } = body;

        if (!user && !body.user_id) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const userId = user?.id || body.user_id;

        const pool = getDbPool();
        const connection = await pool.getConnection();

        try {
            await connection.execute(
                `INSERT INTO survey_activity_logs (user_id, type, taluka, village, aadhaar_id, details) 
         VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    type || 'GENERAL_ACTIVITY',
                    taluka || null,
                    village || null,
                    aadhaar_id || null,
                    details ? JSON.stringify(details) : null
                ]
            );

            Logger.info('ACTIVITY_LOGGED', { userId, type, taluka, village });

            return NextResponse.json({ ok: true });
        } finally {
            connection.release();
        }
    } catch (error: any) {
        Logger.error('LOG_ACTIVITY_FAILED', { error: error.message });
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
