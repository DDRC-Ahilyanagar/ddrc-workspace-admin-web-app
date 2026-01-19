const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'ddrc_surveys',
};

async function createTable() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        console.log('Creating test_user_logs table...');
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS test_user_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        phone VARCHAR(20) NOT NULL,
        action VARCHAR(255) NOT NULL,
        data JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_phone (phone),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        console.log('Table created successfully!');
    } catch (error) {
        console.error('Error creating table:', error);
    } finally {
        await connection.end();
    }
}

createTable();
