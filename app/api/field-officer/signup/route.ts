import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { sendSMS, getFieldOfficerSignupTemplate } from '@/lib/sms';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, phone, email, userType } = body;

        // 1. Validation
        if (!name || !name.trim()) {
            return NextResponse.json({ ok: false, error: 'नाव भरणे बंधनकारक आहे' }, { status: 400 });
        }
        if (!phone || !phone.trim() || !/^\d{10}$/.test(phone.trim())) {
            return NextResponse.json({ ok: false, error: 'वैध १० अंकी मोबाईल क्रमांक आवश्यक आहे' }, { status: 400 });
        }
        if (!userType || !['FIELD_OFFICER', 'VERIFICATION_OFFICER'].includes(userType)) {
            return NextResponse.json({ ok: false, error: 'वैध वापरकर्ता प्रकार निवडा' }, { status: 400 });
        }

        const cleanPhone = phone.trim();
        const cleanEmail = email?.trim() || null;

        const pool = getDbPool();
        const connection = await pool.getConnection();

        try {

            // 2. Check for duplicate mobile/email in users table
            const [existingUsers]: any = await connection.execute(
                'SELECT id FROM users WHERE contact_number = ? OR (email IS NOT NULL AND email = ?) LIMIT 1',
                [cleanPhone, cleanEmail]
            );

            if (Array.isArray(existingUsers) && existingUsers.length > 0) {
                return NextResponse.json({ ok: false, error: 'हा मोबाईल क्रमांक किंवा ईमेल आधीच नोंदणीकृत आहे' }, { status: 400 });
            }

            // 3. Check for duplicate mobile/email in access_requests table (pending/approved)
            const [existingRequests]: any = await connection.execute(
                'SELECT id FROM access_requests WHERE (phone = ? OR (email IS NOT NULL AND email = ?)) AND status IN ("pending", "approved") LIMIT 1',
                [cleanPhone, cleanEmail]
            );

            if (Array.isArray(existingRequests) && existingRequests.length > 0) {
                return NextResponse.json({ ok: false, error: 'या मोबाईल क्रमांकासाठी आधीच विनंती प्रलंबित किंवा मंजूर आहे' }, { status: 400 });
            }

            // 4. Create Access Request
            const [result]: any = await connection.execute(
                `INSERT INTO access_requests (name, phone, email, user_type, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'pending', NOW(), NOW())`,
                [name.trim(), cleanPhone, cleanEmail, userType]
            );

            Logger.info('FIELD_OFFICER_SIGNUP_REQUEST_CREATED', {
                name,
                phone: cleanPhone,
                email: cleanEmail,
                id: result.insertId
            });

            // 5. Send Success SMS
            const smsMessage = getFieldOfficerSignupTemplate();
            await sendSMS(cleanPhone, smsMessage);

            return NextResponse.json({ ok: true, message: 'नोंदणी यशस्वी झाली. Admin मंजुरीची प्रतीक्षा करा.' });
        } finally {
            connection.release();
        }

    } catch (error: any) {
        console.error('Field Officer Signup Error:', error);
        Logger.error('FIELD_OFFICER_SIGNUP_ERROR', { error: error.message });
        return NextResponse.json({ ok: false, error: 'नोंदणी दरम्यान त्रुटी आली' }, { status: 500 });
    }
}
