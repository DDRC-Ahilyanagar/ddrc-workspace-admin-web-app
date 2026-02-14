const mysql = require('mysql2/promise');

async function main() {
    const connection = await mysql.createConnection('mysql://root:@127.0.0.1:3306/ddrc_surveys');
    try {
        const [rows] = await connection.execute('DESCRIBE notifications');
        console.log('Columns in notifications table:');
        rows.forEach(row => {
            console.log(`- ${row.Field} (${row.Type})`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

main();
