import { NextRequest, NextResponse } from 'next/server';
import { sendSMS, getPublicFormCompletionTemplate } from '@/lib/sms';

export async function POST(request: NextRequest) {
    try {
        const { mobile } = await request.json();

        if (!mobile) {
            return NextResponse.json({ ok: false, error: 'Mobile number is required' }, { status: 400 });
        }

        // Generate a random registration number for testing
        const randomReg = `DDRC/TEST/${Math.floor(1000 + Math.random() * 9000)}`;
        const message = getPublicFormCompletionTemplate(randomReg);

        const result = await sendSMS(mobile, message);

        return NextResponse.json({
            ok: result.ok,
            details: result,
            message_preview: message
        });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
