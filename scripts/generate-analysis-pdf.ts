import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'pdfs');
const OUTPUT_PDF = path.join(OUTPUT_DIR, `ddrc-analysis-report-${new Date().getTime()}.pdf`);

const htmlContent = `<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DDRC Survey Questionnaire: Proposed Updates & Logic Flow</title>
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
      font-family: 'Noto Sans', 'Noto Sans Devanagari', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #1e3a8a;
    }
    
    .header h1 {
      font-size: 22pt;
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 5px;
    }
    
    .header h2 {
      font-size: 16pt;
      color: #4b5563;
      font-weight: 500;
    }
    
    .header .meta {
      font-size: 9pt;
      color: #666;
      margin-top: 15px;
    }
    
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 14pt;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 12px;
      padding: 8px 12px;
      background: #eff6ff;
      border-left: 4px solid #1e40af;
      border-radius: 4px;
    }
    
    .content-box {
      padding: 15px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #f9fafb;
    }
    
    .label {
      font-weight: 700;
      color: #1e3a8a;
      margin-top: 10px;
      display: block;
    }
    
    ul {
      margin-left: 20px;
      margin-top: 5px;
    }
    
    li {
      margin-bottom: 5px;
    }
    
    .condition {
      font-style: italic;
      color: #059669;
      background: #ecfdf5;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10pt;
      display: inline-block;
      margin-bottom: 8px;
    }

    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 9pt;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>DDRC Survey Questionnaire</h1>
    <h2>Proposed Updates & Logic Flow / विश्लेषण आणि प्रस्तावित बदल</h2>
    <div class="meta">
      Generated on: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}
    </div>
  </div>

  <div class="section">
    <div class="section-title">1. दिव्यांगता तपशील (Disability Details)</div>
    <div class="content-box">
      <p><strong>Update:</strong> Enhancement of the "Reason for Disability" question to include standardized medical and genetic categories.</p>
      <span class="label">Question: दिव्यांगता कारण (Reason for Disability)</span>
      <span class="label">Options:</span>
      <ul>
        <li>अ. जन्मत: (Congenital)</li>
        <li>ब. अपघात (Accident)</li>
        <li>क. वांशिक (Hereditary)</li>
        <li>ड. अनुवांशिक (Genetic)</li>
        <li>इ. आजाराने (Due to Illness)</li>
      </ul>
    </div>
  </div>

  <div class="section">
    <div class="section-title">2. शैक्षणिक माहिती (Educational Details)</div>
    <div class="content-box">
      <span class="condition">Condition: If education is Padavidhar (Graduate), Diploma, or Doctorate.</span>
      <span class="label">New Question: शिक्षण क्षेत्रात प्रवेश घेण्यासाठी ५% राखीव जागांचा लाभ घेतला आहे का ?</span>
      <span class="label">Options:</span>
      <ul>
        <li>अ. होय (Yes)</li>
        <li>ब. नाही (No)</li>
      </ul>
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. वैवाहिक माहिती (Marital Details)</div>
    <div class="content-box">
      <span class="condition">Condition: If Marital Status is Unmarried (अविवाहित).</span>
      <span class="label">New Question: विवाह करण्याचा मानस आहे का? (Do you intend to get married?)</span>
      <span class="label">Options:</span>
      <ul>
        <li>अ. होय (Yes)</li>
        <li>ब. नाही (No)</li>
      </ul>
    </div>
  </div>

  <div class="section">
    <div class="section-title">4. क्रीडा नैपुण्य (Sports Proficiency)</div>
    <div class="content-box">
      <span class="condition">Condition: If "Proficiency in Sports" is Yes (होय).</span>
      <span class="label">New Question: नैपुण्य स्तर (Level of Achievement)</span>
      <span class="label">Options:</span>
      <ul>
        <li>अ. जिल्हास्तर (District Level)</li>
        <li>ब. राज्यस्तर (State Level)</li>
        <li>क. राष्ट्रीय (National Level)</li>
        <li>ड. आंतरराष्ट्रीय (International Level)</li>
      </ul>
    </div>
  </div>

  <div class="section">
    <div class="section-title">5. नोकरी व व्यवसाय (Employment & Business)</div>
    <div class="content-box">
      <div style="margin-bottom: 15px;">
        <span class="condition">Condition: If Employment Status is "Job" (नोकरी).</span>
        <span class="label">New Question: नोकरीचे स्वरूप (Nature of Job)</span>
        <span class="label">Options:</span>
        <ul>
          <li>अ. कायम (Permanent), ब. कंत्राटी (Contractual), क. मानधन तत्वावर (Honorarium), ड. रोजंदारी (Daily Wages)</li>
        </ul>
      </div>
      <div style="margin-bottom: 15px;">
        <span class="condition">Condition: If Nature of Job is "Government" (सरकारी).</span>
        <span class="label">New Question: नोकरीसाठी ४% राखीव जागांचा लाभ घेतला आहे का ?</span>
        <span class="label">Options: होय / नाही</span>
      </div>
      <div>
        <span class="label">New Question: कुटुंब पूर्णपणे दिव्यांग व्यक्तीच्या उत्पन्नावर अवलंबून आहे का ?</span>
        <span class="label">Options: होय / नाही</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">6. इतर शासकीय योजना (Other Government Schemes)</div>
    <div class="content-box">
      <ul>
        <li><strong>Q8:</strong> दिव्यांग व्यक्तीला मनरेगा (MNREGA) योजनेत रोजगार मिळाला आहे का? (होय / नाही)</li>
        <li><strong>Q9:</strong> राष्ट्रीय कृत बँकेत खाते आहे का? (होय / नाही)</li>
        <li><strong>Q10:</strong> दिव्यांगासाठी राखीव ५% निधी अंतर्गत लाभ घेतला आहे का ? (होय / नाही)</li>
      </ul>
      <div style="margin-top: 10px;">
        <span class="condition">Condition: If Q10 is Yes (होय).</span>
        <span class="label">Sub-Question: लाभ असल्यास वितरण विभाग (Distributing Authority)</span>
        <span class="label">Options:</span>
        <ul>
          <li>अ. ग्रा. पं, ब. पं स, क. न. पा, ड. मनपा, इ. जिल्हा परिषद</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>DDRC Analysis Report & Question Proposal</p>
    <p>© 2026 DDRC Ahilyanagar</p>
  </div>
</body>
</html>`;

async function generate() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    await page.pdf({
        path: OUTPUT_PDF,
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
    console.log(OUTPUT_PDF);
}

generate();
