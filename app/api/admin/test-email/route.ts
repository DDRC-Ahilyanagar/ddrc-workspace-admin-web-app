import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { verifyEmailConfig, sendEmailAndLog } from '@/lib/email-service';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Test email configuration and send a test email
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

    // Only admin can test email
    const userType = (user?.user_type || '').toLowerCase().trim();
    if (userType !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Only admins can test email' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const testEmail = body.email;

    if (!testEmail || typeof testEmail !== 'string' || !testEmail.includes('@')) {
      return NextResponse.json(
        { ok: false, error: 'Valid test email address is required in request body' },
        { status: 400 }
      );
    }

    // First verify SMTP configuration
    Logger.info('TEST_EMAIL_VERIFYING_CONFIG', { testEmail });
    const verifyResult = await verifyEmailConfig();
    
    if (!verifyResult.success) {
      return NextResponse.json({
        ok: false,
        error: `SMTP configuration verification failed: ${verifyResult.error}`,
        verificationError: verifyResult.error,
      }, { status: 500 });
    }

    // Send test email
    Logger.info('TEST_EMAIL_SENDING', { testEmail });
    const emailResult = await sendEmailAndLog({
      recipientType: 'admin',
      recipientEmail: testEmail,
      recipientUserId: user.id,
      emailSubject: 'DDRC Survey System - Test Email',
      emailBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e3a8a; border-bottom: 3px solid #1e3a8a; padding-bottom: 10px;">
            Test Email - DDRC Survey System
          </h2>
          <p style="color: #333; line-height: 1.6;">
            This is a test email from the DDRC Survey System.
          </p>
          <p style="color: #333; line-height: 1.6;">
            If you received this email, your SMTP configuration is working correctly!
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Sent at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          </p>
        </div>
      `,
    });

    if (emailResult.success) {
      Logger.info('TEST_EMAIL_SUCCESS', { testEmail });
      return NextResponse.json({
        ok: true,
        message: `Test email sent successfully to ${testEmail}`,
        verification: verifyResult,
      });
    } else {
      Logger.error('TEST_EMAIL_FAILED', { testEmail, error: emailResult.error });
      return NextResponse.json({
        ok: false,
        error: `Failed to send test email: ${emailResult.error}`,
        verification: verifyResult,
      }, { status: 500 });
    }
  } catch (error: any) {
    Logger.error('TEST_EMAIL_ERROR', {
      error: error?.message || String(error),
      stack: error?.stack,
    });
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to test email configuration',
      },
      { status: 500 }
    );
  }
}

