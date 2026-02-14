const mysql = require('mysql2/promise');

async function main() {
    const connection = await mysql.createConnection('mysql://root:@127.0.0.1:3306/ddrc_surveys');
    try {
        console.log('Adding fcm_token column to users table...');
        await connection.execute('ALTER TABLE users ADD COLUMN fcm_token TEXT AFTER status');
        console.log('Successfully added fcm_token column.');

        // Also check if notifications table exists and has correct schema
        const [tables] = await connection.execute("SHOW TABLES LIKE 'notifications'");
        if (tables.length === 0) {
            console.log('Creating notifications table...');
            await connection.execute(`
                CREATE TABLE notifications (
                    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT UNSIGNED NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    data JSON NULL,
                    is_read TINYINT(1) DEFAULT 0,
                    sent_at TIMESTAMP NULL,
                    error TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
            console.log('Successfully created notifications table.');
        } else {
            console.log('Notifications table already exists.');
        }

    } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
            console.log('fcm_token column already exists.');
        } else {
            console.error('Error:', err.message);
        }
    } finally {
        await connection.end();
    }
}

main();
