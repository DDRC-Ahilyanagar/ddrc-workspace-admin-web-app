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
      
      // Create instructions sheet first
      const instructionsSheet = workbook.addWorksheet('Instructions');
      instructionsSheet.columns = [
        { header: 'Instructions', key: 'instructions', width: 100 }
      ];
      
      // Add instructions content
      const instructions = [
        'EXCEL TEMPLATE INSTRUCTIONS',
        '',
        'COLUMN MARKINGS:',
        '  • [CONDITIONAL] - Fill this column only when the condition is met',
        '  • [SIMILAR] - Similar questions exist (check question IDs to identify)',
        '',
        'CONDITIONAL FIELDS:',
        '  • Conditional fields have a yellow header background',
        '  • Hover over the header cell to see the condition',
        '  • Only fill conditional fields when the specified condition is met',
        '',
        'DROPDOWN LISTS:',
        '  • Columns with dropdown lists show a dropdown arrow when clicked',
        '  • Select from the dropdown instead of typing',
        '',
        'SAMPLE ROW:',
        '  • Row 2 contains sample data (gray background)',
        '  • Delete this row before entering real data',
        '  • Use it as a reference for expected format',
      ];
      
      instructions.forEach((instruction, index) => {
        const row = instructionsSheet.addRow([instruction]);
        if (index === 0) {
          row.font = { bold: true, size: 14 };
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
          };
          row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        } else if (instruction.startsWith('  •')) {
          row.font = { size: 10 };
        }
        row.height = 20;
      });
      
      // Create main data worksheet
      const worksheet = workbook.addWorksheet('Divyang Data');

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

      // Add sample row with example data to help users understand the format
      if (Array.isArray(questions) && questions.length > 0) {
        const sampleRow: any = {
          aadhar_no: '123456789012',
          name: 'राम कृष्ण पाटील',
        };

        // Add sample answers for each question
        for (const q of questions) {
          const questionText = (q.question || '').trim();
          if (!questionText) continue;

          const key = `q_${q.id}`;
          let sampleValue = '';

          // If question has options, use the first option as sample value
          if (q.options && q.options.trim() && q.options.trim() !== 'NULL') {
            const optionsList = q.options
              .split(',')
              .map((opt: string) => opt.trim())
              .filter((opt: string) => opt.length > 0);
            if (optionsList.length > 0) {
              sampleValue = optionsList[0];
            }
          }

          // If no options or still empty, provide sample values based on question content
          if (!sampleValue) {
            if (questionText.includes('नाव') && questionText.includes('दिव्यांग')) {
              sampleValue = 'राम कृष्ण पाटील';
            } else if (questionText.includes('आधार') || questionText.includes('Aadhaar') || questionText.includes('Aadhar')) {
              sampleValue = '123456789012';
            } else if (questionText.includes('गाव') || questionText.includes('Village')) {
              sampleValue = 'सांगवी';
            } else if (questionText.includes('तालुका') || questionText.includes('Taluka')) {
              sampleValue = 'पुणे';
            } else if (questionText.includes('जिल्हा') || questionText.includes('District')) {
              sampleValue = 'पुणे';
            } else if (questionText.includes('पिन') || questionText.includes('PIN')) {
              sampleValue = '411027';
            } else if (questionText.includes('मोबाइल') || questionText.includes('Mobile')) {
              sampleValue = '9876543210';
            } else if (questionText.includes('दिव्यांगता प्रकार') || questionText.includes('Disability Type')) {
              sampleValue = 'दृष्टिहीनता';
            } else if (questionText.includes('दिव्यांगता टक्केवारी') || questionText.includes('Disability Percentage')) {
              sampleValue = '75';
            } else if (questionText.includes('वैश्विक कार्ड') || questionText.includes('UDID')) {
              sampleValue = 'UDID123456789';
            } else if (questionText.includes('लिंग') || questionText.includes('Gender')) {
              sampleValue = 'पुरुष';
            } else if (questionText.includes('जन्मतारीख') || questionText.includes('Date of Birth')) {
              sampleValue = '1990-01-15';
            } else if (questionText.includes('वय') || questionText.includes('Age')) {
              sampleValue = '34';
            } else if (questionText.includes('शिक्षण') || questionText.includes('Education')) {
              sampleValue = '10वी पास';
            } else {
              // Default sample value
              sampleValue = 'उदाहरण';
            }
          }

          sampleRow[key] = sampleValue;
        }

        // Add the sample row
        worksheet.addRow(sampleRow);

        // Style the sample row (light gray background to indicate it's an example)
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

      // Create a map of question ID to question text for finding rendering questions
      const questionIdToText = new Map<number, string>();
      if (Array.isArray(questions)) {
        for (const q of questions) {
          questionIdToText.set(q.id, (q.question || '').trim());
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
      { ok: false, error: error.message || 'Failed to generate template' },
      { status: 500 }
    );
  }
});








