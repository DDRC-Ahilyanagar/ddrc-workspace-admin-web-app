import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { sendEmailAndLog } from '@/lib/email-service';
import { Logger } from '@/lib/logger';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * Generate all reports and email them to admin users
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { user, error } = await verifyAuth(request);
    if (!user || error) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only admin can generate and email reports
    const userType = (user?.user_type || '').toLowerCase().trim();
    if (userType !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Only admins can generate reports' },
        { status: 403 }
      );
    }

    // Generate all reports by calling export-reports endpoint
    const apiToken = process.env.DAILY_STATS_API_TOKEN || '';
    
    // Get the base URL from the request
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    
    const reportUrl = new URL('/api/admin/export-reports', baseUrl);
    const reportResponse = await fetch(reportUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {}),
        ...(request.headers.get('cookie') ? { 'Cookie': request.headers.get('cookie')! } : {}),
      },
    });

    if (!reportResponse.ok) {
      const errorText = await reportResponse.text().catch(() => 'Unknown error');
      return NextResponse.json(
        { ok: false, error: `Failed to generate reports: ${errorText}` },
        { status: reportResponse.status }
      );
    }

    const reportData = await reportResponse.json();
    if (!reportData.ok || !Array.isArray(reportData.files)) {
      return NextResponse.json(
        { ok: false, error: 'Failed to generate reports' },
        { status: 500 }
      );
    }

    // Get all admin users with email addresses
    const pool = getDbPool();
    const conn = await pool.getConnection();
    
    try {
      const [adminRows]: any = await conn.query(`
        SELECT u.id, u.name, u.email, u.contact_number
        FROM users u
        WHERE u.user_type = 'admin'
        AND (u.status = 'active' OR u.is_active = 1 OR u.status IS NULL)
        AND u.email IS NOT NULL
        AND u.email != ''
        AND u.email LIKE '%@%'
        ORDER BY u.name
      `);

      const admins = Array.isArray(adminRows) ? adminRows : [];
      
      if (admins.length === 0) {
        return NextResponse.json({
          ok: false,
          error: 'No admin users with valid email addresses found',
        });
      }

      // Prepare attachments
      const attachments = reportData.files.flatMap((file: any) => [
        {
          filename: path.basename(file.pdfPath),
          path: file.pdfPath,
          contentType: 'application/pdf',
        },
        {
          filename: path.basename(file.excelPath),
          path: file.excelPath,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ]);

      const dateStr = new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Group files by type for better summary
      const filesByType = new Map<string, string[]>();
      reportData.files.forEach((file: any) => {
        const type = file.type || 'unknown';
        if (!filesByType.has(type)) {
          filesByType.set(type, []);
        }
        filesByType.get(type)!.push(file.value);
      });

      // Build detailed report list
      const reportDetails: string[] = [];
      if (filesByType.has('source')) {
        reportDetails.push(`<strong>Source-wise:</strong> ${filesByType.get('source')!.length} report(s) - ${filesByType.get('source')!.join(', ')}`);
      }
      if (filesByType.has('taluka')) {
        reportDetails.push(`<strong>Taluka-wise:</strong> ${filesByType.get('taluka')!.length} report(s) - ${filesByType.get('taluka')!.slice(0, 5).join(', ')}${filesByType.get('taluka')!.length > 5 ? ` and ${filesByType.get('taluka')!.length - 5} more` : ''}`);
      }
      if (filesByType.has('disability')) {
        reportDetails.push(`<strong>Disability-wise:</strong> ${filesByType.get('disability')!.length} report(s) - ${filesByType.get('disability')!.slice(0, 5).join(', ')}${filesByType.get('disability')!.length > 5 ? ` and ${filesByType.get('disability')!.length - 5} more` : ''}`);
      }
      if (filesByType.has('district')) {
        reportDetails.push(`<strong>District-wise:</strong> ${filesByType.get('district')!.length} report(s) - ${filesByType.get('district')!.join(', ')}`);
      }
      if (filesByType.has('gender')) {
        reportDetails.push(`<strong>Gender-wise:</strong> ${filesByType.get('gender')!.length} report(s) - ${filesByType.get('gender')!.join(', ')}`);
      }
      if (filesByType.has('field_officer')) {
        reportDetails.push(`<strong>Field Officer-wise:</strong> ${filesByType.get('field_officer')!.length} report(s) - ${filesByType.get('field_officer')!.slice(0, 5).join(', ')}${filesByType.get('field_officer')!.length > 5 ? ` and ${filesByType.get('field_officer')!.length - 5} more` : ''}`);
      }
      if (filesByType.has('udid')) {
        reportDetails.push(`<strong>UDID status-wise:</strong> ${filesByType.get('udid')!.length} report(s) - ${filesByType.get('udid')!.join(', ')}`);
      }

      // Email each admin
      const emailPromises = admins.map(async (admin: any) => {
        const emailBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e3a8a; border-bottom: 3px solid #1e3a8a; padding-bottom: 10px;">
              DDRC Survey Reports - ${dateStr}
            </h2>
            <p style="color: #333; line-height: 1.6;">
              Dear ${admin.name || 'Admin'},
            </p>
            <p style="color: #333; line-height: 1.6;">
              Please find attached all filtered survey reports generated on ${dateStr}.
            </p>
            <div style="background: #e3f2fd; padding: 15px; border-left: 4px solid #2196F3; border-radius: 4px; margin: 20px 0;">
              <h3 style="color: #1976D2; margin-top: 0;">📎 Report Summary</h3>
              <p style="margin: 10px 0; color: #333;">
                <strong>Total Files:</strong> ${attachments.length} files (${reportData.files.length} PDF + ${reportData.files.length} Excel)
              </p>
              <p style="margin: 10px 0; color: #333;">
                <strong>Report Types:</strong> 7 filter categories
              </p>
              <div style="margin-top: 15px; padding: 10px; background: white; border-radius: 4px;">
                <h4 style="color: #1976D2; margin-top: 0; font-size: 14px;">Filter Categories Included:</h4>
                <ul style="color: #555; line-height: 1.8; margin: 0; padding-left: 20px;">
                  ${reportDetails.map(detail => `<li style="margin-bottom: 8px;">${detail}</li>`).join('')}
                </ul>
              </div>
              <p style="margin: 15px 0 0 0; color: #666; font-size: 13px;">
                <strong>File Naming Format:</strong> FilterType-Value-YYYY-MM-DD.pdf/xlsx<br/>
                <em>Example:</em> Source-Field-Officer-App-2026-01-08.pdf
              </p>
            </div>
            <div style="background: #fff3cd; padding: 12px; border-left: 4px solid #ffc107; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; color: #856404; font-size: 13px;">
                <strong>Note:</strong> Each filter value has both PDF and Excel versions. PDF files are elegantly formatted for viewing, while Excel files are optimized for data analysis.
              </p>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This is an automated report from the DDRC Survey System.
            </p>
          </div>
        `;

        return sendEmailAndLog({
          recipientType: 'admin',
          recipientEmail: admin.email,
          recipientUserId: admin.id,
          emailSubject: `DDRC Survey Reports - ${dateStr}`,
          emailBody,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
      });

      const results = await Promise.allSettled(emailPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failedCount = results.length - successCount;

      Logger.info('EXPORT_REPORTS_EMAILED', {
        total_admins: admins.length,
        success: successCount,
        failed: failedCount,
        report_date: reportData.report_date,
      });

      return NextResponse.json({
        ok: true,
        message: `Reports generated and emailed to ${successCount} admin user(s)`,
        summary: {
          total_admins: admins.length,
          emails_sent: successCount,
          emails_failed: failedCount,
          total_files: attachments.length,
        },
        report_date: reportData.report_date,
      });

    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('EXPORT_REPORTS_EMAIL_ERROR', {
      error: error?.message || String(error),
      stack: error?.stack,
    });
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to generate and email reports',
      },
      { status: 500 }
    );
  }
}

