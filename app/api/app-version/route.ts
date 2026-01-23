import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const platform = (searchParams.get('platform') || 'android').toString().toLowerCase();

        const pool = getDbPool();
        const [rows] = await pool.query(
            `SELECT latest_version, build_number, force_update, title, message, store_url 
       FROM app_versions 
       WHERE platform = ? 
       ORDER BY id DESC LIMIT 1`,
            [platform]
        );

        const version = Array.isArray(rows) && rows.length > 0 ? (rows as any[])[0] : null;

        if (!version) {
            // Default fallback if no version record exists
            return NextResponse.json({
                ok: true,
                data: {
                    latest_version: '1.0.0',
                    build_number: 1,
                    force_update: 0,
                    title: 'Update Available',
                    message: 'A new version is available.',
                    store_url: '',
                },
            });
        }

        return NextResponse.json({
            ok: true,
            data: {
                latest_version: version.latest_version,
                build_number: version.build_number,
                force_update: version.force_update === 1, // Ensure boolean
                title: version.title,
                message: version.message,
                store_url: version.store_url,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
