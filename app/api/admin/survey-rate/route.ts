import { NextRequest, NextResponse } from 'next/server';
import { dbQueryOne } from '@/lib/db';
import { Logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
    try {
        // Fetch rate from settings table or return a default
        // Assuming a 'system_settings' table
        const row = await dbQueryOne<{ setting_value: string }>(
            "SELECT setting_value FROM system_settings WHERE setting_key = 'survey_rate_per_completion' LIMIT 1"
        );

        let rate = 50.0; // Default fallback
        if (row && row.setting_value) {
            rate = parseFloat(row.setting_value) || 50.0;
        }

        return NextResponse.json({ ok: true, rate });
    } catch (e: any) {
        Logger.error('fetch_survey_rate_failed', { error: e?.message });
        // Fallback to default if DB fails
        return NextResponse.json({ ok: true, rate: 50.0 });
    }
}
