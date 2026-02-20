const mysql = require('mysql2/promise');

async function main() {
    const connection = await mysql.createConnection('mysql://root:@127.0.0.1:3306/ddrc_surveys');
    try {
        const [result] = await connection.execute(`
      INSERT INTO notifications (user_id, from_user_id, field_officer_id, type, title, message, data, created_at)
      VALUES (27, NULL, 27, 'test', 'Test Notification', 'This is a test notification at ' + NOW(), '{"test":true}', NOW())
    `);
        console.log('Inserted test notification ID:', result.insertId);
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

main();
