import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      // Ensure expected tables exist (align with create-aadhar and submit-answers routes)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS survey_aadhar (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          aadhar_no VARCHAR(20) NOT NULL,
          user_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
          front_image TEXT NULL,
          back_image TEXT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY unique_aadhar (aadhar_no)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS answers (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NULL,
          aadhar_id BIGINT UNSIGNED NULL,
          aadhar_no VARCHAR(20) NULL,
          section_id BIGINT UNSIGNED NULL,
          question_id BIGINT UNSIGNED NOT NULL,
          answer TEXT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_aadhar_id (aadhar_id),
          KEY idx_aadhar_no (aadhar_no),
          KEY idx_section (section_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // Ensure columns exist on existing deployments
      try { await conn.query(`ALTER TABLE answers ADD COLUMN aadhar_id BIGINT UNSIGNED NULL`); } catch (e:any) { /* ignore duplicate */ }
      try { await conn.query(`ALTER TABLE answers ADD COLUMN aadhar_no VARCHAR(20) NULL`); } catch (e:any) { /* ignore duplicate */ }
      try { await conn.query(`ALTER TABLE answers ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`); } catch (e:any) { /* ignore duplicate */ }

      // Detect answers column name for value storage across legacy schemas
      let answerCol = 'answer';
      try {
        const [cols]: any = await conn.query("SHOW COLUMNS FROM answers LIKE 'answer'");
        if (!Array.isArray(cols) || cols.length === 0) {
          const candidates = ['value', 'answer_text', 'resp'];
          for (const c of candidates) {
            const [cc]: any = await conn.query(`SHOW COLUMNS FROM answers LIKE '${c}'`);
            if (Array.isArray(cc) && cc.length > 0) { answerCol = c; break; }
          }
        }
      } catch {}

      // Create and seed disability_types if needed
      await conn.query(`CREATE TABLE IF NOT EXISTS disability_types (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        label_marathi VARCHAR(255) NOT NULL,
        label_english VARCHAR(255) NOT NULL,
        aliases JSON NULL,
        UNIQUE KEY uniq_labels (label_marathi, label_english)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      const [dtc]: any = await conn.query('SELECT COUNT(*) AS c FROM disability_types');
      if (((dtc as any[])?.[0]?.c || 0) === 0) {
        const seedVals = [
          ['अंध','Blindness',JSON.stringify(['Blindness','Blind','अंध'])],
          ['दृष्टिदोष','Low Vision',JSON.stringify(['Low Vision','Low-vision','दृष्टिदोष'])],
          ['कर्णबधिर','Hearing Impairment',JSON.stringify(['Hearing Impairment','deaf and hard of hearing','कर्णबधिर'])],
          ['वाचादोष','Speech and Language Disability',JSON.stringify(['Speech and Language Disability','Speech & Language','वाचादोष'])],
          ['अस्थिव्यंग','Locomotor Disability',JSON.stringify(['Locomotor Disability','अस्थिव्यंग'])],
          ['मानसिक आजार','Mental Illness',JSON.stringify(['Mental Illness','मानसिक आजार'])],
          ['अध्ययन अक्षमता','Specific Learning Disabilities',JSON.stringify(['Specific Learning Disabilities','Learning Disability','अध्ययन अक्षमता'])],
          ['सेरेब्रल पालसी - मेंदूचा पक्षाघात','Cerebral Palsy',JSON.stringify(['Cerebral Palsy','सेरेब्रल पालसी'])],
          ['स्वमग्न','Autism Spectrum Disorder',JSON.stringify(['Autism Spectrum Disorder','Autism','स्वमग्न'])],
          ['बहुविकलांग','Multiple Disabilities including Deafblindness',JSON.stringify(['Multiple Disabilities including deafblindness','Multiple Disabilities','बहुविकलांग'])],
          ['कुष्ठरोग','Leprosy Cured Persons',JSON.stringify(['Leprosy Cured persons','Leprosy','कुष्ठरोग'])],
          ['बुटकेपणा','Dwarfism',JSON.stringify(['Dwarfism','बुटकेपणा'])],
          ['मतिमंद','Intellectual Disability',JSON.stringify(['Intellectual Disability','ID','मतिमंद'])],
          ['अविकसित मांसपेशी','Muscular Dystrophy',JSON.stringify(['Muscular Dystrophy','अविकसित मांसपेशी'])],
          ['मज्जासंस्थेचे तीव्र आजार','Chronic Neurological Conditions',JSON.stringify(['Chronic Neurological conditions','Neurological','मज्जासंस्थेचे तीव्र आजार'])],
          ['मेंदूतील चेतासंस्था संबंधी आजार','Multiple Sclerosis',JSON.stringify(['Multiple Sclerosis','MS','मेंदूतील चेतासंस्था संबंधी आजार'])],
          ['रक्ता संबंधी कॅन्सर','Thalassemia',JSON.stringify(['Thalassemia','थॅलेसेमिया','रक्ता संबंधी कॅन्सर'])],
          ['रक्तवाहिन्या संबंधित आजार','Hemophilia',JSON.stringify(['Hemophilia','रक्तवाहिन्या संबंधित आजार'])],
          ['रक्ता संबंधी रक्ताचे प्रमाण कमी','Sickle Cell Disease',JSON.stringify(['Sickle Cell disease','Sickle Cell','रक्ता संबंधी रक्ताचे प्रमाण कमी'])],
          ['एसिड हल्लाग्रस्त पीडित','Acid Attack Victim',JSON.stringify(['Acid Attack victim','Acid Attack','एसिड हल्लाग्रस्त पीडित'])],
          ['कंपावत रोग',"Parkinson's Disease",JSON.stringify(["Parkinson's disease","Parkinsons","कंपावत रोग"])]
        ];
        await conn.query('INSERT INTO disability_types (label_marathi, label_english, aliases) VALUES ?', [seedVals]);
      }

      // Run all summary queries in parallel
      const safeQuery = async (sql: string, params?: any[]) => {
        try { return await conn.query(sql, params); } catch { return [[], []] as any; }
      };
      const pTotalAadhar = conn.query(`SELECT COUNT(*) AS c FROM survey_aadhar`);
      const pTodayAadhar = conn.query(`SELECT COUNT(*) AS c FROM survey_aadhar WHERE DATE(created_at) = CURDATE()`);
      const pAnswers = conn.query(`SELECT COUNT(*) AS c FROM answers`);
      const pPending = conn.query(`SELECT COUNT(*) AS c FROM survey_aadhar sa
         LEFT JOIN (SELECT DISTINCT aadhar_id FROM answers) an ON an.aadhar_id = sa.id
         WHERE an.aadhar_id IS NULL`);
      const pOtpToday = conn.query(`SELECT 
           SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
           SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) AS verified
         FROM otp_verifications WHERE DATE(created_at) = CURDATE()`);
      const pSections = conn.query(`SELECT name FROM sections ORDER BY name ASC`);
      const pActive1 = safeQuery(`SELECT COUNT(*) AS c FROM questions WHERE is_active = 1`);
      const pActive2 = safeQuery(`SELECT COUNT(*) AS c FROM questions WHERE status = 'Active'`);

      const [
        [totalAadharRows],
        [todayAadharRows],
        [answersRows],
        [pendingRows],
        [otpTodayRows],
        [sectionsRows],
        [active1Rows],
        [active2Rows],
      ] = await Promise.all([pTotalAadhar, pTodayAadhar, pAnswers, pPending, pOtpToday, pSections, pActive1, pActive2]);

      const activeQuestions = ((active1Rows as any[])[0]?.c || 0) || ((active2Rows as any[])[0]?.c || 0) || 0;

      const totalSurveys = (totalAadharRows as any[])[0]?.c || 0;
      const surveysToday = (todayAadharRows as any[])[0]?.c || 0;
      const totalAnswers = (answersRows as any[])[0]?.c || 0;
      const pendingSurveys = (pendingRows as any[])[0]?.c || 0;
      // activeQuestions already computed above
      const otpToday = (otpTodayRows as any[])[0] || { sent: 0, verified: 0 };

      // Simple derived metrics
      const completionRate = totalSurveys > 0
        ? Math.max(0, Math.min(100, Math.round(((totalSurveys - pendingSurveys) / totalSurveys) * 100)))
        : 0;

      // Officers: distinct verified phones and online window 10 minutes
      const [verifiedPhonesRows] = await conn.query(
        `SELECT phone, MAX(updated_at) AS last_at
         FROM otp_verifications
         WHERE status = 'verified'
         GROUP BY phone`
      );
      const nowOnlineWindowMinutes = 10;
      const totalOfficers = Array.isArray(verifiedPhonesRows) ? (verifiedPhonesRows as any[]).length : 0;
      let onlineOfficers = 0;
      const nowTs = Date.now();
      if (Array.isArray(verifiedPhonesRows)) {
        for (const row of verifiedPhonesRows as any[]) {
          const lastAt = new Date(row.last_at || row.updated_at || row.created_at).getTime();
          if (!isNaN(lastAt) && nowTs - lastAt <= nowOnlineWindowMinutes * 60 * 1000) onlineOfficers++;
        }
      }
      const offlineOfficers = Math.max(0, totalOfficers - onlineOfficers);

      // ---- Breakdown stats (taluka, gender, disability) ---- (parallel)
      const talukaIds = [37, 47];
      const genderId = 4;
      const disabilityId = 69;
      const pTaluka = conn.query(`SELECT COALESCE(${answerCol}, 'Unknown') AS label, COUNT(DISTINCT aadhar_id) AS completed FROM answers WHERE question_id IN (?) GROUP BY COALESCE(${answerCol}, 'Unknown') ORDER BY completed DESC`, [talukaIds]);
      const pGender = conn.query(
        `SELECT CASE
            WHEN LOWER(TRIM(${answerCol})) IN ('m','male','पुरुष') THEN 'पुरुष'
            WHEN LOWER(TRIM(${answerCol})) IN ('f','female','स्त्री') THEN 'स्त्री'
            ELSE 'इतर'
          END AS label,
          COUNT(DISTINCT aadhar_id) AS completed
         FROM answers
         WHERE question_id = ?
         GROUP BY label
         ORDER BY completed DESC`,
        [genderId]
      );
      const pDisability = conn.query(
        `SELECT dt.label_marathi AS label, COUNT(DISTINCT a.aadhar_id) AS completed
         FROM disability_types dt
         LEFT JOIN answers a
           ON a.question_id = ?
          AND (
            JSON_SEARCH(dt.aliases, 'one', a.${answerCol}) IS NOT NULL
            OR (LOWER(COALESCE(a.${answerCol}, '') COLLATE utf8mb4_unicode_ci) LIKE LOWER(CONCAT('%', dt.label_marathi COLLATE utf8mb4_unicode_ci, '%')))
            OR (LOWER(COALESCE(a.${answerCol}, '') COLLATE utf8mb4_unicode_ci) LIKE LOWER(CONCAT('%', dt.label_english COLLATE utf8mb4_unicode_ci, '%')))
          )
         GROUP BY dt.id
         ORDER BY completed DESC`,
        [disabilityId]
      );

      // Age range by gender breakdown
      const pAgeRanges = conn.query(
        `SELECT 
            CASE 
              WHEN CAST(a.${answerCol} AS UNSIGNED) BETWEEN 0 AND 5 THEN '0–5 वर्ष'
              WHEN CAST(a.${answerCol} AS UNSIGNED) BETWEEN 6 AND 14 THEN '6–14 वर्ष'
              WHEN CAST(a.${answerCol} AS UNSIGNED) BETWEEN 15 AND 18 THEN '15–18 वर्ष'
              WHEN CAST(a.${answerCol} AS UNSIGNED) BETWEEN 19 AND 35 THEN '19–35 वर्ष'
              WHEN CAST(a.${answerCol} AS UNSIGNED) BETWEEN 36 AND 60 THEN '36–60 वर्ष'
              WHEN CAST(a.${answerCol} AS UNSIGNED) >= 61 THEN '60+ वर्ष'
              ELSE 'Unknown'
            END AS age_range,
            CASE 
              WHEN LOWER(TRIM(g.${answerCol})) IN ('m','male','पुरुष') THEN 'पुरुष'
              WHEN LOWER(TRIM(g.${answerCol})) IN ('f','female','स्त्री') THEN 'स्त्री'
              ELSE 'इतर'
            END AS gender_key,
            COUNT(DISTINCT a.aadhar_id) AS c
         FROM answers a
         LEFT JOIN answers g ON g.aadhar_id = a.aadhar_id AND g.question_id = ?
         WHERE a.question_id = ? AND a.${answerCol} REGEXP '^[0-9]+'
         GROUP BY age_range, gender_key`,
        [genderId, 3]
      );
      const [[talukaCompletedRows], [genderCompletedRows], [disabilityCompletedRows], [ageRangeRows]] = await Promise.all([pTaluka, pGender, pDisability, pAgeRanges]);
      const taluka = Array.isArray(talukaCompletedRows) ? (talukaCompletedRows as any[]).map((r:any) => ({ name: r.label, completed: Number(r.completed) || 0 })) : [];
      const gender = Array.isArray(genderCompletedRows) ? (genderCompletedRows as any[]).map((r:any) => ({ name: r.label, completed: Number(r.completed) || 0 })) : [];
      const disability = Array.isArray(disabilityCompletedRows) ? (disabilityCompletedRows as any[]).map((r:any) => ({ name: r.label, completed: Number(r.completed) || 0 })) : [];

      // Build age range pivot rows
      const desiredOrder = ['0–5 वर्ष','6–14 वर्ष','15–18 वर्ष','19–35 वर्ष','36–60 वर्ष','60+ वर्ष'];
      const ageRanges = desiredOrder.map((label) => {
        const male = (ageRangeRows as any[]).find(r => r.age_range === label && r.gender_key === 'पुरुष')?.c || 0;
        const female = (ageRangeRows as any[]).find(r => r.age_range === label && r.gender_key === 'स्त्री')?.c || 0;
        const other = (ageRangeRows as any[]).find(r => r.age_range === label && r.gender_key === 'इतर')?.c || 0;
        return { label, male: Number(male)||0, female: Number(female)||0, other: Number(other)||0, total: Number(male||0)+Number(female||0)+Number(other||0) };
      });

      return NextResponse.json({
        ok: true,
        data: {
          totalSurveys,
          surveysToday,
          totalAnswers,
          pendingSurveys,
          completionRate,
          otpToday: {
            sent: Number(otpToday.sent) || 0,
            verified: Number(otpToday.verified) || 0,
          },
          officers: {
            total: totalOfficers,
            online: onlineOfficers,
            offline: offlineOfficers,
            windowMinutes: nowOnlineWindowMinutes,
          },
          activeQuestions,
          sections: Array.isArray(sectionsRows) ? (sectionsRows as any[]).map((r:any) => r.name).filter((n:any) => typeof n === 'string' && n.length > 0) : [],
          breakdowns: { taluka, gender, disability, ageRanges, pendingOverall: pendingSurveys },
        },
      });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    Logger.error('admin_stats_error', { error: e.message });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}


