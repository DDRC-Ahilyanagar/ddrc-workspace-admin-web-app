import nodemailer from 'nodemailer';
import { getDbPool } from './db';
import fs from 'fs';

// Email configuration for Hostinger shared hosting
// Using port 465 with SSL (secure: true) as recommended by Hostinger
function getEmailConfig() {
  const smtpUser = process.env.SMTP_USER || 'support@ddrcnagar.in';
  const smtpPassword = process.env.SMTP_PASSWORD || 'Uegshle@1989!';
  const smtpHost = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465');
  const smtpSecure = process.env.SMTP_SECURE !== 'false'; // Default to true for port 465

  const config: any = {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    // For Hostinger, we need to handle self-signed certificates
    tls: {
      rejectUnauthorized: false, // Allow self-signed certificates
    },
    // Additional options for better compatibility
    connectionTimeout: 30000, // 30 seconds
    greetingTimeout: 30000,
    socketTimeout: 30000,
  };

  return config;
}

// Create transporter function to ensure fresh config each time
function createTransporter() {
  const config = getEmailConfig();
  return nodemailer.createTransport(config);
}

// Create reusable transporter
const transporter = createTransporter();

export interface EmailAttachment {
  filename: string;
  path: string;
  contentType?: string;
}

export interface EmailLogData {
  recipientType: 'admin' | 'field_officer';
  recipientEmail: string;
  recipientUserId?: number | null;
  emailSubject: string;
  emailBody: string;
  attachments?: EmailAttachment[];
}

/**
 * Send email and log it to database
 */
export async function sendEmailAndLog(data: EmailLogData): Promise<{ success: boolean; error?: string }> {
  const pool = getDbPool();
  let logId: number | null = null;

  try {
    // First, create log entry with 'pending' status
    const [logResult]: any = await pool.query(
      `INSERT INTO email_logs 
       (recipient_type, recipient_email, recipient_user_id, email_subject, email_body, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        data.recipientType,
        data.recipientEmail,
        data.recipientUserId || null,
        data.emailSubject,
        data.emailBody,
      ]
    );
    logId = logResult?.insertId || null;

    // Prepare attachments if provided
    const attachments = data.attachments?.map((att) => {
      // Check if file exists
      if (!fs.existsSync(att.path)) {
        console.warn(`[email-service] Attachment file not found: ${att.path}`);
        return null;
      }
      return {
        filename: att.filename,
        path: att.path,
        contentType: att.contentType,
      };
    }).filter(Boolean) || [];

    // Get fresh config to ensure credentials are up to date
    const config = getEmailConfig();
    
    // Create a fresh transporter for each email to ensure credentials are current
    const emailTransporter = createTransporter();

    // Send email
    const mailOptions: any = {
      from: `"DDRC Survey System" <${config.auth.user}>`,
      to: data.recipientEmail,
      subject: data.emailSubject,
      html: data.emailBody,
    };

    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await emailTransporter.sendMail(mailOptions);

    // Update log entry to 'sent'
    if (logId) {
      await pool.query(
        `UPDATE email_logs 
         SET status = 'sent', sent_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [logId]
      );
    }

    return { success: true };
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    
    // Update log entry to 'failed'
    if (logId) {
      await pool.query(
        `UPDATE email_logs 
         SET status = 'failed', error_message = ?, updated_at = NOW()
         WHERE id = ?`,
        [errorMessage, logId]
      );
    } else {
      // If log entry creation failed, try to create one with failed status
      try {
        await pool.query(
          `INSERT INTO email_logs 
           (recipient_type, recipient_email, recipient_user_id, email_subject, email_body, status, error_message, created_at)
           VALUES (?, ?, ?, ?, ?, 'failed', ?, NOW())`,
          [
            data.recipientType,
            data.recipientEmail,
            data.recipientUserId || null,
            data.emailSubject,
            data.emailBody,
            errorMessage,
          ]
        );
      } catch (logError) {
        console.error('Failed to log email error:', logError);
      }
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Verify email configuration
 */
export async function verifyEmailConfig(): Promise<{ success: boolean; error?: string }> {
  try {
    const testTransporter = createTransporter();
    await testTransporter.verify();
    return { success: true };
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error('[email-service] Email configuration verification failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

