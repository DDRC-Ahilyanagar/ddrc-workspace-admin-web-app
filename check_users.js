
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'ddrc_surveys',
    charset: 'utf8mb4',
};

async function checkAdminUsers() {
    const pool = mysql.createPool(dbConfig);
    try {
        const [rows] = await pool.execute("SELECT id, contact_number, user_type, status, is_active FROM users");
        console.log('--- ALL USERS ---');
        console.log(JSON.stringify(rows, null, 2));

        const [types] = await pool.execute("SELECT id, user_type FROM user_types");
        console.log('--- USER TYPES ---');
        console.log(JSON.stringify(types, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkAdminUsers();
