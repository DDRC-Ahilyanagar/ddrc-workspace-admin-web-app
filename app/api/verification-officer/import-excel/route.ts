import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import ExcelJS from 'exceljs';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface ExcelRow {
  name?: string;
  aadhaar?: string;
  village?: string;
  taluka?: string;
  gram?: string;
  disability_type?: string;
  disability_percentage?: string;
  udid_card?: string;
  phone?: string;
  email?: string;
  dob?: string;
  gender?: string;
}

/**
 * Import Excel file and distribute data to ASHA workers based on village
 */
export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    // Check if user is verification officer
    const userType = (user?.user_type || '').toLowerCase().trim();
    if (userType !== 'verification_officer' && userType !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Only verification officers can import data' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json(
        { ok: false, error: 'Excel file is empty' },
        { status: 400 }
      );
    }

    // Parse rows (skip header row)
    const rows: ExcelRow[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const rowData: ExcelRow = {};
      row.eachCell((cell, colNumber) => {
        const header = worksheet.getRow(1).getCell(colNumber).value?.toString() || '';
        const value = cell.value?.toString() || '';

        // Map columns based on header
        if (header.toLowerCase().includes('name') || header.includes('नाव')) {
          rowData.name = value;
        } else if (header.toLowerCase().includes('aadhaar') || header.includes('आधार')) {
          rowData.aadhaar = value.replace(/\D/g, ''); // Extract only digits
        } else if (header.toLowerCase().includes('village') || header.includes('गाव')) {
          rowData.village = value;
        } else if (header.toLowerCase().includes('taluka') || header.includes('तालुका')) {
          rowData.taluka = value;
        } else if (header.toLowerCase().includes('gram') || header.includes('ग्राम')) {
          rowData.gram = value;
        } else if (header.toLowerCase().includes('disability type') || header.includes('दिव्यांगता प्रकार')) {
          rowData.disability_type = value;
        } else if (header.toLowerCase().includes('disability percentage') || header.includes('टक्केवारी')) {
          rowData.disability_percentage = value;
        } else if (header.toLowerCase().includes('udid') || header.includes('UDID')) {
          rowData.udid_card = value;
        } else if (header.toLowerCase().includes('phone') || header.includes('मोबाइल')) {
          rowData.phone = value.replace(/\D/g, '');
        } else if (header.toLowerCase().includes('email') || header.includes('ईमेल')) {
          rowData.email = value;
        } else if (header.toLowerCase().includes('date of birth') || header.includes('जन्मतारीख') || header.toLowerCase().includes('dob')) {
          rowData.dob = value;
        } else if (header.toLowerCase().includes('gender') || header.includes('लिंग')) {
          rowData.gender = value;
        }
      });

      // Only add row if it has at least name and aadhaar
      if (rowData.name && rowData.aadhaar && rowData.aadhaar.length >= 12) {
        rows.push(rowData);
      }
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No valid data found in Excel file' },
        { status: 400 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Group rows by village for ASHA worker distribution
      const villageGroups: Record<string, ExcelRow[]> = {};
      for (const row of rows) {
        const village = row.village || 'Unknown';
        if (!villageGroups[village]) {
          villageGroups[village] = [];
        }
        villageGroups[village].push(row);
      }

      // Get field officers by village (ASHA workers)
      const processedRows: any[] = [];
      const errors: string[] = [];

      for (const [village, villageRows] of Object.entries(villageGroups)) {
        // Find field officers assigned to this village
        const [officers]: any = await conn.query(
          `SELECT u.id, u.name, u.contact_number 
           FROM users u
           WHERE u.user_type = 'field_officer' 
           AND u.status = 'active'
           AND u.is_active = 1
           ORDER BY u.id ASC
           LIMIT 1`
        );

        const assignedOfficer = Array.isArray(officers) && officers.length > 0 ? officers[0] : null;

        // Process each row in the village
        for (const row of villageRows) {
          try {
            // Create or update survey_aadhar record
            const [aadharResult]: any = await conn.query(
              `INSERT INTO survey_aadhar (aadhaar_number, name, created_at, updated_at)
               VALUES (?, ?, NOW(), NOW())
               ON DUPLICATE KEY UPDATE 
                 name = VALUES(name),
                 updated_at = NOW()`,
              [row.aadhaar, row.name]
            );

            let aadharId = aadharResult.insertId;
            
            // If insertId is not available, query for existing record
            if (!aadharId) {
              const [existingRows]: any = await conn.query(
                `SELECT id FROM survey_aadhar WHERE aadhaar_number = ? LIMIT 1`,
                [row.aadhaar]
              );
              if (Array.isArray(existingRows) && existingRows.length > 0) {
                aadharId = existingRows[0]?.id;
              }
            }

            if (!aadharId) {
              errors.push(`Failed to create/update Aadhaar record for ${row.name}`);
              continue;
            }

            // Store the data for ASHA worker notification
            // You can extend this to send notifications to ASHA workers
            processedRows.push({
              aadharId,
              name: row.name,
              aadhaar: row.aadhaar,
              village: row.village,
              taluka: row.taluka,
              assignedOfficer: assignedOfficer ? {
                id: assignedOfficer.id,
                name: assignedOfficer.name,
                phone: assignedOfficer.contact_number,
              } : null,
            });

            Logger.info('EXCEL_IMPORT_ROW_PROCESSED', {
              aadharId,
              name: row.name,
              village: row.village,
              officerId: assignedOfficer?.id,
            });
          } catch (rowError: any) {
            errors.push(`Error processing ${row.name}: ${rowError.message}`);
            Logger.error('EXCEL_IMPORT_ROW_ERROR', {
              error: rowError.message,
              row: row.name,
            });
          }
        }
      }

      return NextResponse.json({
        ok: true,
        message: `Successfully imported ${processedRows.length} records`,
        processed: processedRows.length,
        errors: errors.length,
        errorDetails: errors.length > 0 ? errors : undefined,
        data: processedRows,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('EXCEL_IMPORT_ERROR', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to import Excel file' },
      { status: 500 }
    );
  }
});

