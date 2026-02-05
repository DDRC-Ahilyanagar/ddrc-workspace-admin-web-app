import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { sendSMS, buildDLTMessage } from '@/lib/sms';
import { CONFIG } from '@/lib/config';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, email } = body;

        if (!phone || !/^\d{10}$/.test(phone)) {
            return NextResponse.json({ ok: false, error: 'वैध १० अंकी मोबाईल क्रमांक आवश्यक आहे' }, { status: 400 });
        }

        const pool = getDbPool();
        const connection = await Promise.race([
            pool.getConnection(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Database connection timeout')), 10000)
            )
        ]) as any;

        try {
            // Check for duplicates
            const [existingUsers]: any = await connection.execute(
                'SELECT id FROM users WHERE contact_number = ? LIMIT 1',
                [phone]
            );

            if (Array.isArray(existingUsers) && existingUsers.length > 0) {
                return NextResponse.json({ ok: false, error: 'हा मोबाईल क्रमांक आधीच नोंदणीकृत आहे' }, { status: 400 });
            }

            const [existingRequests]: any = await connection.execute(
                'SELECT id FROM access_requests WHERE phone = ? AND status IN ("pending", "approved") LIMIT 1',
                [phone]
            );

            if (Array.isArray(existingRequests) && existingRequests.length > 0) {
                return NextResponse.json({ ok: false, error: 'या मोबाईल क्रमांकासाठी आधीच विनंती प्रलंबित किंवा मंजूर आहे' }, { status: 400 });
            }

            // Generate 6-digit OTP
            const otp = String(Math.floor(100000 + Math.random() * 900000));
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + (CONFIG.OTP_EXPIRY_MINUTES || 10));

            // Store OTP
            await connection.execute(
                `INSERT INTO otp_verifications (phone, otp, expires_at, status, created_at, updated_at) 
                 VALUES (?, ?, ?, 'sent', NOW(), NOW())`,
                [phone, otp, expiresAt]
            );

            // Send SMS
            const message = buildDLTMessage(otp, 'registration');
            const smsResult = await sendSMS(phone, message);

            Logger.info('SIGNUP_OTP_SENT', { phone, otp_sent: smsResult.ok });

            return NextResponse.json({ ok: true, message: 'OTP पाठवण्यात आला आहे' });
        } finally {
            connection.release();
        }
    } catch (error: any) {
        Logger.error('SIGNUP_SEND_OTP_ERROR', { error: error.message, stack: error.stack });
        return NextResponse.json({
            ok: false,
            error: error.message?.includes('timeout')
                ? 'Server is busy. Please try again after a few moments.'
                : 'OTP पाठवताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.'
        }, { status: 500 });
    }
}
