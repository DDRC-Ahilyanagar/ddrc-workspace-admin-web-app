/**
 * @fileoverview Questions Retrieval API Route with Dynamic Options Injection
 * @module app/api/get-questions
 * @description This API endpoint retrieves survey questions from the database and dynamically
 * injects options from related tables (disability types, sports, organs). It supports both
 * standard and public form question sets.
 * 
 * @author DDRC Development Team
 * @created 2026-02-14
 * @lastModified 2026-02-17
 * 
 * Key Features:
 * - Retrieves questions from MySQL database with section information
 * - Dynamically injects disability types from disability_types table
 * - Dynamically injects sports types and game names from sports tables
 * - Dynamically injects disability organs from disability_organs table
 * - Supports public form questions (separate table)
 * - Auto-creates and seeds reference tables if they don't exist
 * - Returns questions with proper Marathi/English bilingual options
 * 
 * Dynamic Injection Mappings:
 * - Question ID 69: Disability Types (दिव्यांगता प्रकार)
 * - Question ID 22: Sports Types (खेळ प्रकार)
 * - Question ID 23: Game Names (खेळाचे नाव)
 * - Question IDs 73, 101: Disability Organs (दिव्यांगता अवयव)
 * 
 * @see {@link https://surveyapi.ddrcnagar.in/api-docs} API Documentation
 */

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

  // Removed the isPublic JSON check to pick up questions from MySQL only as requested


  try {
    // Join with sections to include section names and titles
    // Only fetch active questions
    let query = '';

    if (isPublic) {
      // FETCH FROM NEW TABLE FOR PUBLIC FORM
      query = `
        SELECT q.*, s.name AS section_name, s.name as title, s.title_marathi 
        FROM public_form_questions q
        LEFT JOIN sections s ON q.section_id = s.id
        WHERE q.status = 'Active' OR q.status IS NULL
        ORDER BY q.sort_order ASC, q.id ASC
      `;
    } else {
      // STANDARD FETCH FOR OTHER USES
      query = `
        SELECT q.*, s.name AS section_name, s.name as title, s.title_marathi 
        FROM questions q
        LEFT JOIN sections s ON q.section_id = s.id
        WHERE q.status = 'Active' OR q.status IS NULL
        ORDER BY q.id ASC
      `;
    }

    const rows = await dbQuery(query);

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

        // Inject disability types (69)
        const [types]: any = await conn.query(
          'SELECT label_marathi, label_english FROM disability_types ORDER BY id ASC'
        );
        const options = Array.isArray(types)
          ? (types as any[])
            .map((t: any) => `${String(t.label_marathi || '').trim()}/${String(t.label_english || '').trim()}`)
            .filter((s: string) => s.length > 2) // length > 2 ensures we have more than just a '/'
            .join(',')
          : '';

        if (options) {
          for (const r of rows as any[]) {
            const questionText = String(r.question || '').trim();
            const questionId = parseInt(r.id || '0');
            if (questionId === 69 ||
              questionText.includes('दिव्यांगता प्रकार') ||
              questionText.toLowerCase().includes('disability type')) {
              r.options = options;
            }
          }
        }

        // Inject sports data (22 = खेळ प्रकार, 23 = खेळाचे नाव)
        const [sportsTypes]: any = await conn.query(
          `SELECT id, name_marathi, name_english FROM sports_types WHERE is_active = 1 ORDER BY sort_order ASC`
        );
        const [sportNames]: any = await conn.query(
          `SELECT id, sports_type_id as type_id, name_marathi, name_english FROM sport_names WHERE is_active = 1 ORDER BY sort_order ASC`
        );

        const mappedTypes = Array.isArray(sportsTypes) ? sportsTypes.map((t: any) => ({
          id: t.id,
          name: `${String(t.name_marathi || '').trim()}/${String(t.name_english || '').trim()}`
        })) : [];

        const mappedGames = Array.isArray(sportNames) ? sportNames.map((n: any) => ({
          id: n.id,
          type_id: n.type_id,
          name: `${String(n.name_marathi || '').trim()}/${String(n.name_english || '').trim()}`
        })) : [];

        for (const r of rows as any[]) {
          const qid = parseInt(r.id || '0');
          const questionText = String(r.question || '').trim();

          if (qid === 22 || questionText.includes('खेळ प्रकार')) {
            r.options = JSON.stringify(mappedTypes);
          }
          if (qid === 23 || questionText.includes('खेळाचे नाव') || questionText.includes('कोणता खेळ')) {
            r.options = JSON.stringify(mappedGames);
          }
        }

        // Inject disability organs (73, 101)
        const [organs]: any = await conn.query(
          `SELECT label_marathi, label_english FROM disability_organs 
           WHERE is_active = 1 
           ORDER BY sort_order ASC, id ASC`
        );

        const organOptions = Array.isArray(organs)
          ? (organs as any[])
            .map((o: any) => `${String(o.label_marathi || '').trim()}/${String(o.label_english || '').trim()}`)
            .filter((s: string) => s.length > 2)
            .join(',')
          : '';

        if (organOptions) {
          for (const r of rows as any[]) {
            const qid = parseInt(r.id || '0');
            const questionText = String(r.question || '').trim();
            const isOrganQuestion = questionText.includes('दिव्यांगता अवयव') &&
              !questionText.includes('उपचार') &&
              !questionText.includes('बरे होण्यासाठी');
            if (qid === 73 || qid === 101 || isOrganQuestion) {
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

