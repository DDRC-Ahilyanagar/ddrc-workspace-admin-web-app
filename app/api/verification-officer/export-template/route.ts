import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

/**
 * Export Excel template with columns matching public form fields
 * Columns: Name, Aadhaar Number, Village, Taluka, and other public form fields
 */
export async function GET(request: NextRequest) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Divyang Data');

    // Define columns matching public form structure
    // वैयक्तिक माहिती (Personal Information) section
    const columns = [
      { header: 'Name (नाव)', key: 'name', width: 30 },
      { header: 'Aadhaar Number (आधार कार्ड नंबर)', key: 'aadhaar', width: 20 },
      { header: 'Village (गाव)', key: 'village', width: 25 },
      { header: 'Taluka (तालुका)', key: 'taluka', width: 25 },
      { header: 'Gram (ग्राम)', key: 'gram', width: 25 },
      { header: 'Disability Type (दिव्यांगता प्रकार)', key: 'disability_type', width: 30 },
      { header: 'Disability Percentage (दिव्यांगता टक्केवारी)', key: 'disability_percentage', width: 25 },
      { header: 'UDID Card (UDID कार्ड)', key: 'udid_card', width: 20 },
      { header: 'Phone Number (मोबाइल नंबर)', key: 'phone', width: 15 },
      { header: 'Email (ईमेल)', key: 'email', width: 25 },
      { header: 'Date of Birth (जन्मतारीख)', key: 'dob', width: 15 },
      { header: 'Gender (लिंग)', key: 'gender', width: 15 },
    ];

    worksheet.columns = columns;

    // Style header row
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add sample data row (optional - can be removed)
    worksheet.addRow({
      name: 'Sample Name',
      aadhaar: '123456789012',
      village: 'Sample Village',
      taluka: 'Sample Taluka',
      gram: 'Sample Gram',
      disability_type: 'Locomotor Disability',
      disability_percentage: '40',
      udid_card: 'Yes',
      phone: '9876543210',
      email: 'sample@example.com',
      dob: '1990-01-01',
      gender: 'Male',
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="divyang_data_template.xlsx"',
      },
    });
  } catch (error: any) {
    console.error('Error generating Excel template:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to generate template' },
      { status: 500 }
    );
  }
}

