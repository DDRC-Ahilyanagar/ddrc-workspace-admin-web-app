import { getDbPool } from './lib/db';
import { Logger } from './lib/logger';

async function checkTokens() {
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
        const [usersWithToken]: any = await conn.query(
            "SELECT id, name, contact_number, fcm_token FROM users WHERE fcm_token IS NOT NULL"
        );
        console.log('Users with token in users table:', usersWithToken);

        const [tokensTable]: any = await conn.query(
            "SELECT user_id, fcm_token FROM fcm_tokens"
        );
        console.log('Tokens in fcm_tokens table:', tokensTable);
    } catch (error) {
        console.error('Error checking tokens:', error);
    } finally {
        conn.release();
        process.exit(0);
    }
}

checkTokens();
