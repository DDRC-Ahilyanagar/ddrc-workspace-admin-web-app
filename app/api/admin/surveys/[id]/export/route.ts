import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export const dynamic = 'force-dynamic';

interface ExportAnswer {
  questionId: number;
  sectionId: number | null;
  questionText: string;
  sectionName: string;
  answer: string;
}

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
    { header: 'Section', key: 'section', width: 25 },
    { header: 'Question', key: 'question', width: 70 },
    { header: 'Answer', key: 'answer', width: 70 },
  ];

  sheet.addRow(['', `Survey ID: ${survey.id}`, '', '']);
  sheet.addRow(['', `Aadhaar: ${survey.aadhar_no || '-'}`, '', '']);
  sheet.addRow(['', `Holder Name: ${survey.holder_name || '-'}`, '', '']);
  sheet.addRow([]);
  sheet.addRow(['S.No', 'Section', 'Question', 'Answer']);

  answers.forEach((ans, idx) => {
    sheet.addRow([idx + 1, ans.sectionName, ans.questionText, ans.answer]);
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

const exportPdf = async (surveyId: number, survey: any, answers: ExportAnswer[]) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const chunks: Buffer[] = [];

  return await new Promise<NextResponse>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(
        new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="survey_${surveyId}.pdf"`,
          },
        })
      );
    });
    doc.on('error', (err) => reject(err));

    doc.fontSize(16).text(`Survey ID: ${survey.id}`, { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Aadhaar: ${survey.aadhar_no || '-'}`);
    doc.text(`Holder Name: ${survey.holder_name || '-'}`);
    doc.text(`User: ${survey.user_name || `ID ${survey.user_id}`}`);
    doc.text(`Taluka / District: ${survey.taluka || '-'} / ${survey.district || '-'}`);
    doc.text(`Created At: ${new Date(survey.created_at).toLocaleString('en-IN')}`);
    doc.moveDown();

    doc.fontSize(14).text('Answers', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);

    answers.forEach((ans, idx) => {
      doc.font('Helvetica-Bold').text(`${idx + 1}. [${ans.sectionName}]`);
      doc.font('Helvetica').text(ans.questionText);
      doc.moveDown(0.2);
      doc.font('Helvetica-Oblique').text(`Answer: ${ans.answer}`);
      doc.moveDown(0.5);
    });

    doc.end();
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


