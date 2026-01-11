const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAssignments() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'ddrc_surveys',
    });

    try {
        console.log('--- SURVEYS ---');
        const [surveys] = await pool.execute('SELECT id, user_id, source, survey_json FROM surveys LIMIT 5');
        console.log(JSON.stringify(surveys, null, 2));

        console.log('\n--- FIELD OFFICER PROFILES ---');
        const [profiles] = await pool.execute('SELECT * FROM field_officer_profiles');
        console.log(JSON.stringify(profiles, null, 2));

        console.log('\n--- SURVEY ASSIGNMENTS ---');
        const [assignments] = await pool.execute('SELECT * FROM survey_assignments');
        console.log(JSON.stringify(assignments, null, 2));

        console.log('\n--- QUESTIONS (VILLAGE/TALUKA) ---');
        const [questions] = await pool.execute("SELECT id, question FROM questions WHERE question LIKE '%गाव%' OR question LIKE '%village%' OR question LIKE '%तालुका%'");
        console.log(JSON.stringify(questions, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkAssignments();
