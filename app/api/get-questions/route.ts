import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/get-questions:
 *   get:
 *     summary: Get all questions
 *     tags: [Questions]
 *     responses:
 *       200:
 *         description: Questions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isPublic = searchParams.get('public') === 'true';

  if (isPublic) {
    try {
      const publicPath = path.join(process.cwd(), 'prisma', 'questions_public.json');
      const data = fs.readFileSync(publicPath, 'utf8');
      const questions = JSON.parse(data);

      return NextResponse.json(
        { ok: true, data: questions },
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    } catch (error: any) {
      Logger.error('get_public_questions_fail', { error: error.message });
      return NextResponse.json({ ok: false, error: 'Failed to load public questions' }, { status: 500 });
    }
  }

  try {
    // Join with sections to include section names and titles
    // Only fetch active questions
    const rows = await dbQuery(`
      SELECT q.*, s.name AS section_name, s.name as title, s.title_marathi 
      FROM questions q
      LEFT JOIN sections s ON q.section_id = s.id
      WHERE q.status = 'Active' OR q.status IS NULL
      ORDER BY q.id ASC
    `);

    // Inject dynamic options from database tables
    try {
      const pool = getDbPool();
      const conn = await pool.getConnection();
      try {
        // Inject disability types for all questions containing "दिव्यांगता प्रकार" or "Disability Type"
        await conn.query(`CREATE TABLE IF NOT EXISTS disability_types (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          label_marathi VARCHAR(255) NOT NULL,
          label_english VARCHAR(255) NOT NULL,
          aliases JSON NULL,
          UNIQUE KEY uniq_labels (label_marathi, label_english)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        // Seed disability types if table is empty
        const [dtc]: any = await conn.query('SELECT COUNT(*) AS c FROM disability_types');
        if (((dtc as any[])?.[0]?.c || 0) === 0) {
          const seedVals = [
            ['अंध', 'Blindness', JSON.stringify(['Blindness', 'Blind', 'अंध'])],
            ['दृष्टिदोष', 'Low Vision', JSON.stringify(['Low Vision', 'Low-vision', 'दृष्टिदोष'])],
            ['कर्णबधिर', 'Hearing Impairment', JSON.stringify(['Hearing Impairment', 'deaf and hard of hearing', 'कर्णबधिर'])],
            ['वाचादोष', 'Speech and Language Disability', JSON.stringify(['Speech and Language Disability', 'Speech & Language', 'वाचादोष'])],
            ['अस्थिव्यंग', 'Locomotor Disability', JSON.stringify(['Locomotor Disability', 'अस्थिव्यंग'])],
            ['मानसिक आजार', 'Mental Illness', JSON.stringify(['Mental Illness', 'मानसिक आजार'])],
            ['अध्ययन अक्षमता', 'Specific Learning Disabilities', JSON.stringify(['Specific Learning Disabilities', 'Learning Disability', 'अध्ययन अक्षमता'])],
            ['सेरेब्रल पालसी - मेंदूचा पक्षाघात', 'Cerebral Palsy', JSON.stringify(['Cerebral Palsy', 'सेरेब्रल पालसी'])],
            ['स्वमग्न', 'Autism Spectrum Disorder', JSON.stringify(['Autism Spectrum Disorder', 'Autism', 'स्वमग्न'])],
            ['बहुविकलांग', 'Multiple Disabilities including Deafblindness', JSON.stringify(['Multiple Disabilities including deafblindness', 'Multiple Disabilities', 'बहुविकलांग'])],
            ['कुष्ठरोग', 'Leprosy Cured Persons', JSON.stringify(['Leprosy Cured persons', 'Leprosy', 'कुष्ठरोग'])],
            ['बुटकेपणा', 'Dwarfism', JSON.stringify(['Dwarfism', 'बुटकेपणा'])],
            ['मतिमंद', 'Intellectual Disability', JSON.stringify(['Intellectual Disability', 'ID', 'मतिमंद'])],
            ['अविकसित मांसपेशी', 'Muscular Dystrophy', JSON.stringify(['Muscular Dystrophy', 'अविकसित मांसपेशी'])],
            ['मज्जासंस्थेचे तीव्र आजार', 'Chronic Neurological Conditions', JSON.stringify(['Chronic Neurological conditions', 'Neurological', 'मज्जासंस्थेचे तीव्र आजार'])],
            ['मेंदूतील चेतासंस्था संबंधी आजार', 'Multiple Sclerosis', JSON.stringify(['Multiple Sclerosis', 'MS', 'मेंदूतील चेतासंस्था संबंधी आजार'])],
            ['रक्ता संबंधी कॅन्सर', 'Thalassemia', JSON.stringify(['Thalassemia', 'थॅलेसेमिया', 'रक्ता संबंधी कॅन्सर'])],
            ['रक्तवाहिन्या संबंधित आजार', 'Hemophilia', JSON.stringify(['Hemophilia', 'रक्तवाहिन्या संबंधित आजार'])],
            ['रक्ता संबंधी रक्ताचे प्रमाण कमी', 'Sickle Cell Disease', JSON.stringify(['Sickle Cell disease', 'Sickle Cell', 'रक्ता संबंधी रक्ताचे प्रमाण कमी'])],
            ['एसिड हल्लाग्रस्त पीडित', 'Acid Attack Victim', JSON.stringify(['Acid Attack victim', 'Acid Attack', 'एसिड हल्लाग्रस्त पीडित'])],
            ['कंपावत रोग', "Parkinson's Disease", JSON.stringify(["Parkinson's disease", "Parkinsons", "कंपावत रोग"])]
          ];
          await conn.query('INSERT INTO disability_types (label_marathi, label_english, aliases) VALUES ?', [seedVals]);
        }

        const [types]: any = await conn.query(
          'SELECT label_english FROM disability_types ORDER BY id ASC'
        );
        const options = Array.isArray(types)
          ? (types as any[])
            .map((t: any) => String(t.label_english || '').trim())
            .filter((s: string) => s.length > 0)
            .join(',')
          : '';

        if (options) {
          for (const r of rows as any[]) {
            const questionText = String(r.question || '').trim();
            const questionId = parseInt(r.id || '0');
            // Inject for question 69 or any question containing "दिव्यांगता प्रकार" or "Disability Type"
            if (questionId === 69 ||
              questionText.includes('दिव्यांगता प्रकार') ||
              questionText.toLowerCase().includes('disability type')) {
              r.options = options; // inject English options list
            }
          }
        }

        // Inject sports data for sports questions (22 = खेळ प्रकार, 23 = खेळ)
        // Build sports map: { "मैदानी खेळ": ["धावणे", ...], "सांघिक खेळ": [...], ... }
        const [sportsTypes]: any = await conn.query(
          `SELECT id, name_marathi FROM sports_types WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`
        );

        const [sportNames]: any = await conn.query(
          `SELECT sn.sports_type_id, sn.name_marathi 
           FROM sport_names sn
           INNER JOIN sports_types st ON sn.sports_type_id = st.id
           WHERE sn.is_active = 1 AND st.is_active = 1
           ORDER BY sn.sports_type_id ASC, sn.sort_order ASC, sn.id ASC`
        );

        if (Array.isArray(sportsTypes) && Array.isArray(sportNames)) {
          const sportsMap: Record<string, string[]> = {};

          for (const type of sportsTypes) {
            const names = sportNames
              .filter((n: any) => n.sports_type_id === type.id)
              .map((n: any) => String(n.name_marathi || '').trim())
              .filter((s: string) => s.length > 0);
            if (names.length > 0) {
              sportsMap[String(type.name_marathi || '').trim()] = names;
            }
          }

          // Inject sports map as JSON string for questions 22 and 23
          const sportsMapJson = JSON.stringify(sportsMap);

          for (const r of rows as any[]) {
            const qid = parseInt(r.id || '0');
            // Question 22: "खेळ प्रकार" - inject comma-separated types
            if (qid === 22) {
              r.options = Object.keys(sportsMap).join(',');
            }
            // Question 23: "खेळ" - inject JSON map
            if (qid === 23) {
              r.options = sportsMapJson;
            }
          }
        }

        // Inject disability organs for questions containing "दिव्यांगता अवयव" (e.g., 73, 101)
        await conn.query(`CREATE TABLE IF NOT EXISTS disability_organs (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          label_marathi VARCHAR(255) NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_label (label_marathi),
          KEY idx_sort_order (sort_order),
          KEY idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

        const [organs]: any = await conn.query(
          `SELECT label_marathi FROM disability_organs 
           WHERE is_active = 1 
           ORDER BY sort_order ASC, id ASC`
        );

        const organOptions = Array.isArray(organs)
          ? (organs as any[])
            .map((o: any) => String(o.label_marathi || '').trim())
            .filter((s: string) => s.length > 0)
            .join(',')
          : '';

        if (organOptions) {
          // Inject for question 73: दिव्यांगता अवयव (self)
          // Question 101: पत्नी किंवा पती दिव्यांगता अवयव
          // Also match any question text containing "दिव्यांगता अवयव" exactly
          for (const r of rows as any[]) {
            const qid = parseInt(r.id || '0');
            const questionText = String(r.question || '').trim();
            // Only inject if question text EXACTLY contains "दिव्यांगता अवयव" (not just "दिव्यांगता")
            const isOrganQuestion = questionText.includes('दिव्यांगता अवयव') &&
              !questionText.includes('उपचार') &&
              !questionText.includes('बरे होण्यासाठी');
            if (
              qid === 73 ||
              qid === 101 ||
              isOrganQuestion
            ) {
              r.options = organOptions;
            }
          }
        }
      } finally {
        // always release
        // @ts-ignore
        conn?.release?.();
      }
    } catch (e) {
      Logger.info('get_questions_dynamic_options_skip', { error: (e as any)?.message });
    }

    const sectionSummary: Record<number, number> = {};
    rows.forEach((r: any) => {
      const sid = parseInt(r.section_id || '0');
      sectionSummary[sid] = (sectionSummary[sid] || 0) + 1;
    });

    Logger.info('get_questions_ok', {
      count: rows.length,
      sections: sectionSummary,
    });

    return NextResponse.json(
      { ok: true, data: rows },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    Logger.error('get_questions_fail', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

