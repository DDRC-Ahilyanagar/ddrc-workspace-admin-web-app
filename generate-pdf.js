const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const puppeteer = require('puppeteer');

const OUTPUT_PDF = path.join(__dirname, 'questions_report_from_db.pdf');

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'ddrc_surveys',
  charset: 'utf8mb4'
};

async function fetchQuestions() {
  console.log(`[INFO] Connecting to database: ${DB_CONFIG.database}@${DB_CONFIG.host}`);
  const conn = await mysql.createConnection(DB_CONFIG);
  
  const [viewCheck] = await conn.execute(`
    SELECT COUNT(*) as count 
    FROM information_schema.views 
    WHERE table_schema = ? AND table_name = 'view_sections_with_questions'
  `, [DB_CONFIG.database]);
  
  if (viewCheck[0].count === 0) {
    throw new Error(`View 'view_sections_with_questions' does not exist in database '${DB_CONFIG.database}'`);
  }
  
  console.log('[OK] Database view found');
  
  const [rows] = await conn.execute(`
    SELECT
      section_title_marathi,
      section_title_english,
      section_sort_order,
      question_marathi,
      question_english,
      question_type,
      options,
      rendering_condition,
      rendering_question,
      rendering_value,
      question_sort_order
    FROM view_sections_with_questions
    WHERE question_is_active = 1
    ORDER BY section_sort_order ASC, question_sort_order ASC, question_id ASC
  `);
  
  await conn.end();
  console.log(`[OK] Fetched ${rows.length} questions from database`);

  const sections = {};
  for (const r of rows) {
    const section =
      r.section_title_marathi ||
      r.section_title_english ||
      'Unknown Section';
    if (!sections[section]) {
      sections[section] = { sortOrder: r.section_sort_order || 999, questions: [] };
    }
    sections[section].questions.push(r);
  }
  
  const sortedSections = {};
  const sectionNames = Object.keys(sections).sort((a, b) => {
    return sections[a].sortOrder - sections[b].sortOrder;
  });
  
  for (const sectionName of sectionNames) {
    sortedSections[sectionName] = sections[sectionName].questions;
  }
  
  return sortedSections;
}

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatOptions(optionsStr) {
  if (!optionsStr || optionsStr === 'NULL' || optionsStr === '') {
    return 'N/A';
  }
  return String(optionsStr).split(',').map(opt => opt.trim()).join(', ');
}

function formatConditional(q) {
  const condition = q.rendering_condition || '';
  if (condition && condition.toLowerCase() === 'yes') {
    const renderingQ = q.rendering_question || '';
    const renderingV = q.rendering_value || '';
    if (renderingQ && renderingV) {
      return `Shows when: '${renderingQ}' = '${renderingV}'`;
    }
    return 'Conditional (details missing)';
  }
  return 'Always shown';
}

function buildHTML(sections) {
  const totalQuestions = Object.values(sections).reduce((a, b) => a + b.length, 0);

  let html = `<!doctype html>
<html lang="mr">
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans:wght@400;700&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 1.5cm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Noto Sans', Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #000; background: #fff; }
.marathi { font-family: 'Noto Sans Devanagari', sans-serif; }
h1 { text-align: center; color: #1e3a8a; font-size: 20pt; margin-bottom: 10px; font-weight: 700; }
.header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #1e3a8a; }
.header .meta { font-size: 9pt; color: #666; }
.section { margin-bottom: 30px; page-break-inside: avoid; }
.section-title { font-size: 16pt; font-weight: 700; color: #1e40af; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 1px solid #cbd5e1; }
table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9pt; page-break-inside: auto; }
thead { display: table-header-group; }
tbody { display: table-row-group; }
tr { page-break-inside: avoid; page-break-after: auto; }
th { background: #1e3a8a; color: #fff; padding: 10px 8px; text-align: left; border: 1px solid #1e3a8a; font-size: 9pt; font-weight: 700; }
th.marathi-col { font-family: 'Noto Sans Devanagari', sans-serif; }
td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; background-color: #fff; }
td.marathi-text { font-family: 'Noto Sans Devanagari', sans-serif; font-size: 10pt; line-height: 1.5; }
td.english-text { font-size: 9pt; }
td.number { text-align: center; width: 3%; font-weight: 600; }
td.type { width: 8%; font-size: 8pt; }
td.options { width: 20%; font-size: 8pt; }
td.conditional { width: 18%; font-size: 8pt; color: #186a3b; }
tbody tr:nth-child(even) td { background-color: #f8f9fa; }
.footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 8pt; color: #666; }
</style>
</head>
<body>

<div class="header">
<h1 class="marathi">DDRC Survey Questions Report</h1>
<div class="meta">Generated on: ${new Date().toLocaleString()} | Total Sections: ${Object.keys(sections).length} | Total Questions: ${totalQuestions}</div>
</div>
`;

  let sectionIdx = 1;
  for (const [section, qs] of Object.entries(sections)) {
    html += `<div class="section">`;
    html += `<div class="section-title marathi">${sectionIdx++}. ${esc(section)} (${qs.length} questions)</div>`;
    html += `
<table>
<thead>
<tr>
<th style="width: 3%;">#</th>
<th class="marathi-col" style="width: 25%;">Question (Marathi)</th>
<th style="width: 25%;">Question (English)</th>
<th style="width: 8%;">Type</th>
<th style="width: 20%;">Options</th>
<th style="width: 19%;">Conditional</th>
</tr>
</thead>
<tbody>
`;

    let qno = 1;
    for (const q of qs) {
      const options = formatOptions(q.options);
      const optionsDisplay = q.question_type === 'MCQ' && options !== 'N/A' 
        ? `Options: ${options}` 
        : options;
      const conditional = formatConditional(q);
      
      html += `
<tr>
<td class="number">${qno++}</td>
<td class="marathi-text">${esc(q.question_marathi || '')}</td>
<td class="english-text">${esc(q.question_english || '')}</td>
<td class="type">${esc(q.question_type || '')}</td>
<td class="options">${esc(optionsDisplay)}</td>
<td class="conditional">${esc(conditional)}</td>
</tr>
`;
    }
    html += '</tbody></table></div>';
  }

  html += `<div class="footer">DDRC Survey Questions Report - Generated from Database</div>`;
  html += '</body></html>';
  return html;
}

(async () => {
  try {
    console.log('='.repeat(60));
    console.log('DDRC Questions PDF Generator (Node.js + Puppeteer)');
    console.log('='.repeat(60));
    console.log();
    
    console.log('[INFO] Fetching questions from database...');
    const sections = await fetchQuestions();
    console.log(`[OK] Loaded ${Object.keys(sections).length} sections`);
    console.log();
    
    console.log('[INFO] Generating HTML...');
    const html = buildHTML(sections);
    
    console.log('[INFO] Launching browser...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    console.log('[INFO] Rendering HTML with Chromium...');
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    console.log('[INFO] Generating PDF...');
    await page.pdf({ 
      path: OUTPUT_PDF, 
      format: 'A4', 
      printBackground: true,
      margin: {
        top: '1.5cm',
        right: '1.5cm',
        bottom: '1.5cm',
        left: '1.5cm'
      }
    });
    
    await browser.close();
    
    console.log();
    console.log(`[SUCCESS] PDF saved as: ${path.resolve(OUTPUT_PDF)}`);
    console.log();
    console.log('Note: Questions are listed without IDs, grouped by sections.');
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();











