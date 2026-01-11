require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('--- Starting Manual Auto-Assignment ---');

    // Find unassigned surveys (user_id = 1 or NULL, source = Divyang Self, Excel Import, or NULL)
    const [unassignedSurveys] = await conn.query(`
    SELECT id, survey_json, source 
    FROM surveys 
    WHERE (source = 'Divyang Self' OR source = 'Excel Import' OR source IS NULL)
    AND (user_id = 1 OR user_id IS NULL)
    AND survey_json IS NOT NULL
  `);

    console.log(`Found ${unassignedSurveys.length} unassigned surveys.`);

    // Find active field officers and their villages
    const [officers] = await conn.query(`
    SELECT u.id, p.taluka, p.primary_gaav, p.additional_gaavs
    FROM users u
    JOIN field_officer_profiles p ON u.id = p.user_id
    WHERE u.user_type = 'field_officer' AND u.is_active = 1
  `);

    console.log(`Found ${officers.length} active field officers.`);

    let assignedCount = 0;

    for (const survey of unassignedSurveys) {
        let surveyJson;
        try {
            surveyJson = typeof survey.survey_json === 'string' ? JSON.parse(survey.survey_json) : survey.survey_json;
        } catch (e) {
            continue;
        }

        // Extract Taluka and Village from survey_json
        const answers = surveyJson.answers || [];
        const taluka = (answers.find(a => a.question_id === 37 || a.question_id === 47)?.answer || '').toLowerCase();
        const village = (answers.find(a => a.question_id === 39 || a.question_id === 49)?.answer || '').toLowerCase();

        if (!taluka || !village) continue;

        console.log(`Survey ${survey.id}: Found location ${taluka} / ${village}`);

        // Match with officers
        for (const officer of officers) {
            const officerTaluka = (officer.taluka || '').toLowerCase();
            const officerPrimary = (officer.primary_gaav || '').toLowerCase();
            let additional = [];
            try {
                additional = JSON.parse(officer.additional_gaavs || '[]').map(v => v.toLowerCase());
            } catch (e) { }

            if (taluka === officerTaluka) {
                if (village === officerPrimary || additional.includes(village)) {
                    console.log(`  Matching with Officer ${officer.id}`);

                    // Assign
                    await conn.execute('UPDATE surveys SET user_id = ?, updated_at = NOW() WHERE id = ?', [officer.id, survey.id]);

                    await conn.execute(`
            INSERT INTO survey_assignments 
            (survey_id, field_officer_id, source, status, assigned_at)
            VALUES (?, ?, ?, 'pending', NOW())
          `, [survey.id, officer.id, survey.source || 'Divyang Self']);

                    assignedCount++;
                    break; // Move to next survey
                }
            }
        }
    }

    console.log(`Successfully assigned ${assignedCount} surveys.`);
    await conn.end();
}

run().catch(console.error);
