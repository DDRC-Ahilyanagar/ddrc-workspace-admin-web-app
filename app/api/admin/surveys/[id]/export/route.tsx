import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import ExcelJS from 'exceljs';
import { Document, Font, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface ExportAnswer {
  questionId: number;
  sectionId: number | null;
  questionText: string;
  sectionName: string;
  answer: string;
}

const REGULAR_FONT_KEY = 'NotoSansDevanagari';
const BOLD_FONT_KEY = 'NotoSansDevanagari';
const REGULAR_FONT_PATH = path.join(process.cwd(), 'public', 'fonts', 'NotoSansDevanagari-Regular.ttf');
const BOLD_FONT_PATH = path.join(process.cwd(), 'public', 'fonts', 'NotoSansDevanagari-Bold.ttf');

let fontsRegistered = false;

const ensurePdfFonts = () => {
  if (fontsRegistered) return;
  try {
    if (fs.existsSync(REGULAR_FONT_PATH)) {
      const fonts: { src: string; fontWeight: 'normal' | 'bold' }[] = [
        { src: REGULAR_FONT_PATH, fontWeight: 'normal' },
      ];
      if (fs.existsSync(BOLD_FONT_PATH)) {
        fonts.push({ src: BOLD_FONT_PATH, fontWeight: 'bold' });
      }
      Font.register({ family: REGULAR_FONT_KEY, fonts });
      fontsRegistered = true;
    } else {
      console.warn(`[pdf-export] Font file not found at ${REGULAR_FONT_PATH}`);
    }
  } catch (error) {
    console.warn('[pdf-export] Failed to register fonts', error);
  }
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
        sa.user_id,
        sa.holder_name,
        sa.gender,
        sa.dob,
        sa.taluka,
        sa.district,
        sa.address_text,
        sa.pincode,
        sa.created_at,
        sa.updated_at,
        u.name AS user_name,
        u.contact_number AS user_phone
      FROM survey_aadhar sa
      LEFT JOIN users u ON u.id = sa.user_id
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

const pdfStyles = StyleSheet.create({
  page: { padding: 32, fontFamily: REGULAR_FONT_KEY, fontSize: 12, lineHeight: 1.4 },
  heading: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  infoRow: { marginBottom: 2 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginTop: 12, marginBottom: 6 },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', marginTop: 12, marginBottom: 8, backgroundColor: '#E0E0E0', padding: 6 },
  answerBlock: { marginBottom: 8 },
  answerQuestion: { fontSize: 12, fontWeight: 'bold' },
  answerText: { marginTop: 2, fontSize: 11 },
});

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('mr-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const exportPdf = async (surveyId: number, survey: any, answers: ExportAnswer[]) => {
  ensurePdfFonts();

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

  let questionNumber = 1;

  const doc = (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.heading}>सर्वेक्षण क्रमांक: {survey.id}</Text>
        <Text style={pdfStyles.infoRow}>आधार क्रमांक: {survey.aadhar_no || '-'}</Text>
        <Text style={pdfStyles.infoRow}>दिव्यांगाचे नाव: {survey.holder_name || '-'}</Text>
        <Text style={pdfStyles.infoRow}>वापरकर्ता: {survey.user_name || `ID ${survey.user_id}`}</Text>
        <Text style={pdfStyles.infoRow}>
          तालुका / जिल्हा: {survey.taluka || '-'} / {survey.district || '-'}
        </Text>
        <Text style={pdfStyles.infoRow}>निर्मिती तारीख व वेळ: {formatDateTime(survey.created_at)}</Text>

        <Text style={pdfStyles.sectionTitle}>उत्तर</Text>
        {sortedSections.map(([sectionName, sectionAnswers], sectionIdx) => (
          <View key={`section-${sectionIdx}`}>
            <Text style={pdfStyles.sectionHeader}>{sectionName || 'Other'}</Text>
            {sectionAnswers.map((ans, ansIdx) => (
              <View key={`${ans.sectionName}-${ans.questionId}-${ansIdx}`} style={pdfStyles.answerBlock}>
                <Text style={pdfStyles.answerQuestion}>
                  {questionNumber++}. {ans.questionText}
                </Text>
                <Text style={pdfStyles.answerText}>उत्तर: {ans.answer || '-'}</Text>
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );

  const pdfInstance = pdf(doc);
  const pdfBuffer = (await pdfInstance.toBuffer()) as unknown as Buffer;

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="survey_${surveyId}.pdf"`,
    },
  });
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


