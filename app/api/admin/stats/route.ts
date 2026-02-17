// Deployment trigger: Updated CI/CD secrets for separate repository mapping
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
      try { await conn.query(`ALTER TABLE answers ADD COLUMN aadhar_id BIGINT UNSIGNED NULL`); } catch (e: any) { /* ignore duplicate */ }
      try { await conn.query(`ALTER TABLE answers ADD COLUMN aadhar_no VARCHAR(20) NULL`); } catch (e: any) { /* ignore duplicate */ }
      try { await conn.query(`ALTER TABLE answers ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`); } catch (e: any) { /* ignore duplicate */ }

      // Note: We no longer use the answers table - all data is in surveys.survey_json

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

      // Run all summary queries in parallel
      const safeQuery = async (sql: string, params?: any[]) => {
        try { return await conn.query(sql, params); } catch { return [[], []] as any; }
      };
      const pTotalAadhar = conn.query(`SELECT COUNT(*) AS c FROM survey_aadhar`);
      const pTodayAadhar = conn.query(`SELECT COUNT(*) AS c FROM survey_aadhar WHERE DATE(created_at) = CURDATE()`);
      const pCompleted = conn.query(`SELECT COUNT(*) AS c FROM surveys WHERE no_of_questions_answered > 0`);
      const pPending = conn.query(`SELECT COUNT(*) AS c FROM survey_aadhar sa
         LEFT JOIN surveys s ON s.aadhaar_id = sa.id
         WHERE s.id IS NULL OR s.no_of_questions_answered = 0`);
      const pOtpToday = conn.query(`SELECT 
           SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
           SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) AS verified
         FROM otp_verifications WHERE DATE(created_at) = CURDATE()`);
      const pSections = conn.query(`SELECT name FROM sections ORDER BY name ASC`);
      const pActive1 = safeQuery(`SELECT COUNT(*) AS c FROM questions WHERE is_active = 1`);
      const pActive2 = safeQuery(`SELECT COUNT(*) AS c FROM questions WHERE status = 'Active'`);
      const pRoleCounts = safeQuery(`
        SELECT 
          LOWER(
            TRIM(
              COALESCE(NULLIF(u.user_type, ''), ut.user_type, '')
            )
          ) AS role_key,
          COUNT(*) AS cnt
        FROM users u
        LEFT JOIN user_types ut ON ut.id = u.user_type_id
        WHERE (u.status = 'active' OR u.is_active = 1 OR u.status IS NULL)
        GROUP BY role_key
      `);

      // Get field officers with their completed survey counts
      const pFieldOfficers = safeQuery(`
        SELECT 
          u.id,
          COALESCE(u.name, u.contact_number, CONCAT('User ', u.id)) AS officer_name,
          COUNT(DISTINCT s.id) AS completed_surveys
        FROM users u
        LEFT JOIN user_types ut ON ut.id = u.user_type_id
        LEFT JOIN surveys s ON s.user_id = u.id AND (s.no_of_questions_unanswered = 0 OR s.no_of_questions_answered > 0)
        WHERE (
          LOWER(COALESCE(NULLIF(u.user_type, ''), ut.user_type, '')) IN ('field_officer', 'field officer', 'officer')
        )
        AND (u.status = 'active' OR u.is_active = 1 OR u.status IS NULL)
        GROUP BY u.id, u.name, u.contact_number
        HAVING completed_surveys > 0
        ORDER BY completed_surveys DESC
        LIMIT 50
      `);

      const [
        [totalAadharRows],
        [todayAadharRows],
        [completedRows],
        [pendingRows],
        [otpTodayRows],
        [sectionsRows],
        [active1Rows],
        [active2Rows],
        [roleCountRows],
        [fieldOfficersRows],
      ] = await Promise.all([pTotalAadhar, pTodayAadhar, pCompleted, pPending, pOtpToday, pSections, pActive1, pActive2, pRoleCounts, pFieldOfficers]);

      const activeQuestions = ((active1Rows as any[])[0]?.c || 0) || ((active2Rows as any[])[0]?.c || 0) || 0;

      // Get unassigned surveys count (surveys with source = 'Divyang Self' and not assigned)
      const pUnassigned = safeQuery(`
        SELECT COUNT(DISTINCT s.id) AS c
        FROM surveys s
        WHERE (s.source = 'Divyang Self' OR s.source IS NULL)
          AND (s.assigned_to IS NULL OR s.assigned_to = 0)
      `);
      const [unassignedRows] = await pUnassigned;
      const unassignedSurveys = (unassignedRows as any[])[0]?.c || 0;

      const totalSurveys = (totalAadharRows as any[])[0]?.c || 0;
      const surveysToday = (todayAadharRows as any[])[0]?.c || 0;
      const completedSurveys = (completedRows as any[])[0]?.c || 0;
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

      // ---- Breakdown stats ----
      // Include all started surveys (not just completed)
      const [allSurveysRows] = await conn.query(`
        SELECT 
          sa.id as aadhar_id,
          sa.taluka, 
          sa.gender, 
          sa.district, 
          sa.dob,
          s.survey_json
        FROM survey_aadhar sa
        LEFT JOIN surveys s ON s.aadhaar_id = sa.id
        WHERE s.id IS NOT NULL
      `);

      const talukaMap = new Map<string, number>();
      const genderMap = new Map<string, number>();
      const districtMap = new Map<string, number>();
      const disabilityMap = new Map<string, number>();
      const udidMap = new Map<string, number>(); // 'होय' or 'नाही' or 'Unknown'

      type AgeBucket = { label: string; male: number; female: number; other: number; total: number };
      const ageBuckets: AgeBucket[] = [
        { label: '0-17', male: 0, female: 0, other: 0, total: 0 },
        { label: '18-30', male: 0, female: 0, other: 0, total: 0 },
        { label: '31-45', male: 0, female: 0, other: 0, total: 0 },
        { label: '46-60', male: 0, female: 0, other: 0, total: 0 },
        { label: '60+', male: 0, female: 0, other: 0, total: 0 },
      ];

      const normalizeGender = (value: any) => {
        const raw = (value || '').toString().trim().toLowerCase();
        if (!raw) return 'इतर';
        if (['male', 'm', 'पुरुष', 'man'].some(k => raw.includes(k))) return 'पुरुष';
        if (['female', 'f', 'स्त्री', 'woman'].some(k => raw.includes(k))) return 'स्त्री';
        return 'इतर';
      };

      const parseDobToAge = (dob: any) => {
        if (!dob) return null;
        const raw = dob.toString().trim();
        if (!raw) return null;
        let date: Date | null = null;
        const direct = new Date(raw);
        if (!isNaN(direct.getTime())) date = direct;
        if (!date && raw.includes('/')) {
          const parts = raw.split(/[\/\-\.]/).filter(Boolean);
          if (parts.length === 3) {
            const [p1, p2, p3] = parts;
            const dayFirst = new Date(`${p3.length === 4 ? p3 : `20${p3}`}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`);
            if (!isNaN(dayFirst.getTime())) date = dayFirst;
          }
        }
        if (!date) return null;
        const today = new Date();
        let age = today.getFullYear() - date.getFullYear();
        const mDiff = today.getMonth() - date.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < date.getDate())) age--;
        if (!Number.isFinite(age) || age < 0 || age > 120) return null;
        return age;
      };

      // Helper to extract answer from survey_json
      const getAnswerFromJson = (surveyJson: any, questionId: string | number): string | null => {
        if (!surveyJson) return null;
        try {
          const json = typeof surveyJson === 'string' ? JSON.parse(surveyJson) : surveyJson;
          if (!json || typeof json !== 'object') return null;
          const qid = String(questionId);
          // Check various possible structures
          if (json[qid]) return String(json[qid]).trim();
          if (json.answers && json.answers[qid]) return String(json.answers[qid]).trim();
          if (Array.isArray(json)) {
            const item = json.find((item: any) => String(item?.question_id || item?.questionId) === qid);
            return item ? String(item.answer || '').trim() : null;
          }
          return null;
        } catch {
          return null;
        }
      };

      if (Array.isArray(allSurveysRows)) {
        for (const row of allSurveysRows as any[]) {
          const talukaName = (row.taluka || 'इतर').toString().trim() || 'इतर';
          talukaMap.set(talukaName, (talukaMap.get(talukaName) || 0) + 1);

          const genderLabel = normalizeGender(row.gender);
          genderMap.set(genderLabel, (genderMap.get(genderLabel) || 0) + 1);

          const districtName = (row.district || 'इतर').toString().trim() || 'इतर';
          districtMap.set(districtName, (districtMap.get(districtName) || 0) + 1);

          // Extract disability type (question ID 69)
          const disabilityAnswer = getAnswerFromJson(row.survey_json, 69);
          if (disabilityAnswer) {
            // Normalize disability name - take first part before comma or parenthesis
            const normalized = disabilityAnswer.split(',')[0].split('(')[0].trim();
            const disabilityName = normalized || 'इतर';
            disabilityMap.set(disabilityName, (disabilityMap.get(disabilityName) || 0) + 1);
          } else {
            disabilityMap.set('निर्दिष्ट नाही', (disabilityMap.get('निर्दिष्ट नाही') || 0) + 1);
          }

          // Extract UDID status (question ID 66)
          const udidAnswer = getAnswerFromJson(row.survey_json, 66);
          if (udidAnswer) {
            const udidStatus = udidAnswer.toLowerCase().includes('होय') || udidAnswer.toLowerCase().includes('yes') ? 'होय' : 'नाही';
            udidMap.set(udidStatus, (udidMap.get(udidStatus) || 0) + 1);
          } else {
            udidMap.set('निर्दिष्ट नाही', (udidMap.get('निर्दिष्ट नाही') || 0) + 1);
          }

          const age = parseDobToAge(row.dob);
          if (age !== null) {
            let bucket: AgeBucket;
            if (age < 18) bucket = ageBuckets[0];
            else if (age <= 30) bucket = ageBuckets[1];
            else if (age <= 45) bucket = ageBuckets[2];
            else if (age <= 60) bucket = ageBuckets[3];
            else bucket = ageBuckets[4];
            bucket.total += 1;
            if (genderLabel === 'पुरुष') bucket.male += 1;
            else if (genderLabel === 'स्त्री') bucket.female += 1;
            else bucket.other += 1;
          }
        }
      }

      const taluka = Array.from(talukaMap.entries())
        .map(([name, count]) => ({ name, completed: count }))
        .sort((a, b) => b.completed - a.completed)
        .slice(0, 10);

      const gender = Array.from(genderMap.entries())
        .map(([name, count]) => ({ name, completed: count }))
        .sort((a, b) => b.completed - a.completed);

      const district = Array.from(districtMap.entries())
        .map(([name, count]) => ({ name, completed: count }))
        .sort((a, b) => b.completed - a.completed)
        .slice(0, 10);

      const disability = Array.from(disabilityMap.entries())
        .map(([name, count]) => ({ name, completed: count }))
        .sort((a, b) => b.completed - a.completed)
        .slice(0, 15); // Top 15 disability types

      const udid = Array.from(udidMap.entries())
        .map(([name, count]) => ({ name, completed: count }))
        .sort((a, b) => {
          // Sort: होय first, then नाही, then others
          if (a.name === 'होय') return -1;
          if (b.name === 'होय') return 1;
          if (a.name === 'नाही') return -1;
          if (b.name === 'नाही') return 1;
          return b.completed - a.completed;
        });

      // Process field officers data
      const fieldOfficers = Array.isArray(fieldOfficersRows)
        ? (fieldOfficersRows as any[]).map((row: any) => ({
          name: String(row.officer_name || `User ${row.id}`).trim(),
          completed: Number(row.completed_surveys) || 0
        }))
        : [];

      const ageRanges = ageBuckets.filter(bucket => bucket.total > 0);

      const roleMap: Record<string, number> = {};
      if (Array.isArray(roleCountRows)) {
        for (const row of roleCountRows as any[]) {
          const key = (row.role_key || '').toString().toLowerCase();
          const count = Number(row.cnt) || 0;
          if (!key) continue;
          roleMap[key] = (roleMap[key] || 0) + count;
        }
      }
      const fieldOfficerRoles = (roleMap['field_officer'] || 0) + (roleMap['field officer'] || 0) + (roleMap['officer'] || 0);
      const therapyRoles = (roleMap['therapy_specialist'] || 0) + (roleMap['therapy specialist'] || 0) + (roleMap['practitioner'] || 0) + (roleMap['therapist'] || 0);
      const supervisorRoles = roleMap['supervisor'] || roleMap['supervisor '] || 0;
      const adminRoles = roleMap['admin'] || roleMap['administrator'] || 0;

      return NextResponse.json({
        ok: true,
        data: {
          totalSurveys,
          surveysToday,
          completedSurveys,
          pendingSurveys,
          unassignedSurveys,
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
          sections: Array.isArray(sectionsRows) ? (sectionsRows as any[]).map((r: any) => r.name).filter((n: any) => typeof n === 'string' && n.length > 0) : [],
          breakdowns: {
            taluka,
            gender,
            district,
            disability,
            udid,
            fieldOfficers,
            ageRanges,
            pendingOverall: pendingSurveys
          },
          roles: {
            field_officer: fieldOfficerRoles,
            therapy_specialist: therapyRoles,
            supervisor: supervisorRoles,
            admin: adminRoles,
          },
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


