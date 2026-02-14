const mysql = require('mysql2/promise');

async function main() {
    const connection = await mysql.createConnection('mysql://root:@127.0.0.1:3306/ddrc_surveys');
    try {
        const [rows] = await connection.execute('DESCRIBE users');
        console.log('Columns in users table:');
        rows.forEach(row => {
            console.log(`- ${row.Field} (${row.Type})`);
        });

        const [fcmTokens] = await connection.execute('SELECT id, phone, fcm_token FROM users WHERE fcm_token IS NOT NULL');
        console.log('\nUsers with FCM tokens:', fcmTokens.length);
        fcmTokens.forEach(user => {
            console.log(`- User ID ${user.id} (${user.phone}): ${user.fcm_token.substring(0, 20)}...`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

main();
