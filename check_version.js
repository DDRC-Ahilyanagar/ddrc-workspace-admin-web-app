const mysql = require('mysql2/promise');
require('dotenv').config();

async function describeTable() {
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL);
        const [rows] = await connection.execute('DESCRIBE survey_assignments');
        console.log(JSON.stringify(rows, null, 2));
        await connection.end();
    } catch (error) {
        console.error('Error:', error.message);
    }
}

describeTable();
