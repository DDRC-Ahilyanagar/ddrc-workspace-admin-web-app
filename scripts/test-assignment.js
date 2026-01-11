require('dotenv').config();
const mysql = require('mysql2/promise');

async function testAssignment() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('--- Simulating Public Submission ---');

    // 1. Create a survey_aadhar entry first (required by handleSubmit)
    const aadharNo = '9999' + Math.floor(Math.random() * 100000000);
    const holderName = 'Test User ' + Date.now();
    const [res] = await conn.execute(
        'INSERT INTO survey_aadhar (aadhar_no, holder_name, taluka, district) VALUES (?, ?, ?, ?)',
        [aadharNo, holderName, 'Parner', 'Ahilyanagar']
    );
    const aadharId = res.insertId;

    // 2. Mock public submission payload
    const payload = {
        aadhar_id: aadharId,
        user_id: 1,
        source: 'Divyang Self',
        items: [
            { question_id: 1, answer: holderName },
            { question_id: 47, answer: 'Parner' },
            { question_id: 49, answer: 'Bhalawani' }
        ]
    };

    console.log(`Submitting survey for Aadhaar ID: ${aadharId}`);

    // We can't easily call the API route directly with fetch in this local environment without a running server,
    // but we know it calls handleSubmit. Since the server is running (npm run dev), we can use fetch.
    try {
        const response = await fetch('http://localhost:3000/api/public-submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse JSON response. Response text:', responseText);
            throw e;
        }
        console.log('Submission Result:', result);

        if (result.ok) {
            console.log('Waiting for auto-assignment (async)...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // 3. Verify assignment
            const [assignments] = await conn.query(
                'SELECT * FROM survey_assignments WHERE survey_id = ?',
                [result.survey_id]
            );
            console.log('Assignments:', assignments);

            // 4. Verify notification
            if (assignments.length > 0) {
                const [notifications] = await conn.query(
                    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
                    [assignments[0].field_officer_id]
                );
                console.log('Latest Notification for Officer:', notifications[0]);
            }
        }
    } catch (e) {
        console.error('Test failed:', e);
    }

    await conn.end();
}

testAssignment();
