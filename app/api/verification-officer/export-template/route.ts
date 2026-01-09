import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getDbPool } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Export empty Excel template with columns matching public form fields exactly
 * Fetches questions from database to match public form structure:
 * - वैयक्तिक माहिती (Personal Information) - all questions
 * - पत्ता (Address) - only "सध्याचा" (current) address questions
 * - दिव्यांगता तपशील (Disability Details) - Type, Percentage, UDID
 */
export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    // Check if user is verification officer or admin
    const userType = (user?.user_type || '').toLowerCase().trim();
    if (userType !== 'verification_officer' && userType !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Only verification officers can export template' },
        { status: 403 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Fetch questions matching public form structure
      const [questions]: any = await conn.query(`
        SELECT q.id, q.question, q.section_id, s.name AS section_name, q.question_type
        FROM questions q
        LEFT JOIN sections s ON s.id = q.section_id
        WHERE (
          -- वैयक्तिक माहिती (Personal Information) section - all questions
          (s.name = 'वैयक्तिक माहिती' OR q.section_id = 1)
          OR
          -- पत्ता (Address) section - only current address (starts with "सध्याचा")
          (s.name = 'पत्ता' AND q.question LIKE 'सध्याचा%')
          OR
          -- दिव्यांगता तपशील (Disability Details) - Type, Percentage, UDID
          (s.name = 'दिव्यांगता तपशील' AND (
            q.question LIKE '%दिव्यांगता प्रकार%' OR
            q.question LIKE '%दिव्यांगता टक्केवारी%' OR
            q.question LIKE '%वैश्विक कार्ड (UDID)%' OR
            q.question = 'वैश्विक कार्ड (UDID)'
          ))
        )
        AND (q.status = 'Active' OR q.status IS NULL)
        ORDER BY 
          CASE 
            WHEN s.name = 'वैयक्तिक माहिती' OR q.section_id = 1 THEN 1
            WHEN s.name = 'पत्ता' THEN 2
            WHEN s.name = 'दिव्यांगता तपशील' THEN 3
            ELSE 4
          END,
          q.id ASC
      `);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Divyang Data');

      // Build columns from questions
      const columns: Array<{ header: string; key: string; width: number }> = [];
      
      // Add Aadhaar Number as first column (not in questions but required)
      columns.push({
        header: 'Aadhaar Number (आधार कार्ड नंबर)',
        key: 'aadhar_no',
        width: 20,
      });

      // Add Name as second column (usually first question in personal info)
      columns.push({
        header: 'Name (नाव)',
        key: 'name',
        width: 30,
      });

      // Add all other questions as columns
      if (Array.isArray(questions) && questions.length > 0) {
        const seenQuestions = new Set<string>();
        
        for (const q of questions) {
          const questionText = (q.question || '').trim();
          if (!questionText || seenQuestions.has(questionText)) continue;
          
          seenQuestions.add(questionText);
          
          // Skip name question if already added
          if (questionText.includes('नाव') && questionText.includes('दिव्यांग')) {
            continue; // Already added as 'name'
          }

          // Create a safe key from question text
          const key = `q_${q.id}`;
          
          columns.push({
            header: `${questionText} (Q${q.id})`,
            key: key,
            width: Math.max(25, Math.min(50, questionText.length * 1.5)),
          });
        }
      }

      worksheet.columns = columns;

      // Style header row
      worksheet.getRow(1).font = { bold: true, size: 11 };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      worksheet.getRow(1).height = 30;

      // Freeze header row
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      // No sample data - empty template only

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="divyang_data_template.xlsx"',
        },
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('Error generating Excel template:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to generate template' },
      { status: 500 }
    );
  }
});








