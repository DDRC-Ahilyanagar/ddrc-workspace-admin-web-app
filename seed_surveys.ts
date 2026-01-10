import { getDbPool } from './lib/db';
import { Logger } from './lib/logger';

/**
 * Seed script to create 10 realistic survey records
 * Reads questions from database and creates surveys with proper conditional answers
 * 
 * NOTE: Survey seeding is currently DISABLED to prevent adding sample survey records.
 * To re-enable, uncomment the seedSurveys() call at the bottom of this file.
 */

interface Question {
  id: number;
  section_id: number;
  question: string;
  question_type: string;
  options: string | null;
  multi_select: number;
  rendering_condition: string | null;
  rendering_question: string | null;
  rendering_value: string | null;
  is_required: number;
}

interface SurveyData {
  aadhar_no: string;
  holder_name: string;
  gender: string;
  dob: string;
  answers: Array<{
    question_id: number;
    section_id: number;
    answer: string;
  }>;
}

// Sample data for generating realistic surveys
const sampleNames = [
  { name: 'राजेश कुमार पाटील', gender: 'पुरुष' },
  { name: 'प्रिया देशपांडे', gender: 'स्त्री' },
  { name: 'विकास शिंदे', gender: 'पुरुष' },
  { name: 'सुनीता जाधव', gender: 'स्त्री' },
  { name: 'अमित साळुंखे', gender: 'पुरुष' },
  { name: 'कविता गायकवाड', gender: 'स्त्री' },
  { name: 'राहुल पवार', gender: 'पुरुष' },
  { name: 'स्वाती खोत', gender: 'स्त्री' },
  { name: 'नितीन कांबळे', gender: 'पुरुष' },
  { name: 'अंजली मोरे', gender: 'स्त्री' },
];

const aadharNumbers = [
  '1234-5678-9012',
  '2345-6789-0123',
  '3456-7890-1234',
  '4567-8901-2345',
  '5678-9012-3456',
  '6789-0123-4567',
  '7890-1234-5678',
  '8901-2345-6789',
  '9012-3456-7890',
  '0123-4567-8901',
];

const disabilityTypes = [
  'Blindness',
  'Low Vision',
  'Hearing Impairment',
  'Locomotor Disability',
  'Intellectual Disability',
  'Mental Illness',
  'Cerebral Palsy',
  'Autism Spectrum Disorder',
  'Multiple Disabilities including Deafblindness',
  'Specific Learning Disabilities',
];

const disabilityOrgans = [
  'डावा हात',
  'उजवा हात',
  'डावा पाय',
  'उजवा पाय',
  'दोन्ही हात',
  'दोन्ही पाय',
  'डोळे',
  'कान',
];

const maritalStatuses = ['विवाहित', 'अविवाहित', 'विधवा', 'विधुर', 'घटस्फोटीत'];
const categories = ['अनुसूचित जाती (SC)', 'अनुसूचित जमाती (ST)', 'इतर मागास वर्ग (OBC)', 'खुला प्रवर्ग (OPEN/GENERAL)'];
const educationLevels = ['अशिक्षित', 'पहिली ते चौथी', 'पाचवी ते सातवी', 'आठवी ते नववी', 'दहावी', 'बारावी', 'पदवीधर'];
const occupations = ['शिक्षण घेत आहे', 'नोकरी', 'व्यवसाय', 'शेती', 'गृहिणी', 'निवृत्त', 'बेरोजगार'];

function generateDOB(age: number): string {
  const year = new Date().getFullYear() - age;
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

async function getQuestions(): Promise<Question[]> {
  const pool = getDbPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(`
      SELECT q.id, q.section_id, q.question, q.question_type, q.options, 
             q.multi_select, q.rendering_condition, q.rendering_question, q.rendering_value,
             CASE WHEN q.rendering_condition IN ('Yes', 'yes', '1', 'true') THEN 0 ELSE 1 END AS is_required
      FROM questions q
      WHERE q.status = 'Active' OR q.status IS NULL
      ORDER BY q.id ASC
    `);
    return rows || [];
  } finally {
    conn.release();
  }
}

function generateSurveyAnswers(questions: Question[], index: number): SurveyData {
  const person = sampleNames[index];
  const aadharNo = aadharNumbers[index];
  const age = Math.floor(Math.random() * 50) + 18; // Age between 18-68
  const dob = generateDOB(age);
  const gender = person.gender;
  const isMarried = Math.random() > 0.3; // 70% married
  const hasDisability = true; // All seeded surveys have disability
  const hasUDID = Math.random() > 0.2; // 80% have UDID
  const disabilityType = getRandomItem(disabilityTypes);
  const disabilityPercentage = Math.floor(Math.random() * 50) + 40; // 40-90%
  const disabilityOrgan = getRandomItem(disabilityOrgans);
  const category = getRandomItem(categories);
  const education = getRandomItem(educationLevels);
  const occupation = getRandomItem(occupations);
  const isStudying = education.includes('शिक्षण घेत आहे') || occupation === 'शिक्षण घेत आहे';

  const answers: Array<{ question_id: number; section_id: number; answer: string }> = [];
  const answerMap = new Map<number, string>(); // Track answers for conditional logic

  // Process questions in order, handling conditionals
  for (const q of questions) {
    let answer: string | null = null;
    const qText = (q.question || '').toLowerCase();

    // Skip if conditional and condition not met
    if (q.rendering_condition && (q.rendering_condition.toLowerCase() === 'yes' || q.rendering_condition === '1' || q.rendering_condition === 'true')) {
      if (q.rendering_question && q.rendering_value) {
        // Find the rendering question
        const renderingQ = questions.find(rq => {
          const rqId = parseInt(q.rendering_question || '0');
          if (rqId > 0 && rq.id === rqId) return true;
          return (rq.question || '').trim() === (q.rendering_question || '').trim();
        });

        if (renderingQ) {
          const renderingAnswer = answerMap.get(renderingQ.id);
          const expectedValues = q.rendering_value.split(',').map(v => v.trim().toLowerCase());
          if (!renderingAnswer || !expectedValues.includes(renderingAnswer.toLowerCase())) {
            continue; // Skip this question
          }
        } else {
          continue; // Can't find rendering question, skip
        }
      }
    }

    // Generate answer based on question content
    if (qText.includes('नाव') || qText.includes('name')) {
      answer = person.name;
    } else if (qText.includes('जन्म') || qText.includes('तारीख') || qText.includes('dob') || qText.includes('birth')) {
      answer = dob;
    } else if (qText.includes('लिंग') || qText.includes('gender')) {
      answer = gender;
    } else if (qText.includes('वैवाहिक') || qText.includes('marital')) {
      answer = isMarried ? 'विवाहित' : 'अविवाहित';
    } else if (qText.includes('प्रवर्ग') || qText.includes('category') || qText.includes('caste')) {
      answer = category;
    } else if (qText.includes('शिक्षण') || qText.includes('education')) {
      answer = education;
    } else if (qText.includes('शिक्षण घेत आहे') && q.question_type.toLowerCase() === 'mcq') {
      answer = isStudying ? 'होय' : 'नाही';
    } else if (qText.includes('व्यवसाय') || qText.includes('occupation') || qText.includes('नोकरी')) {
      answer = occupation;
    } else if (qText.includes('दिव्यांगता प्रकार') || qText.includes('disability type')) {
      answer = disabilityType;
    } else if (qText.includes('दिव्यांगता टक्केवारी') || qText.includes('disability percentage')) {
      answer = `${disabilityPercentage}%`;
    } else if (qText.includes('दिव्यांगता अवयव') || qText.includes('disability organ')) {
      answer = disabilityOrgan;
    } else if (qText.includes('udid') || qText.includes('यूडीआयडी')) {
      answer = hasUDID ? 'होय' : 'नाही';
    } else if (qText.includes('आधार') && !qText.includes('अवयव')) {
      answer = aadharNo.replace(/-/g, '');
    } else if (q.question_type.toLowerCase() === 'mcq' && q.options) {
      const options = q.options.split(',').map(o => o.trim()).filter(o => o && o !== '--Select--');
      if (options.length > 0) {
        answer = getRandomItem(options);
      }
    } else if (q.question_type.toLowerCase() === 'date') {
      // Random date within last 5 years
      const date = new Date();
      date.setFullYear(date.getFullYear() - Math.floor(Math.random() * 5));
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      answer = `${day}/${month}/${year}`;
    } else if (q.question_type.toLowerCase() === 'short_answer' || q.question_type.toLowerCase() === 'text') {
      // Generate appropriate text answer
      if (qText.includes('मोबाइल') || qText.includes('phone') || qText.includes('contact')) {
        answer = `9${Math.floor(Math.random() * 9000000000) + 1000000000}`;
      } else if (qText.includes('ईमेल') || qText.includes('email')) {
        answer = `user${index}@example.com`;
      } else if (qText.includes('पिन') || qText.includes('pincode')) {
        answer = `${Math.floor(Math.random() * 900000) + 100000}`;
      } else {
        answer = '--'; // Default for unknown text fields
      }
    }

    // If still no answer and question is required, provide default
    if (!answer && q.is_required === 1) {
      if (q.question_type.toLowerCase() === 'mcq' && q.options) {
        const options = q.options.split(',').map(o => o.trim()).filter(o => o && o !== '--Select--');
        if (options.length > 0) {
          answer = options[0];
        }
      } else {
        answer = '--';
      }
    }

    // Store answer if we have one
    if (answer) {
      answers.push({
        question_id: q.id,
        section_id: q.section_id,
        answer: answer,
      });
      answerMap.set(q.id, answer);
    }
  }

  return {
    aadhar_no: aadharNo,
    holder_name: person.name,
    gender: gender,
    dob: dob,
    answers: answers,
  };
}

async function seedSurveys() {
  const pool = getDbPool();
  const conn = await pool.getConnection();

  try {
    Logger.info('seed_surveys_start', { count: 10 });

    // Get all questions
    const questions = await getQuestions();
    Logger.info('seed_surveys_questions_loaded', { count: questions.length });

    // Generate 10 surveys
    for (let i = 0; i < 10; i++) {
      const surveyData = generateSurveyAnswers(questions, i);

      // Insert into survey_aadhar
      const [aadharResult]: any = await conn.query(
        `INSERT INTO survey_aadhar (aadhar_no, holder_name, gender, dob, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [surveyData.aadhar_no, surveyData.holder_name, surveyData.gender, surveyData.dob]
      );

      const aadhaarId = aadharResult.insertId;

      // Create survey JSON payload (same format as field officer app)
      const surveyJson = {
        user_id: Math.floor(Math.random() * 5) + 1, // Random user_id 1-5
        aadhaar_id: aadhaarId,
        aadhaar_number: surveyData.aadhar_no,
        holder_name: surveyData.holder_name,
        submitted_at: new Date().toISOString(),
        answers: surveyData.answers,
      };

      // Count answered vs unanswered
      const answeredCount = surveyData.answers.filter(a => {
        const ans = a.answer?.trim() || '';
        return ans !== '' && ans !== '--';
      }).length;
      const unansweredCount = surveyData.answers.length - answeredCount;

      // Insert into surveys table
      await conn.query(
        `INSERT INTO surveys (user_id, aadhaar_id, no_of_questions_answered, no_of_questions_unanswered, survey_json, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           no_of_questions_answered = VALUES(no_of_questions_answered),
           no_of_questions_unanswered = VALUES(no_of_questions_unanswered),
           survey_json = VALUES(survey_json),
           source = VALUES(source),
           updated_at = NOW()`,
        [
          surveyJson.user_id,
          aadhaarId,
          answeredCount,
          unansweredCount,
          JSON.stringify(surveyJson),
          'Seed Data',
        ]
      );

      Logger.info('seed_surveys_created', {
        index: i + 1,
        aadhaar_id: aadhaarId,
        aadhar_no: surveyData.aadhar_no,
        answers_count: surveyData.answers.length,
        answered: answeredCount,
      });
    }

    Logger.info('seed_surveys_complete', { total: 10 });
    console.log('✅ Successfully seeded 10 surveys!');
  } catch (error: any) {
    Logger.error('seed_surveys_failed', { error: error.message, stack: error.stack });
    console.error('❌ Failed to seed surveys:', error.message);
    throw error;
  } finally {
    conn.release();
  }
}

// Run if called directly
// DISABLED: Survey seeding is disabled to prevent adding 10 sample survey records
// Uncomment below to re-enable survey seeding
/*
seedSurveys()
  .then(() => {
    console.log('✅ Seed completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
*/

// Log that seeding is disabled
console.log('⏭️  Survey seeding is disabled. To re-enable, uncomment the seedSurveys() call in seed_surveys.ts');

export { seedSurveys };

