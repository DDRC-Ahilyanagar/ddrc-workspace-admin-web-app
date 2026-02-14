import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';
import { sendSMS, buildFormCompletionMessage } from '@/lib/sms';
// If sendSMS doesn't exist, we should look what lib is used

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, message } = body;

        if (!phone) {
            return NextResponse.json({ ok: false, error: 'Phone number is required' }, { status: 400 });
        }

        // Use the centralized SMS logic
        // isFieldOfficerSubmission = true for this endpoint
        const msg = message || buildFormCompletionMessage(true);

        const result = await sendSMS(phone, msg);

        if (result.ok) {
            Logger.info('sms_sent', { phone, message: msg });
            return NextResponse.json({ ok: true, message: 'SMS sent successfully' });
        } else {
            Logger.error('sms_send_failed_provider', { error: result.error });
            // We return 200/ok even if SMS fails so we don't block the UI, but we log it.
            // Or we can return false. Let's return false to debug.
            return NextResponse.json({ ok: false, error: result.error || 'SMS Provider Failed' });
        }
    } catch (e: any) {
        Logger.error('sms_send_failed', { error: e?.message });
        return NextResponse.json({ ok: false, error: e?.message || 'Failed to send SMS' }, { status: 500 });
    }
}
