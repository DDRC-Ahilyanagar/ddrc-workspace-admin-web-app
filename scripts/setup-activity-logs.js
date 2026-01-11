require('dotenv').config();
const mysql = require('mysql2/promise');

async function setupActivityLog() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('--- Setting up survey_activity_logs table ---');

    await conn.execute(`
    CREATE TABLE IF NOT EXISTS survey_activity_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      type VARCHAR(50) NOT NULL,
      taluka VARCHAR(100) NULL,
      village VARCHAR(100) NULL,
      aadhaar_id BIGINT UNSIGNED NULL,
      details JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_user_id (user_id),
      KEY idx_type (type),
      KEY idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

    console.log('Table survey_activity_logs created successfully.');
    await conn.end();
}

setupActivityLog().catch(console.error);
