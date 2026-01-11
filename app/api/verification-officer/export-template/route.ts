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
      // Check which taluka table exists
      const [talukaTableCheck]: any = await conn.query("SHOW TABLES LIKE 'tbl_all_talukas'");
      const hasAllTalukasTable = Array.isArray(talukaTableCheck) && talukaTableCheck.length > 0;

      let talukaSql = "";
      if (hasAllTalukasTable) {
        talukaSql = `
          SELECT DISTINCT taluka 
          FROM (
            SELECT DISTINCT taluka FROM tbl_all_talukas WHERE (status IS NULL OR status = 'Active')
            UNION
            SELECT DISTINCT taluka FROM tbl_taluka WHERE (status IS NULL OR status = 'Active')
          ) AS t
          WHERE taluka IS NOT NULL AND taluka != ''
          ORDER BY taluka
        `;
      } else {
        talukaSql = `
          SELECT DISTINCT taluka FROM tbl_taluka 
          WHERE (status IS NULL OR status = 'Active') AND taluka IS NOT NULL AND taluka != ''
          ORDER BY taluka
        `;
      }

      const [talukasRows]: any = await conn.query(talukaSql);

      const talukas = Array.isArray(talukasRows)
        ? talukasRows.map((r: any) => r.taluka).filter(Boolean)
        : [];

      // Fetch villages for each taluka
      const talukaVillagesMap = new Map<string, string[]>();
      for (const taluka of talukas) {
        try {
          const [tables]: any = await conn.query("SHOW TABLES LIKE 'tbl_all_villages'");
          const useVillagesTable = Array.isArray(tables) && tables.length > 0;

          let sql: string;
          if (useVillagesTable) {
            sql = `SELECT DISTINCT villages FROM tbl_all_villages 
                   WHERE taluka = ? AND (status IS NULL OR status = 'Active') 
                   ORDER BY villages`;
          } else {
            sql = `SELECT DISTINCT village AS villages FROM tbl_all_grams 
                   WHERE taluka = ? AND (status IS NULL OR status = 'Active') 
                   ORDER BY village`;
          }

          const [villageRows]: any = await conn.query(sql, [taluka]);
          const villages = Array.isArray(villageRows)
            ? villageRows
              .map((r: any) => {
                const value = r.villages || r.village;
                return Array.isArray(value) ? value[0] : value;
              })
              .filter(Boolean)
            : [];

          if (villages.length > 0) {
            talukaVillagesMap.set(taluka, villages);
          }
        } catch (err) {
          console.error(`Error fetching villages for taluka ${taluka}:`, err);
        }
      }

      // Fetch questions matching public form structure (including options, conditional rendering info)
      const [questions]: any = await conn.query(`
        SELECT 
          q.id, 
          q.question, 
          q.section_id, 
          s.name AS section_name, 
          q.question_type, 
          q.options,
          q.rendering_condition,
          q.rendering_question,
          q.rendering_value
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

      // Create main data worksheet FIRST (so it's worksheets[0] for import)
      const worksheet = workbook.addWorksheet('Divyang Data');

      // Create a hidden sheet for taluka-village mappings (for dependent dropdowns)
      // This must be created AFTER the main sheet but will be hidden
      const mappingSheet = workbook.addWorksheet('TalukaVillages');
      mappingSheet.state = 'hidden'; // Hide this sheet

      // Create named ranges for each taluka's villages
      // Excel requires named ranges to reference a sheet, so we'll use the hidden sheet
      let currentRow = 1;
      const talukaRangeNames: string[] = [];

      for (const taluka of talukas) {
        const villages = talukaVillagesMap.get(taluka) || [];
        if (villages.length === 0) continue;

        // Create a safe name for the range (Excel doesn't allow spaces/special chars in range names)
        const rangeName = `Taluka_${taluka.replace(/[^a-zA-Z0-9]/g, '_')}`;
        talukaRangeNames.push(rangeName);

        // Write villages to the hidden sheet
        villages.forEach((village, idx) => {
          mappingSheet.getCell(currentRow + idx, 1).value = village;
        });

        // Create named range for this taluka's villages
        // ExcelJS uses definedNames collection
        const startCell = mappingSheet.getCell(currentRow, 1).address;
        const endCell = mappingSheet.getCell(currentRow + villages.length - 1, 1).address;

        // Add named range using definedNames
        workbook.definedNames.add(rangeName, `TalukaVillages!$${startCell}:$${endCell}`);

        currentRow += villages.length + 1; // Add gap between talukas
      }

      // Build columns from questions and store question metadata for dropdowns and conditionals
      const columns: Array<{ header: string; key: string; width: number }> = [];
      const questionMetadata: Map<string, {
        id: number;
        options: string | null;
        question_type: string;
        rendering_condition: string | null;
        rendering_question: string | null;
        rendering_value: string | null;
        question_text: string;
      }> = new Map();

      // Track similar questions (by normalized text) to identify duplicates
      const questionTextMap = new Map<string, number[]>(); // normalized text -> array of question IDs

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

      // Helper function to normalize question text for similarity detection
      const normalizeQuestionText = (text: string): string => {
        return text
          .toLowerCase()
          .replace(/[^\w\s]/g, '') // Remove special characters
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      };

      // First pass: Identify similar questions
      if (Array.isArray(questions) && questions.length > 0) {
        for (const q of questions) {
          const questionText = (q.question || '').trim();
          if (!questionText) continue;

          const normalized = normalizeQuestionText(questionText);
          if (!questionTextMap.has(normalized)) {
            questionTextMap.set(normalized, []);
          }
          questionTextMap.get(normalized)!.push(q.id);
        }
      }

      // Add all other questions as columns
      if (Array.isArray(questions) && questions.length > 0) {
        const seenQuestions = new Set<string>();

        for (const q of questions) {
          const questionText = (q.question || '').trim();
          if (!questionText) continue;

          // Check for similar questions
          const normalized = normalizeQuestionText(questionText);
          const similarQuestionIds = questionTextMap.get(normalized) || [];
          const hasSimilar = similarQuestionIds.length > 1;

          // Skip exact duplicates (same text already seen)
          if (seenQuestions.has(questionText)) {
            continue;
          }

          seenQuestions.add(questionText);

          // Skip name question if already added
          if (questionText.includes('नाव') && questionText.includes('दिव्यांग')) {
            continue; // Already added as 'name'
          }

          // Create a safe key from question text
          const key = `q_${q.id}`;

          // Build header with conditional info if applicable
          let header = `${questionText} (Q${q.id})`;
          const isConditional = q.rendering_condition &&
            (q.rendering_condition.toLowerCase() === 'yes' || q.rendering_condition === '1' || q.rendering_condition === 'true');

          if (isConditional && q.rendering_question && q.rendering_value) {
            // Add conditional indicator to header
            header += ' [CONDITIONAL]';
          }

          if (hasSimilar) {
            header += ' [SIMILAR]';
          }

          columns.push({
            header: header,
            key: key,
            width: Math.max(25, Math.min(50, questionText.length * 1.5)),
          });

          // Store question metadata for dropdown creation and conditional handling
          questionMetadata.set(key, {
            id: q.id,
            options: q.options || null,
            question_type: (q.question_type || '').toLowerCase(),
            rendering_condition: q.rendering_condition || null,
            rendering_question: q.rendering_question || null,
            rendering_value: q.rendering_value || null,
            question_text: questionText,
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

      // Add a summary of conditional questions at the end (as hidden columns or in a separate area)
      // We'll add conditional info as comments on headers instead (done below)

      // Add 10 sample rows with taluka "Parner" and village "Bahirobawadi"
      if (Array.isArray(questions) && questions.length > 0) {
        const sampleNames = [
          'राम कृष्ण पाटील',
          'सीता देवी शर्मा',
          'कृष्णा मोहन देशमुख',
          'प्रिया सुनील जोशी',
          'विकास अनिल कुलकर्णी',
          'माधुरी राजेश पवार',
          'अजय सुरेश गायकवाड',
          'स्वाती रवींद्र नाईक',
          'रोहित प्रकाश सावंत',
          'अंजली दिलीप चव्हाण'
        ];

        const sampleAadhaars = [
          '123456789012',
          '234567890123',
          '345678901234',
          '456789012345',
          '567890123456',
          '678901234567',
          '789012345678',
          '890123456789',
          '901234567890',
          '012345678901'
        ];

        const disabilityTypes = ['दृष्टिहीनता', 'श्रवण हानी', 'चलन अक्षमता', 'मानसिक मंदता', 'मानसिक आजार'];
        const genders = ['पुरुष', 'स्त्री', 'अन्य'];
        const educationLevels = ['अनपढ', '1-4', '5-7', '8-10', '10वी पास', '12वी पास', 'पदवी'];

        // Generate 10 sample rows
        for (let rowIndex = 0; rowIndex < 10; rowIndex++) {
          const sampleRow: any = {
            aadhar_no: sampleAadhaars[rowIndex],
            name: sampleNames[rowIndex],
          };

          // Add sample answers for each question
          for (const q of questions) {
            const questionText = (q.question || '').trim();
            if (!questionText) continue;

            const key = `q_${q.id}`;
            let sampleValue = '';

            // Set taluka to "Parner" for all rows
            if (questionText.includes('तालुका') || questionText.includes('Taluka') || 
                questionText.includes('ता.') || questionText.toLowerCase().includes('taluka')) {
              sampleValue = 'Parner';
            }
            // Set village to "Bahirobawadi" for all rows
            else if (questionText.includes('गाव') || questionText.includes('Village') || 
                     questionText.includes('ग्राम') || questionText.includes('Gaav')) {
              sampleValue = 'Bahirobawadi';
            }
            // If question has options, use a random option as sample value
            else if (q.options && q.options.trim() && q.options.trim() !== 'NULL') {
              const optionsList = q.options
                .split(',')
                .map((opt: string) => opt.trim())
                .filter((opt: string) => opt.length > 0);
              if (optionsList.length > 0) {
                // Use different options for different rows to show variety
                sampleValue = optionsList[rowIndex % optionsList.length];
              }
            }
            // If no options or still empty, provide sample values based on question content
            else if (!sampleValue) {
              if (questionText.includes('नाव') && questionText.includes('दिव्यांग')) {
                sampleValue = sampleNames[rowIndex];
              } else if (questionText.includes('आधार') || questionText.includes('Aadhaar') || questionText.includes('Aadhar')) {
                sampleValue = sampleAadhaars[rowIndex];
              } else if (questionText.includes('जिल्हा') || questionText.includes('District')) {
                sampleValue = 'अहमदनगर';
              } else if (questionText.includes('पिन') || questionText.includes('PIN')) {
                sampleValue = '414302';
              } else if (questionText.includes('मोबाइल') || questionText.includes('Mobile')) {
                sampleValue = `9876543${String(rowIndex).padStart(3, '0')}`;
              } else if (questionText.includes('दिव्यांगता प्रकार') || questionText.includes('Disability Type')) {
                sampleValue = disabilityTypes[rowIndex % disabilityTypes.length];
              } else if (questionText.includes('दिव्यांगता टक्केवारी') || questionText.includes('Disability Percentage')) {
                sampleValue = String(40 + (rowIndex * 5)); // 40, 45, 50, etc.
              } else if (questionText.includes('वैश्विक कार्ड') || questionText.includes('UDID')) {
                sampleValue = `UDID${sampleAadhaars[rowIndex]}`;
              } else if (questionText.includes('लिंग') || questionText.includes('Gender')) {
                sampleValue = genders[rowIndex % genders.length];
              } else if (questionText.includes('जन्मतारीख') || questionText.includes('Date of Birth')) {
                const year = 1980 + (rowIndex * 3);
                const month = String((rowIndex % 12) + 1).padStart(2, '0');
                const day = String((rowIndex % 28) + 1).padStart(2, '0');
                sampleValue = `${year}-${month}-${day}`;
              } else if (questionText.includes('वय') || questionText.includes('Age')) {
                sampleValue = String(25 + (rowIndex * 3));
              } else if (questionText.includes('शिक्षण') || questionText.includes('Education')) {
                sampleValue = educationLevels[rowIndex % educationLevels.length];
              } else {
                // Default sample value
                sampleValue = 'उदाहरण';
              }
            }

            sampleRow[key] = sampleValue;
          }

          // Add the sample row
          worksheet.addRow(sampleRow);

          // Style the sample rows (light gray background to indicate they're examples)
          const sampleRowIndex = worksheet.rowCount;
          const sampleRowObj = worksheet.getRow(sampleRowIndex);
          sampleRowObj.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F0F0' },
          };
          sampleRowObj.font = { italic: true, color: { argb: 'FF666666' } };
          sampleRowObj.height = 20;
        }
      }

      // Create a map of question ID to question text for finding rendering questions
      const questionIdToText = new Map<number, string>();
      if (Array.isArray(questions)) {
        for (const q of questions) {
          questionIdToText.set(q.id, (q.question || '').trim());
        }
      }

      // Identify taluka and village/gaav columns for dependent dropdowns
      let talukaColumnIndex = -1;
      let villageColumnIndex = -1;
      let talukaColumnLetter = '';
      let villageColumnLetter = '';

      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const column = columns[colIndex];
        const metadata = questionMetadata.get(column.key);
        const questionText = metadata?.question_text || column.header || '';

        // Check if this is taluka column
        if ((questionText.includes('तालुका') || questionText.includes('Taluka')) &&
          !questionText.includes('गाव') && !questionText.includes('Village')) {
          talukaColumnIndex = colIndex;
          talukaColumnLetter = worksheet.getColumn(colIndex + 1).letter;
        }

        // Check if this is village/gaav column
        if (questionText.includes('गाव') || questionText.includes('Village') ||
          questionText.includes('ग्राम') || questionText.includes('Gaav')) {
          villageColumnIndex = colIndex;
          villageColumnLetter = worksheet.getColumn(colIndex + 1).letter;
        }
      }

      // Add dropdown lists (data validation) and comments for conditional columns
      // Start from row 2 (after header) and apply to many rows for future data entry
      const startRow = 2;
      const endRow = 1000; // Apply to many rows for future data entry

      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const column = columns[colIndex];
        const metadata = questionMetadata.get(column.key);
        const columnLetter = worksheet.getColumn(colIndex + 1).letter;
        const headerCell = worksheet.getCell(`${columnLetter}1`);

        // Handle taluka column - add dropdown with all talukas
        if (colIndex === talukaColumnIndex && talukas.length > 0) {
          const talukaFormula = `"${talukas.join(',')}"`;
          for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
            const cell = worksheet.getCell(`${columnLetter}${rowNum}`);
            cell.dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: [talukaFormula],
              showErrorMessage: true,
              errorStyle: 'warning',
              errorTitle: 'Invalid Taluka',
              error: 'कृपया ड्रॉपडाउन सूचीमधून तालुका निवडा. Please select taluka from dropdown.',
            };
          }
          continue; // Skip other processing for taluka column
        }

        // Handle village/gaav column - add dependent dropdown based on taluka selection
        if (colIndex === villageColumnIndex && talukaColumnIndex >= 0 && talukaColumnLetter) {
          // Add a note explaining the dependency
          headerCell.note = `DEPENDENT DROPDOWN:\n\nThis field depends on the Taluka selection.\nAfter selecting a Taluka, this field will show villages for that taluka.\n\nकृपया प्रथम तालुका निवडा, नंतर गाव निवडा.`;

          // Add a light blue background to indicate dependency
          headerCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE3F2FD' }, // Light blue
          };

          // Create dependent dropdowns using INDIRECT formula
          // Excel formula: INDIRECT("Taluka_" & SUBSTITUTE([taluka_cell], " ", "_"))
          // This will dynamically reference the named range based on taluka selection
          for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
            const cell = worksheet.getCell(`${columnLetter}${rowNum}`);
            const talukaCellRef = `${talukaColumnLetter}${rowNum}`;

            // Build the INDIRECT formula
            // Formula: INDIRECT("Taluka_" & SUBSTITUTE([taluka_cell], " ", "_"))
            // This will create a reference like: INDIRECT("Taluka_Pune") which points to the named range
            const indirectFormula = `INDIRECT("Taluka_" & SUBSTITUTE(${talukaCellRef}, " ", "_"))`;

            cell.dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: [indirectFormula],
              showErrorMessage: true,
              errorStyle: 'warning',
              errorTitle: 'Invalid Village',
              error: 'कृपया प्रथम तालुका निवडा, नंतर गाव निवडा. Please select Taluka first, then select Village.',
            };
          }

          continue; // Skip other processing for village column
        }

        if (metadata) {
          // Add comment/note for conditional questions
          if (metadata.rendering_condition &&
            (metadata.rendering_condition.toLowerCase() === 'yes' ||
              metadata.rendering_condition === '1' ||
              metadata.rendering_condition === 'true')) {

            if (metadata.rendering_question && metadata.rendering_value) {
              // Find the rendering question text
              let renderingQText = '';
              const renderingQId = parseInt(metadata.rendering_question);
              if (renderingQId > 0 && questionIdToText.has(renderingQId)) {
                renderingQText = questionIdToText.get(renderingQId)!;
              } else {
                renderingQText = metadata.rendering_question;
              }

              // Create comment explaining the condition
              const commentText = `CONDITIONAL FIELD:\n\nThis field should only be filled when:\n"${renderingQText}" = "${metadata.rendering_value}"\n\nकृपया हे फील्ड फक्त तेव्हा भरा जेव्हा:\n"${renderingQText}" = "${metadata.rendering_value}"`;

              // Add note as cell comment (ExcelJS supports comments)
              headerCell.note = commentText;

              // Also add conditional formatting hint (light yellow background for conditional columns)
              headerCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF99' }, // Light yellow
              };
            }
          }

          // Add dropdown lists for questions with options
          if (metadata.options) {
            // Parse options (comma-separated string)
            const optionsStr = metadata.options.trim();
            if (optionsStr && optionsStr !== 'NULL' && optionsStr !== '') {
              const optionsList = optionsStr
                .split(',')
                .map((opt: string) => opt.trim())
                .filter((opt: string) => opt.length > 0);

              if (optionsList.length > 0) {
                // Create a formula string for the list (comma-separated values in quotes)
                const formula = `"${optionsList.join(',')}"`;

                // Apply data validation to each cell in the range
                for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
                  const cell = worksheet.getCell(`${columnLetter}${rowNum}`);
                  cell.dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [formula],
                    showErrorMessage: true,
                    errorStyle: 'warning',
                    errorTitle: 'Invalid Value',
                    error: `कृपया ड्रॉपडाउन सूचीमधून निवडा. Please select from dropdown.`,
                  };
                }
              }
            }
          }
        }
      }

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
      { ok: false, error: error.message || 'Failed to generate template', details: error.stack },
      { status: 500 }
    );
  }
});








