require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrateAssignments() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('--- Migrating survey_assignments table ---');

    // Change enum to include accepted and rejected
    await conn.execute(`
    ALTER TABLE survey_assignments 
    MODIFY COLUMN status ENUM('pending', 'accepted', 'rejected', 'completed') DEFAULT 'pending'
  `);

    // Add rejection_reason column
    try {
        await conn.execute(`
      ALTER TABLE survey_assignments 
      ADD COLUMN rejection_reason TEXT NULL
    `);
        console.log('Added rejection_reason column.');
    } catch (e) {
        if (e.message.includes('Duplicate column')) {
            console.log('rejection_reason column already exists.');
        } else {
            throw e;
        }
    }

    console.log('Migration complete.');
    await conn.end();
}

migrateAssignments().catch(console.error);
