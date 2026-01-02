import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { sendEmailAndLog } from '@/lib/email-service';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to send daily stats reports via email
 * Called by scheduled job every 24 hours at 8 PM
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization check
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.DAILY_STATS_API_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Get all admin emails
      const [adminRows]: any = await conn.query(
        `SELECT id, name, email 
         FROM users 
         WHERE user_type = 'admin' 
           AND email IS NOT NULL 
           AND email != '' 
           AND (status = 'active' OR is_active = 1)
         ORDER BY id`
      );
      const admins = Array.isArray(adminRows) ? adminRows : [];

      // Get all field officers with their stats
      const [officerRows]: any = await conn.query(
        `SELECT 
           u.id,
           u.name,
           u.email,
           COALESCE(u.name, u.contact_number, CONCAT('User ', u.id)) AS officer_name,
           COUNT(DISTINCT CASE WHEN s.no_of_questions_unanswered = 0 THEN s.id END) AS completed_surveys,
           COUNT(DISTINCT CASE WHEN s.no_of_questions_unanswered > 0 THEN s.id END) AS pending_surveys,
           COUNT(DISTINCT s.id) AS total_surveys
         FROM users u
         LEFT JOIN user_types ut ON ut.id = u.user_type_id
         LEFT JOIN surveys s ON s.user_id = u.id
         WHERE (
           LOWER(COALESCE(NULLIF(u.user_type, ''), ut.user_type, '')) IN ('field_officer', 'field officer', 'officer')
         )
         AND (u.status = 'active' OR u.is_active = 1 OR u.status IS NULL)
         AND u.email IS NOT NULL 
         AND u.email != ''
         GROUP BY u.id, u.name, u.email, u.contact_number
         ORDER BY u.name`
      );
      const officers = Array.isArray(officerRows) ? officerRows : [];

      // Get overall stats
      const [totalStats]: any = await conn.query(
        `SELECT 
           COUNT(DISTINCT s.id) AS total_surveys,
           COUNT(DISTINCT CASE WHEN s.no_of_questions_unanswered = 0 THEN s.id END) AS completed_surveys,
           COUNT(DISTINCT CASE WHEN s.no_of_questions_unanswered > 0 THEN s.id END) AS pending_surveys,
           COUNT(DISTINCT u.id) AS total_field_officers
         FROM surveys s
         LEFT JOIN users u ON s.user_id = u.id
         LEFT JOIN user_types ut ON ut.id = u.user_type_id
         WHERE (
           LOWER(COALESCE(NULLIF(u.user_type, ''), ut.user_type, '')) IN ('field_officer', 'field officer', 'officer')
           OR s.source = 'Divyang Self'
         )`
      );
      const stats = Array.isArray(totalStats) && totalStats.length > 0 ? totalStats[0] : {
        total_surveys: 0,
        completed_surveys: 0,
        pending_surveys: 0,
        total_field_officers: 0,
      };

      const dateStr = new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Send email to each admin with all stats
      const adminEmailPromises = admins.map(async (admin: any) => {
        const adminEmailBody = generateAdminEmailBody(stats, officers, dateStr);
        return sendEmailAndLog({
          recipientType: 'admin',
          recipientEmail: admin.email,
          recipientUserId: admin.id,
          emailSubject: `DDRC Survey Daily Report - ${dateStr}`,
          emailBody: adminEmailBody,
        });
      });

      // Send email to each field officer with their own stats
      const officerEmailPromises = officers.map(async (officer: any) => {
        const officerEmailBody = generateOfficerEmailBody(officer, dateStr);
        return sendEmailAndLog({
          recipientType: 'field_officer',
          recipientEmail: officer.email,
          recipientUserId: officer.id,
          emailSubject: `DDRC Survey Daily Report - ${dateStr}`,
          emailBody: officerEmailBody,
        });
      });

      // Wait for all emails to be sent
      const adminResults = await Promise.allSettled(adminEmailPromises);
      const officerResults = await Promise.allSettled(officerEmailPromises);

      const adminSuccess = adminResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const adminFailed = adminResults.length - adminSuccess;
      const officerSuccess = officerResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const officerFailed = officerResults.length - officerSuccess;

      Logger.info('DAILY_STATS_EMAIL_SENT', {
        admin_sent: adminSuccess,
        admin_failed: adminFailed,
        officer_sent: officerSuccess,
        officer_failed: officerFailed,
        total_admins: admins.length,
        total_officers: officers.length,
      });

      return NextResponse.json({
        ok: true,
        message: 'Daily stats emails sent',
        summary: {
          admins: { total: admins.length, sent: adminSuccess, failed: adminFailed },
          officers: { total: officers.length, sent: officerSuccess, failed: officerFailed },
        },
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('DAILY_STATS_EMAIL_ERROR', { error: error?.message || String(error) });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to send daily stats emails' },
      { status: 500 }
    );
  }
}

/**
 * Generate HTML email body for admin
 */
function generateAdminEmailBody(stats: any, officers: any[], dateStr: string): string {
  const totalSurveys = Number(stats.total_surveys || 0);
  const completedSurveys = Number(stats.completed_surveys || 0);
  const pendingSurveys = Number(stats.pending_surveys || 0);
  const totalOfficers = Number(stats.total_field_officers || 0);

  let officersTable = '';
  if (officers.length > 0) {
    officersTable = `
      <h3 style="color: #1976D2; margin-top: 30px;">Field Officers Performance</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Officer Name</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Completed</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Pending</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${officers.map((officer: any) => `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(officer.officer_name || 'N/A')}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${Number(officer.completed_surveys || 0)}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${Number(officer.pending_surveys || 0)}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${Number(officer.total_surveys || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0D47A1 0%, #1976D2 50%, #42A5F5 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-value { font-size: 32px; font-weight: bold; color: #1976D2; }
        .stat-label { color: #666; margin-top: 5px; }
        table { background: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">DDRC Survey System - Daily Report</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${dateStr}</p>
        </div>
        <div class="content">
          <h2 style="color: #1976D2;">Overall Statistics</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${totalSurveys}</div>
              <div class="stat-label">Total Surveys</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${completedSurveys}</div>
              <div class="stat-label">Completed Surveys</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${pendingSurveys}</div>
              <div class="stat-label">Pending Surveys</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${totalOfficers}</div>
              <div class="stat-label">Active Field Officers</div>
            </div>
          </div>
          ${officersTable}
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            This is an automated daily report from the DDRC Survey System.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML email body for field officer
 */
function generateOfficerEmailBody(officer: any, dateStr: string): string {
  const completed = Number(officer.completed_surveys || 0);
  const pending = Number(officer.pending_surveys || 0);
  const total = Number(officer.total_surveys || 0);
  const officerName = escapeHtml(officer.officer_name || 'Field Officer');

  // Get rate per survey
  const ratePerSurvey = 10; // Default, can be fetched from app_settings if needed

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0D47A1 0%, #1976D2 50%, #42A5F5 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .stat-value { font-size: 36px; font-weight: bold; color: #1976D2; }
        .stat-label { color: #666; margin-top: 8px; }
        .wallet-info { background: #e8f5e9; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #4caf50; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">DDRC Survey System - Daily Report</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${dateStr}</p>
        </div>
        <div class="content">
          <h2 style="color: #1976D2;">Hello ${officerName},</h2>
          <p>Here is your daily survey statistics:</p>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${completed}</div>
              <div class="stat-label">Completed Surveys</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${pending}</div>
              <div class="stat-label">Pending Surveys</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${total}</div>
              <div class="stat-label">Total Surveys</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">₹${(completed * ratePerSurvey).toLocaleString('en-IN')}</div>
              <div class="stat-label">Wallet Balance</div>
            </div>
          </div>
          <div class="wallet-info">
            <strong>Note:</strong> Wallet balance is calculated based on completed surveys (₹${ratePerSurvey} per survey).
          </div>
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            This is an automated daily report from the DDRC Survey System.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

