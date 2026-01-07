import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

interface Question {
  question_id: number;
  section_id: number;
  section_title_marathi: string;
  section_title_english: string | null;
  section_sort_order: number;
  question_marathi: string;
  question_english: string | null;
  question_type: string;
  options: string | null;
  regex: string | null;
  valid_input: string | null;
  max_length: number | null;
  is_required: number;
  question_is_active: number;
  question_sort_order: number;
  rendering_condition: string | null;
}

interface SectionGroup {
  section_title_marathi: string;
  section_title_english: string | null;
  section_sort_order: number;
  questions: Question[];
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatOptions(optionsStr: string | null): string {
  if (!optionsStr || optionsStr === 'NULL' || optionsStr === '') {
    return 'N/A';
  }
  return String(optionsStr)
    .split(',')
    .map(opt => opt.trim())
    .filter(opt => opt.length > 0)
    .join(', ');
}

function formatConditional(q: Question): string {
  const condition = q.rendering_condition || '';
  if (condition && condition.toLowerCase() === 'yes') {
    return 'Conditional (shown based on other answers)';
  }
  return 'Always shown';
}

async function fetchQuestionsBySection(): Promise<SectionGroup[]> {
  const pool = getDbPool();
  const conn = await pool.getConnection();
  
  try {
    const [rows]: any = await conn.query(`
      SELECT 
        question_id,
        section_id,
        section_title_marathi,
        section_title_english,
        section_sort_order,
        question_marathi,
        question_english,
        question_type,
        options,
        regex,
        valid_input,
        max_length,
        is_required,
        question_is_active,
        question_sort_order,
        rendering_condition
      FROM view_sections_with_questions
      WHERE question_id IS NOT NULL 
        AND question_is_active = 1
      ORDER BY section_sort_order ASC, question_sort_order ASC, question_id ASC
    `);

    const sectionsMap = new Map<string, SectionGroup>();

    for (const row of rows) {
      const sectionTitle = row.section_title_marathi || row.section_title_english || 'Unknown Section';
      
      if (!sectionsMap.has(sectionTitle)) {
        sectionsMap.set(sectionTitle, {
          section_title_marathi: row.section_title_marathi || '',
          section_title_english: row.section_title_english || null,
          section_sort_order: row.section_sort_order || 999,
          questions: [],
        });
      }

      sectionsMap.get(sectionTitle)!.questions.push({
        question_id: row.question_id,
        section_id: row.section_id,
        section_title_marathi: row.section_title_marathi || '',
        section_title_english: row.section_title_english || null,
        section_sort_order: row.section_sort_order || 999,
        question_marathi: row.question_marathi || '',
        question_english: row.question_english || null,
        question_type: row.question_type || '',
        options: row.options || null,
        regex: row.regex || null,
        valid_input: row.valid_input || null,
        max_length: row.max_length || null,
        is_required: row.is_required || 0,
        question_is_active: row.question_is_active || 0,
        question_sort_order: row.question_sort_order || 0,
        rendering_condition: row.rendering_condition || null,
      });
    }

    const sections = Array.from(sectionsMap.values());
    sections.sort((a, b) => a.section_sort_order - b.section_sort_order);

    return sections;
  } finally {
    conn.release();
  }
}

function buildHTML(sections: SectionGroup[]): string {
  const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);
  const totalSections = sections.length;
  const generatedDate = new Date().toLocaleString('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  let html = `<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DDRC Survey Questions Report</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 2cm 1.5cm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Noto Sans', Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
    }
    
    .marathi {
      font-family: 'Noto Sans Devanagari', sans-serif;
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #1e3a8a;
    }
    
    .header h1 {
      font-size: 24pt;
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 10px;
    }
    
    .header .meta {
      font-size: 9pt;
      color: #666;
      margin-top: 10px;
    }
    
    .section {
      margin-bottom: 35px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 16pt;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 15px;
      padding: 12px 15px;
      background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
      border-left: 5px solid #1e40af;
      border-radius: 4px;
    }
    
    .section-title .marathi {
      display: block;
      margin-bottom: 5px;
    }
    
    .section-title .english {
      font-size: 11pt;
      color: #4b5563;
      font-weight: 500;
    }
    
    .section-title .count {
      float: right;
      font-size: 12pt;
      color: #1e40af;
      background: #ffffff;
      padding: 4px 12px;
      border-radius: 12px;
      font-weight: 600;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
      font-size: 9pt;
      page-break-inside: auto;
    }
    
    thead {
      display: table-header-group;
    }
    
    tbody {
      display: table-row-group;
    }
    
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    
    th {
      background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
      color: #ffffff;
      padding: 12px 10px;
      text-align: left;
      border: 1px solid #1e3a8a;
      font-size: 9pt;
      font-weight: 600;
      vertical-align: middle;
    }
    
    th.marathi-col {
      font-family: 'Noto Sans Devanagari', sans-serif;
    }
    
    td {
      border: 1px solid #d1d5db;
      padding: 10px;
      vertical-align: top;
      background-color: #ffffff;
    }
    
    td.marathi-text {
      font-family: 'Noto Sans Devanagari', sans-serif;
      font-size: 10pt;
      line-height: 1.6;
      font-weight: 500;
    }
    
    td.english-text {
      font-size: 9pt;
      color: #4b5563;
      line-height: 1.5;
    }
    
    td.number {
      text-align: center;
      width: 4%;
      font-weight: 600;
      color: #1e40af;
      background-color: #f3f4f6;
    }
    
    td.type {
      width: 10%;
      font-size: 8pt;
      text-align: center;
    }
    
    td.type .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    td.type .badge.mcq {
      background: #dbeafe;
      color: #1e40af;
    }
    
    td.type .badge.short_answer {
      background: #dcfce7;
      color: #166534;
    }
    
    td.type .badge.date {
      background: #fef3c7;
      color: #92400e;
    }
    
    td.type .badge.upload {
      background: #fce7f3;
      color: #9f1239;
    }
    
    td.options {
      width: 18%;
      font-size: 8pt;
      color: #4b5563;
    }
    
    td.conditional {
      width: 15%;
      font-size: 8pt;
      color: #059669;
    }
    
    td.required {
      width: 8%;
      text-align: center;
    }
    
    td.required .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 600;
    }
    
    td.required .badge.yes {
      background: #fee2e2;
      color: #991b1b;
    }
    
    td.required .badge.no {
      background: #e5e7eb;
      color: #4b5563;
    }
    
    tbody tr:nth-child(even) td {
      background-color: #f9fafb;
    }
    
    tbody tr:hover td {
      background-color: #f3f4f6;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 8pt;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="marathi">DDRC सर्वेक्षण प्रश्नावली</h1>
    <h2 style="font-size: 18pt; color: #4b5563; font-weight: 500; margin-top: 5px;">Survey Questions Report</h2>
    <div class="meta">
      Generated on: ${generatedDate}<br>
      Total Sections: ${totalSections} | Total Questions: ${totalQuestions}
    </div>
  </div>
`;

  let sectionNumber = 1;
  for (const section of sections) {
    const sectionTitleMarathi = escapeHtml(section.section_title_marathi);
    const sectionTitleEnglish = section.section_title_english 
      ? escapeHtml(section.section_title_english) 
      : '';
    const questionCount = section.questions.length;

    html += `
  <div class="section">
    <div class="section-title">
      <span class="marathi">${sectionNumber}. ${sectionTitleMarathi}</span>
      ${sectionTitleEnglish ? `<span class="english">${sectionTitleEnglish}</span>` : ''}
      <span class="count">${questionCount} ${questionCount === 1 ? 'Question' : 'Questions'}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 4%;">#</th>
          <th class="marathi-col" style="width: 28%;">Question (Marathi)</th>
          <th style="width: 22%;">Question (English)</th>
          <th style="width: 10%;">Type</th>
          <th style="width: 8%;">Required</th>
          <th style="width: 18%;">Options</th>
          <th style="width: 10%;">Conditional</th>
        </tr>
      </thead>
      <tbody>
`;

    let questionNumber = 1;
    for (const q of section.questions) {
      const questionMarathi = escapeHtml(q.question_marathi);
      const questionEnglish = escapeHtml(q.question_english || '');
      const questionType = q.question_type.toLowerCase();
      const options = formatOptions(q.options);
      const conditional = formatConditional(q);
      const isRequired = q.is_required === 1;

      html += `
        <tr>
          <td class="number">${questionNumber++}</td>
          <td class="marathi-text">${questionMarathi}</td>
          <td class="english-text">${questionEnglish || '-'}</td>
          <td class="type">
            <span class="badge ${questionType}">${escapeHtml(q.question_type)}</span>
          </td>
          <td class="required">
            <span class="badge ${isRequired ? 'yes' : 'no'}">${isRequired ? 'Yes' : 'No'}</span>
          </td>
          <td class="options">${escapeHtml(options)}</td>
          <td class="conditional">${escapeHtml(conditional)}</td>
        </tr>
`;
    }

    html += `
      </tbody>
    </table>
  </div>
`;
    sectionNumber++;
  }

  html += `
  <div class="footer">
    <p>DDRC Survey Questions Report - Generated from Database</p>
    <p style="margin-top: 5px;">This document contains all active questions organized by sections.</p>
  </div>
</body>
</html>`;

  return html;
}

export async function GET(req: NextRequest) {
  try {
    const OUTPUT_DIR = path.join(process.cwd(), 'public', 'pdfs');
    const timestamp = new Date().toISOString().split('T')[0];
    const OUTPUT_PDF = path.join(OUTPUT_DIR, `questions-report-${timestamp}.pdf`);

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Fetch questions
    const sections = await fetchQuestionsBySection();
    
    // Generate HTML
    const html = buildHTML(sections);
    
    // Generate PDF
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '2cm',
        right: '1.5cm',
        bottom: '2cm',
        left: '1.5cm',
      },
    });
    
    await browser.close();
    
    // Save to file
    fs.writeFileSync(OUTPUT_PDF, pdfBuffer);
    
    // Return PDF as response
    const filename = `questions-report-${timestamp}.pdf`;
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
    
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

