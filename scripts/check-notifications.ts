import { getDbPool } from '../lib/db';

async function checkNotifications() {
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
        const [notifications]: any = await conn.query(
            "SELECT id, user_id, title, is_read, created_at FROM notifications ORDER BY created_at DESC LIMIT 10"
        );
        console.log('Recent notifications:', notifications);
    } catch (error) {
        console.error('Error checking notifications:', error);
    } finally {
        conn.release();
        process.exit(0);
    }
}

checkNotifications();
