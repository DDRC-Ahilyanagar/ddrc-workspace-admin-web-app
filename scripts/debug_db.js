const mysql = require('mysql2/promise');

async function main() {
    const connection = await mysql.createConnection('mysql://root:@127.0.0.1:3306/ddrc_surveys');
    try {
        const [rows] = await connection.execute('SELECT id, user_id, title, is_read, created_at FROM notifications ORDER BY created_at DESC LIMIT 5');
        console.log('Recent Notifications:', JSON.stringify(rows, null, 2));

        const [surveyId90] = await connection.execute('SELECT id, user_id, assigned_to FROM surveys WHERE id = 90');
        console.log('Survey 90 assignment:', JSON.stringify(surveyId90, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

main();
