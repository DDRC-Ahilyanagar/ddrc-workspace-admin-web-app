const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const dbConfig = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'ddrc_surveys',
    };

    try {
        const connection = await mysql.createConnection(dbConfig);

        // 1. Search for the "Intent to marry" question in the main questions table
        console.log("Searching for 'marry' related questions in main table...");
        const [rows] = await connection.query("SELECT * FROM questions WHERE question LIKE '%विवाह%' OR question LIKE '%marry%'");
        console.table(rows.map(r => ({ id: r.id, question: r.question, section_id: r.section_id })));

        // 2. Check current public questions again to be sure
        console.log("\nCurrent public questions related to marriage:");
        const [publicRows] = await connection.query("SELECT * FROM public_form_questions WHERE question LIKE '%विवाह%' OR question LIKE '%marry%'");
        console.table(publicRows.map(r => ({ id: r.id, question: r.question })));

        await connection.end();
    } catch (error) {
        console.error('Error:', error.message);
    }
}

check();
