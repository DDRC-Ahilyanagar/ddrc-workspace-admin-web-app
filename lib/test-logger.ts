import { getDbPool } from './db';
import { Logger } from './logger';

export async function logTestUserActivity(phone: string, action: string, data?: any) {
    // ONLY log for the specific test number
    if (phone !== '7777777777') return;

    try {
        const pool = getDbPool();
        const conn = await pool.getConnection();

        try {
            await conn.execute(
                `INSERT INTO test_user_logs (phone, action, data) VALUES (?, ?, ?)`,
                [phone, action, data ? JSON.stringify(data) : null]
            );
            Logger.info('TEST_USER_ACTIVITY_LOGGED', { phone, action });
        } finally {
            conn.release();
        }
    } catch (error: any) {
        Logger.error('TEST_USER_LOG_FAILED', { error: error.message, phone, action });
    }
}
