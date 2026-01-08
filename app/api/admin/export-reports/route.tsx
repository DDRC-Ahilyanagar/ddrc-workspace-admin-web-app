import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/auth';
import { extractFilterData, generateReportFileName, getAnswerFromJson } from '@/lib/survey-filters';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * Generate filtered reports (PDF and Excel) for all filter types
 * Called by daily email job or admin users
 */
export const POST = async (request: NextRequest) => {
  try {
    // Check for API token (for internal calls from scheduled jobs)
    const authHeader = request.headers.get('authorization');
    const apiToken = process.env.DAILY_STATS_API_TOKEN || process.env.AUTO_ASSIGN_API_TOKEN || '';
    const isInternalCall = apiToken && authHeader === `Bearer ${apiToken}`;
    
    // If not internal call, require authentication
    if (!isInternalCall) {
      const { user, error } = await verifyAuth(request);
      
      if (!user || error) {
        return NextResponse.json(
          { ok: false, error: error || 'Authentication required' },
          { status: 401 }
        );
      }
      
      // Only admin can generate reports
      const userType = (user?.user_type || '').toLowerCase().trim();
      if (userType !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Unauthorized: Only admins can generate reports' },
          { status: 403 }
        );
      }
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();
    const reportDate = new Date();

    try {
      // Get all surveys with their data
      const [allSurveys]: any = await conn.query(`
        SELECT 
          s.id,
          s.aadhaar_id,
          s.user_id,
          s.source,
          s.survey_json,
          s.created_at,
          sa.aadhar_no,
          sa.holder_name,
          sa.gender,
          sa.dob,
          sa.taluka,
          sa.district,
          sa.address_text,
          u.name AS user_name,
          u.contact_number AS user_phone
        FROM surveys s
        INNER JOIN survey_aadhar sa ON sa.id = s.aadhaar_id
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.survey_json IS NOT NULL
        AND s.survey_json != ''
        ORDER BY s.created_at DESC
      `);

      if (!Array.isArray(allSurveys) || allSurveys.length === 0) {
        return NextResponse.json({
          ok: true,
          message: 'No surveys found to generate reports',
          files: [],
        });
      }

      // Extract filter data for all surveys
      const surveysWithFilters = allSurveys.map((row: any) => ({
        ...row,
        filters: extractFilterData(row),
      }));

      // Generate reports for each filter type
      const generatedFiles: Array<{ type: string; value: string; pdfPath: string; excelPath: string }> = [];

      // 1. Source-wise reports
      const sourceGroups = new Map<string, any[]>();
      surveysWithFilters.forEach((survey: any) => {
        const source = survey.filters.source || 'Divyang Self';
        if (!sourceGroups.has(source)) {
          sourceGroups.set(source, []);
        }
        sourceGroups.get(source)!.push(survey);
      });

      for (const [source, surveys] of sourceGroups.entries()) {
        const fileName = generateReportFileName('Source', source, reportDate, 'pdf');
        const excelFileName = generateReportFileName('Source', source, reportDate, 'xlsx');
        const pdfPath = await generatePdfReport(surveys, `Source: ${source}`, fileName);
        const excelPath = await generateExcelReport(surveys, `Source: ${source}`, excelFileName);
        generatedFiles.push({ type: 'source', value: source, pdfPath, excelPath });
      }

      // 2. Taluka-wise reports
      const talukaGroups = new Map<string, any[]>();
      surveysWithFilters.forEach((survey: any) => {
        const taluka = survey.filters.taluka || 'इतर';
        if (!talukaGroups.has(taluka)) {
          talukaGroups.set(taluka, []);
        }
        talukaGroups.get(taluka)!.push(survey);
      });

      for (const [taluka, surveys] of talukaGroups.entries()) {
        const fileName = generateReportFileName('Taluka', taluka, reportDate, 'pdf');
        const excelFileName = generateReportFileName('Taluka', taluka, reportDate, 'xlsx');
        const pdfPath = await generatePdfReport(surveys, `Taluka: ${taluka}`, fileName);
        const excelPath = await generateExcelReport(surveys, `Taluka: ${taluka}`, excelFileName);
        generatedFiles.push({ type: 'taluka', value: taluka, pdfPath, excelPath });
      }

      // 3. Disability-wise reports
      const disabilityGroups = new Map<string, any[]>();
      surveysWithFilters.forEach((survey: any) => {
        const disability = survey.filters.disability || 'निर्दिष्ट नाही';
        if (!disabilityGroups.has(disability)) {
          disabilityGroups.set(disability, []);
        }
        disabilityGroups.get(disability)!.push(survey);
      });

      for (const [disability, surveys] of disabilityGroups.entries()) {
        const fileName = generateReportFileName('Disability', disability, reportDate, 'pdf');
        const excelFileName = generateReportFileName('Disability', disability, reportDate, 'xlsx');
        const pdfPath = await generatePdfReport(surveys, `Disability: ${disability}`, fileName);
        const excelPath = await generateExcelReport(surveys, `Disability: ${disability}`, excelFileName);
        generatedFiles.push({ type: 'disability', value: disability, pdfPath, excelPath });
      }

      // 4. District-wise reports
      const districtGroups = new Map<string, any[]>();
      surveysWithFilters.forEach((survey: any) => {
        const district = survey.filters.district || 'इतर';
        if (!districtGroups.has(district)) {
          districtGroups.set(district, []);
        }
        districtGroups.get(district)!.push(survey);
      });

      for (const [district, surveys] of districtGroups.entries()) {
        const fileName = generateReportFileName('District', district, reportDate, 'pdf');
        const excelFileName = generateReportFileName('District', district, reportDate, 'xlsx');
        const pdfPath = await generatePdfReport(surveys, `District: ${district}`, fileName);
        const excelPath = await generateExcelReport(surveys, `District: ${district}`, excelFileName);
        generatedFiles.push({ type: 'district', value: district, pdfPath, excelPath });
      }

      // 5. Gender-wise reports
      const genderGroups = new Map<string, any[]>();
      surveysWithFilters.forEach((survey: any) => {
        const gender = survey.filters.gender || 'निर्दिष्ट नाही';
        if (!genderGroups.has(gender)) {
          genderGroups.set(gender, []);
        }
        genderGroups.get(gender)!.push(survey);
      });

      for (const [gender, surveys] of genderGroups.entries()) {
        const fileName = generateReportFileName('Gender', gender, reportDate, 'pdf');
        const excelFileName = generateReportFileName('Gender', gender, reportDate, 'xlsx');
        const pdfPath = await generatePdfReport(surveys, `Gender: ${gender}`, fileName);
        const excelPath = await generateExcelReport(surveys, `Gender: ${gender}`, excelFileName);
        generatedFiles.push({ type: 'gender', value: gender, pdfPath, excelPath });
      }

      // 6. Field Officer-wise reports (only for surveys with field officers)
      const officerGroups = new Map<string, any[]>();
      surveysWithFilters.forEach((survey: any) => {
        if (survey.filters.fieldOfficerName) {
          const officerName = survey.filters.fieldOfficerName;
          if (!officerGroups.has(officerName)) {
            officerGroups.set(officerName, []);
          }
          officerGroups.get(officerName)!.push(survey);
        }
      });

      for (const [officerName, surveys] of officerGroups.entries()) {
        const fileName = generateReportFileName('Field-Officer', officerName, reportDate, 'pdf');
        const excelFileName = generateReportFileName('Field-Officer', officerName, reportDate, 'xlsx');
        const pdfPath = await generatePdfReport(surveys, `Field Officer: ${officerName}`, fileName);
        const excelPath = await generateExcelReport(surveys, `Field Officer: ${officerName}`, excelFileName);
        generatedFiles.push({ type: 'field_officer', value: officerName, pdfPath, excelPath });
      }

      // 7. UDID-wise reports
      const udidGroups = new Map<string, any[]>();
      surveysWithFilters.forEach((survey: any) => {
        const udid = survey.filters.udid || 'निर्दिष्ट नाही';
        if (!udidGroups.has(udid)) {
          udidGroups.set(udid, []);
        }
        udidGroups.get(udid)!.push(survey);
      });

      for (const [udid, surveys] of udidGroups.entries()) {
        const fileName = generateReportFileName('UDID', udid, reportDate, 'pdf');
        const excelFileName = generateReportFileName('UDID', udid, reportDate, 'xlsx');
        const pdfPath = await generatePdfReport(surveys, `UDID: ${udid}`, fileName);
        const excelPath = await generateExcelReport(surveys, `UDID: ${udid}`, excelFileName);
        generatedFiles.push({ type: 'udid', value: udid, pdfPath, excelPath });
      }

      Logger.info('EXPORT_REPORTS_GENERATED', {
        total_files: generatedFiles.length,
        report_date: reportDate.toISOString(),
      });

      return NextResponse.json({
        ok: true,
        message: `Generated ${generatedFiles.length} report files`,
        files: generatedFiles,
        report_date: reportDate.toISOString().split('T')[0],
      });

    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('EXPORT_REPORTS_ERROR', {
      error: error?.message || String(error),
      stack: error?.stack,
    });
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to generate reports',
      },
      { status: 500 }
    );
  }
};

/**
 * Generate PDF report for filtered surveys using puppeteer (elegant design)
 */
async function generatePdfReport(surveys: any[], title: string, fileName: string): Promise<string> {
  const OUTPUT_DIR = path.join(process.cwd(), 'storage', 'reports');
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const filePath = path.join(OUTPUT_DIR, fileName);
  
  const generatedDate = new Date().toLocaleString('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  // Build HTML with elegant design matching questions export
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
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
    
    .summary {
      background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
      padding: 15px 20px;
      border-left: 5px solid #1e40af;
      border-radius: 4px;
      margin-bottom: 25px;
    }
    
    .summary-item {
      display: inline-block;
      margin-right: 30px;
      font-size: 10pt;
    }
    
    .summary-item strong {
      color: #1e40af;
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
    
    td {
      border: 1px solid #d1d5db;
      padding: 10px;
      vertical-align: top;
      background-color: #ffffff;
    }
    
    tbody tr:nth-child(even) td {
      background-color: #f8f9fa;
    }
    
    tbody tr:hover td {
      background-color: #f0f4ff;
    }
    
    .note {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 12px 15px;
      margin-top: 20px;
      border-radius: 4px;
      font-size: 9pt;
      color: #856404;
    }
    
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #cbd5e1;
      text-align: center;
      font-size: 8pt;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="marathi">${title}</h1>
    <div class="meta">Generated on: ${generatedDate}</div>
  </div>
  
  <div class="summary">
    <div class="summary-item">
      <strong>Total Surveys:</strong> ${surveys.length}
    </div>
    <div class="summary-item">
      <strong>Report Date:</strong> ${new Date().toLocaleDateString('en-IN')}
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th style="width: 8%;">Survey ID</th>
        <th style="width: 15%;">Aadhaar Number</th>
        <th style="width: 25%;">Holder Name</th>
        <th style="width: 20%;">Source</th>
        <th style="width: 15%;">Taluka</th>
        <th style="width: 17%;">Created Date</th>
      </tr>
    </thead>
    <tbody>
      ${surveys.slice(0, 100).map((survey: any) => {
        const filters = survey.filters || extractFilterData(survey);
        const createdDate = survey.created_at 
          ? new Date(survey.created_at).toLocaleDateString('en-IN')
          : '-';
        const aadharNo = (survey.aadhar_no || '-').toString().replace(/[<>&"']/g, '');
        const holderName = (survey.holder_name || '-').toString().replace(/[<>&"']/g, '');
        const source = (survey.source || '-').toString().replace(/[<>&"']/g, '');
        const taluka = (filters.taluka || '-').toString().replace(/[<>&"']/g, '');
        return `
        <tr>
          <td style="text-align: center; font-weight: 600; color: #1e40af;">${survey.id}</td>
          <td>${aadharNo}</td>
          <td class="marathi">${holderName}</td>
          <td>${source}</td>
          <td class="marathi">${taluka}</td>
          <td>${createdDate}</td>
        </tr>
        `;
      }).join('')}
    </tbody>
  </table>
  
  ${surveys.length > 100 ? `
    <div class="note">
      <strong>Note:</strong> Showing first 100 of ${surveys.length} surveys. Full data available in the attached Excel file.
    </div>
  ` : ''}
  
  <div class="footer">
    DDRC Survey System - Automated Report Generation
  </div>
</body>
</html>`;

  // Generate PDF using puppeteer
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  try {
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
    
    fs.writeFileSync(filePath, pdfBuffer);
  } finally {
    await browser.close();
  }
  
  return filePath;
}

/**
 * Generate Excel report for filtered surveys
 */
async function generateExcelReport(surveys: any[], title: string, fileName: string): Promise<string> {
  const OUTPUT_DIR = path.join(process.cwd(), 'storage', 'reports');
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const filePath = path.join(OUTPUT_DIR, fileName);
  
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Surveys');
  
  // Add header row
  sheet.columns = [
    { header: 'Survey ID', key: 'id', width: 12 },
    { header: 'Aadhaar Number', key: 'aadhar_no', width: 18 },
    { header: 'Holder Name', key: 'holder_name', width: 30 },
    { header: 'Gender', key: 'gender', width: 12 },
    { header: 'DOB', key: 'dob', width: 15 },
    { header: 'Taluka', key: 'taluka', width: 20 },
    { header: 'District', key: 'district', width: 20 },
    { header: 'Source', key: 'source', width: 25 },
    { header: 'Field Officer', key: 'field_officer', width: 25 },
    { header: 'Disability', key: 'disability', width: 30 },
    { header: 'UDID', key: 'udid', width: 15 },
    { header: 'Created Date', key: 'created_at', width: 20 },
  ];
  
  // Add title
  sheet.insertRow(1, [title]);
  sheet.mergeCells(1, 1, 1, 12);
  sheet.getRow(1).font = { size: 14, bold: true };
  sheet.getRow(1).alignment = { horizontal: 'center' };
  
  // Add summary
  sheet.insertRow(2, [`Total Surveys: ${surveys.length}`, '', '', '', '', '', '', '', '', '', '', '']);
  sheet.insertRow(3, [`Generated on: ${new Date().toLocaleDateString('en-IN')}`, '', '', '', '', '', '', '', '', '', '', '']);
  sheet.insertRow(4, []); // Empty row
  
  // Add data rows
  surveys.forEach((survey: any) => {
    const filters = survey.filters || extractFilterData(survey);
    sheet.addRow({
      id: survey.id,
      aadhar_no: survey.aadhar_no || '-',
      holder_name: survey.holder_name || '-',
      gender: survey.gender || '-',
      dob: survey.dob ? new Date(survey.dob).toLocaleDateString('en-IN') : '-',
      taluka: filters.taluka || '-',
      district: filters.district || '-',
      source: filters.source || '-',
      field_officer: filters.fieldOfficerName || '-',
      disability: filters.disability || '-',
      udid: filters.udid || '-',
      created_at: survey.created_at ? new Date(survey.created_at).toLocaleDateString('en-IN') : '-',
    });
  });
  
  // Style header row
  const headerRow = sheet.getRow(5);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
  
  await workbook.xlsx.writeFile(filePath);
  
  return filePath;
}

