import nodemailer from 'nodemailer';
import { getDbPool } from './db';

// Email configuration from environment variables
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASSWORD || '',
  },
};

// Create reusable transporter
const transporter = nodemailer.createTransport(emailConfig);

export interface EmailLogData {
  recipientType: 'admin' | 'field_officer';
  recipientEmail: string;
  recipientUserId?: number | null;
  emailSubject: string;
  emailBody: string;
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

    // Send email
    const mailOptions = {
      from: `"DDRC Survey System" <${emailConfig.auth.user}>`,
      to: data.recipientEmail,
      subject: data.emailSubject,
      html: data.emailBody,
    };

    const info = await transporter.sendMail(mailOptions);

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
export async function verifyEmailConfig(): Promise<boolean> {
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Email configuration verification failed:', error);
    return false;
  }
}

