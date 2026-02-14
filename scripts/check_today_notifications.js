const mysql = require('mysql2/promise');

async function main() {
    const connection = await mysql.createConnection('mysql://root:@127.0.0.1:3306/ddrc_surveys');
    try {
        const [rows] = await connection.execute(
            'SELECT id, user_id, type, title, created_at FROM notifications WHERE created_at >= CURDATE() ORDER BY created_at DESC'
        );
        console.log(`Found ${rows.length} notifications today:`);
        rows.forEach(row => {
            console.log(`- ID: ${row.id}, User: ${row.user_id}, Type: ${row.type}, Title: ${row.title}, Time: ${row.created_at}`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

main();
