import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { getAbsoluteImageUrl } from '@/lib/config';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';

export const dynamic = 'force-dynamic';

interface ExportAnswer {
  questionId: number;
  sectionId: number | null;
  questionText: string;
  sectionName: string;
  answer: string;
}

// Helper to escape HTML
const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return '';
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
};

// Helper to check if answer is an image URL
const isImageAnswer = (answer: string): boolean => {
  if (!answer) return false;
  const answerStr = answer.trim();
  return (
    answerStr.includes('uploads') ||
    answerStr.startsWith('/uploads') ||
    answerStr.startsWith('uploads/') ||
    answerStr.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i) !== null ||
    (answerStr.match(/^[a-f0-9-]{36}$/i) !== null) ||
    ((answerStr.startsWith('http://') || answerStr.startsWith('https://')) && 
      (answerStr.includes('.jpg') || answerStr.includes('.jpeg') || 
       answerStr.includes('.png') || answerStr.includes('.gif') || 
       answerStr.includes('.webp') || answerStr.includes('.pdf') ||
       answerStr.includes('uploads')))
  );
};

const normalizeAnswer = (value: any): string => {
  if (value === null || value === undefined) return '-';

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  const str = String(value).trim();

  if (!str || str === '--') return '-';

  // Handle JSON array stored as string
  if ((str.startsWith('[') && str.endsWith(']')) || (str.startsWith('{') && str.endsWith('}'))) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.join(', ');
      if (typeof parsed === 'object') return JSON.stringify(parsed);
    } catch {
      /* ignore */
    }
  }

  // If it's an image URL (contains localhost or uploads), normalize it to production URL
  if (str.includes('localhost') || str.includes('127.0.0.1') || 
      str.includes('uploads') || str.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i)) {
    return getAbsoluteImageUrl(str);
  }

  return str;
};

const fetchSurveyData = async (surveyId: number) => {
  const pool = getDbPool();
  const conn = await pool.getConnection();

  try {
    const [surveyRows]: any = await conn.query(
      `SELECT 
        sa.id,
        sa.aadhar_no,
        COALESCE(s.user_id, sa.user_id) AS user_id,
        sa.holder_name,
        sa.gender,
        sa.dob,
        COALESCE(sa.taluka, s.taluka) AS taluka,
        COALESCE(sa.district, s.district) AS district,
        sa.address_text,
        sa.pincode,
        sa.created_at,
        sa.updated_at,
        u.name AS user_name,
        u.contact_number AS user_phone
      FROM survey_aadhar sa
      LEFT JOIN surveys s ON s.aadhaar_id = sa.id
      LEFT JOIN users u ON u.id = COALESCE(s.user_id, sa.user_id)
      WHERE sa.id = ?
      LIMIT 1`,
      [surveyId]
    );

    if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
      throw new Error('Survey not found');
    }

    const survey = surveyRows[0];

    const [surveyJsonRows]: any = await conn.query(
      'SELECT survey_json FROM surveys WHERE aadhaar_id = ? LIMIT 1',
      [surveyId]
    );

    if (!Array.isArray(surveyJsonRows) || surveyJsonRows.length === 0) {
      throw new Error('Survey data not available for export');
    }

    const surveyJsonRaw = surveyJsonRows[0].survey_json;
    if (!surveyJsonRaw) {
      throw new Error('Survey data not available for export');
    }

    const surveyJson = typeof surveyJsonRaw === 'string' ? JSON.parse(surveyJsonRaw) : surveyJsonRaw;
    const answersRaw = Array.isArray(surveyJson?.answers) ? surveyJson.answers : [];

    // Extract taluka and district from survey_json if not in survey_aadhar
    // Question 47 = सध्याचा ता. (Current Taluka)
    // Question 48 = सध्याचा जि. (Current District)
    if (!survey.taluka || !survey.district) {
      const getAnswerFromJson = (questionId: number): string | null => {
        const answer = answersRaw.find((ans: any) => {
          const qid = parseInt(ans?.question_id ?? ans?.questionId ?? '0', 10);
          return qid === questionId;
        });
        return answer ? String(answer.answer || answer.value || '').trim() : null;
      };

      if (!survey.taluka) {
        const talukaFromJson = getAnswerFromJson(47);
        if (talukaFromJson) survey.taluka = talukaFromJson;
      }
      if (!survey.district) {
        const districtFromJson = getAnswerFromJson(48);
        if (districtFromJson) survey.district = districtFromJson;
      }
    }

    const questionIds = Array.from(
      new Set(
        answersRaw
          .map((ans: any) => parseInt(ans?.question_id ?? ans?.questionId ?? '0', 10))
          .filter((id: number) => Number.isFinite(id) && id > 0)
      )
    );

    const questionMap = new Map<number, { question: string; section_id: number | null; section_name: string | null }>();

    if (questionIds.length > 0) {
      const [questionRows]: any = await conn.query(
        `SELECT q.id, q.question, q.section_id, s.name AS section_name
         FROM questions q
         LEFT JOIN sections s ON s.id = q.section_id
         WHERE q.id IN (?)
        `,
        [questionIds]
      );

      if (Array.isArray(questionRows)) {
        questionRows.forEach((row: any) => {
          questionMap.set(row.id, {
            question: row.question,
            section_id: row.section_id ?? null,
            section_name: row.section_name ?? null,
          });
        });
      }
    }

    const answers: ExportAnswer[] = answersRaw.map((ans: any) => {
      const questionId = parseInt(ans?.question_id ?? ans?.questionId ?? '0', 10) || 0;
      const sectionId = ans?.section_id ?? ans?.sectionId ?? questionMap.get(questionId)?.section_id ?? null;
      const questionMeta = questionMap.get(questionId);
      const questionText = questionMeta?.question || ans?.question_text || `Question ${questionId || ''}`.trim();
      const sectionName =
        ans?.section_name ||
        questionMeta?.section_name ||
        (sectionId ? `Section ${sectionId}` : 'Section');
      const normalizedAnswer = normalizeAnswer(ans?.answer);

      return {
        questionId,
        sectionId: sectionId ? Number(sectionId) : null,
        questionText,
        sectionName,
        answer: normalizedAnswer,
      };
    });

    return { survey, answers };
  } finally {
    conn.release();
  }
};

const exportExcel = async (surveyId: number, survey: any, answers: ExportAnswer[]) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Survey');

  sheet.columns = [
    { header: 'S.No', key: 'idx', width: 6 },
    { header: 'Question', key: 'question', width: 70 },
    { header: 'Answer', key: 'answer', width: 70 },
  ];

  sheet.addRow(['', `Survey ID: ${survey.id}`, '']);
  sheet.addRow(['', `Aadhaar: ${survey.aadhar_no || '-'}`, '']);
  sheet.addRow(['', `Holder Name: ${survey.holder_name || '-'}`, '']);
  sheet.addRow([]);
  sheet.addRow(['S.No', 'Question', 'Answer']);

  // Group answers by section
  const answersBySection = new Map<string | null, ExportAnswer[]>();
  answers.forEach((ans) => {
    const sectionKey = ans.sectionName || 'Other';
    if (!answersBySection.has(sectionKey)) {
      answersBySection.set(sectionKey, []);
    }
    answersBySection.get(sectionKey)!.push(ans);
  });

  let serialNumber = 1;
  // Sort sections by sectionId if available, otherwise by name
  const sortedSections = Array.from(answersBySection.entries()).sort((a, b) => {
    const aId = a[1][0]?.sectionId || 0;
    const bId = b[1][0]?.sectionId || 0;
    if (aId !== bId) return aId - bId;
    return (a[0] || '').localeCompare(b[0] || '');
  });

  sortedSections.forEach(([sectionName, sectionAnswers]) => {
    // Add section header row
    const sectionHeaderRow = sheet.addRow([sectionName, '', '']);
    sectionHeaderRow.font = { bold: true };
    sectionHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add questions in this section
    sectionAnswers.forEach((ans) => {
      sheet.addRow([serialNumber++, ans.questionText, ans.answer]);
    });

    // Add empty row after section
    sheet.addRow([]);
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="survey_${surveyId}.xlsx"`,
    },
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('mr-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const buildSurveyPdfHTML = (survey: any, answers: ExportAnswer[]): string => {
  // Group answers by section
  const answersBySection = new Map<string | null, ExportAnswer[]>();
  answers.forEach((ans) => {
    const sectionKey = ans.sectionName || 'Other';
    if (!answersBySection.has(sectionKey)) {
      answersBySection.set(sectionKey, []);
    }
    answersBySection.get(sectionKey)!.push(ans);
  });

  // Sort sections by sectionId if available, otherwise by name
  const sortedSections = Array.from(answersBySection.entries()).sort((a, b) => {
    const aId = a[1][0]?.sectionId || 0;
    const bId = b[1][0]?.sectionId || 0;
    if (aId !== bId) return aId - bId;
    return (a[0] || '').localeCompare(b[0] || '');
  });

  const generatedDate = new Date().toLocaleString('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  let questionNumber = 1;

  let html = `<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DDRC Survey Report - ${survey.id}</title>
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
    
    .info-section {
      background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
      padding: 20px;
      border-left: 5px solid #1e40af;
      border-radius: 4px;
      margin-bottom: 25px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      font-size: 10pt;
    }
    
    .info-item {
      display: flex;
      flex-direction: column;
    }
    
    .info-label {
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 4px;
      font-size: 9pt;
    }
    
    .info-value {
      color: #1a1a1a;
      font-size: 10pt;
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
    
    .answer-block {
      margin-bottom: 20px;
      padding: 15px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      page-break-inside: avoid;
    }
    
    .answer-question {
      font-size: 11pt;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 8px;
      font-family: 'Noto Sans Devanagari', sans-serif;
    }
    
    .answer-text {
      font-size: 10pt;
      color: #1a1a1a;
      margin-top: 8px;
      line-height: 1.6;
    }
    
    .answer-image {
      margin-top: 10px;
      max-width: 100%;
      max-height: 300px;
      border: 2px solid #d1d5db;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .answer-label {
      font-weight: 600;
      color: #4b5563;
      margin-right: 8px;
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
    <h1 class="marathi">DDRC सर्वेक्षण अहवाल</h1>
    <h2 style="font-size: 18pt; color: #4b5563; font-weight: 500; margin-top: 5px;">Survey Report</h2>
    <div class="meta">
      Generated on: ${generatedDate}
    </div>
  </div>

  <div class="info-section">
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">सर्वेक्षण क्रमांक:</span>
        <span class="info-value">${escapeHtml(String(survey.id))}</span>
      </div>
      <div class="info-item">
        <span class="info-label">आधार क्रमांक:</span>
        <span class="info-value">${escapeHtml(survey.aadhar_no || '-')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">दिव्यांगाचे नाव:</span>
        <span class="info-value marathi">${escapeHtml(survey.holder_name || '-')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">वापरकर्ता:</span>
        <span class="info-value">${escapeHtml(survey.user_name || `ID ${survey.user_id}`)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">तालुका:</span>
        <span class="info-value marathi">${escapeHtml(survey.taluka || '-')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">जिल्हा:</span>
        <span class="info-value marathi">${escapeHtml(survey.district || '-')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">निर्मिती तारीख व वेळ:</span>
        <span class="info-value">${escapeHtml(formatDateTime(survey.created_at))}</span>
      </div>
      <div class="info-item">
        <span class="info-label">उत्तरांची संख्या:</span>
        <span class="info-value">${answers.length}</span>
      </div>
    </div>
  </div>
`;

  // Add sections with answers
  sortedSections.forEach(([sectionName, sectionAnswers]) => {
    const sectionNameEscaped = escapeHtml(sectionName || 'Other');
    html += `
  <div class="section">
    <div class="section-title">
      <span class="marathi">${sectionNameEscaped}</span>
    </div>
`;

    sectionAnswers.forEach((ans) => {
      const questionText = escapeHtml(ans.questionText);
      const answerValue = ans.answer || '-';
      // Check if answer is an image (answerValue is already normalized by normalizeAnswer)
      const isImage = isImageAnswer(answerValue);
      // If it's already normalized, use it directly; otherwise normalize it
      const imageUrl = isImage ? (answerValue.startsWith('http') ? answerValue : getAbsoluteImageUrl(answerValue)) : null;

      html += `
    <div class="answer-block">
      <div class="answer-question">
        ${questionNumber++}. ${questionText}
      </div>
      <div class="answer-text">
        <span class="answer-label">उत्तर:</span>`;

      if (isImage && imageUrl) {
        html += `
        <br>
        <img src="${escapeHtml(imageUrl)}" alt="Answer Image" class="answer-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <span style="display:none; color: #dc2626; font-size: 9pt;">Image not found: ${escapeHtml(answerValue)}</span>`;
      } else {
        html += ` ${escapeHtml(answerValue)}`;
      }

      html += `
      </div>
    </div>`;
    });

    html += `
  </div>`;
  });

  html += `
  <div class="footer">
    <p>DDRC Survey System - Automated Report Generation</p>
    <p style="margin-top: 5px;">This document contains complete survey details with all answers.</p>
  </div>
</body>
</html>`;

  return html;
};

const exportPdf = async (surveyId: number, survey: any, answers: ExportAnswer[]) => {
  const html = buildSurveyPdfHTML(survey, answers);

  // Generate PDF using puppeteer (same as questions PDF)
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport for better rendering
    await page.setViewport({ width: 1200, height: 1600 });
    
    // Set content and wait for images to load
    await page.setContent(html, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Wait a bit more for images to fully load
    await page.waitForTimeout(2000);

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

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="survey_${surveyId}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const surveyId = parseInt(resolvedParams.id || '0', 10);

    if (!surveyId || surveyId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid survey ID' },
        { status: 422 }
      );
    }

    const format = (request.nextUrl.searchParams.get('format') || 'xlsx').toLowerCase();

    const { survey, answers } = await fetchSurveyData(surveyId);

    if (!answers || answers.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No survey answers available to export' },
        { status: 404 }
      );
    }

    if (format === 'pdf') {
      return await exportPdf(surveyId, survey, answers);
    }

    return await exportExcel(surveyId, survey, answers);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to export survey' },
      { status: 500 }
    );
  }
}


