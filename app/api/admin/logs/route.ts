import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { user, error } = await verifyAuth(request);

    if (!user || user.phone !== '7768068585') {
        return NextResponse.json(
            { ok: false, error: 'Unauthorized access' },
            { status: 403 }
        );
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'admin';

    if (source === 'api') {
        try {
            const res = await fetch('https://surveyapi.ddrcnagar.in/api/admin/logs', {
                headers: { 'Authorization': '7768068585' },
                cache: 'no-store'
            });
            const data = await res.json();
            if (!res.ok) {
                Logger.error('DDRC API Logs Fetch Error', { status: res.status, data });
                return NextResponse.json({ ok: false, error: `API Error (${res.status}): ${data.error || 'Unknown'}` });
            }
            return NextResponse.json(data);
        } catch (err: any) {
            Logger.error('DDRC API Logs Connection Error', { error: err.message, stack: err.stack });
            return NextResponse.json({ ok: false, error: 'Failed to reach DDRC API: ' + err.message });
        }
    }

    if (source === 'python') {
        try {
            const res = await fetch('https://surveymediapython.ddrcnagar.in/admin/logs', {
                headers: { 'Authorization': 'Bearer 7768068585' },
                cache: 'no-store'
            });
            const data = await res.json();
            if (!res.ok) {
                Logger.error('Python Logs Fetch Error', { status: res.status, data });
                return NextResponse.json({ ok: false, error: `Python Error (${res.status}): ${data.error || 'Unknown'}` });
            }
            return NextResponse.json(data);
        } catch (err: any) {
            Logger.error('Python Logs Connection Error', { error: err.message, stack: err.stack });
            return NextResponse.json({ ok: false, error: 'Failed to reach Python Service: ' + err.message });
        }
    }

    try {
        const logPath = path.join(process.cwd(), 'storage', 'logs', 'ddrc_api.log');

        if (!fs.existsSync(logPath)) {
            return NextResponse.json({ ok: true, logs: [] });
        }

        // Read the last ~50KB of the file
        const stats = fs.statSync(logPath);
        const readSize = Math.min(stats.size, 50 * 1024); // 50KB
        const startPos = stats.size - readSize;

        const buffer = Buffer.alloc(readSize);
        const fd = fs.openSync(logPath, 'r');
        fs.readSync(fd, buffer, 0, readSize, startPos);
        fs.closeSync(fd);

        const content = buffer.toString('utf8');
        const lines = content.split('\n').filter(l => l.trim() !== '');
        const lastLines = lines.reverse(); // Newest first

        return NextResponse.json({
            ok: true,
            logs: lastLines
        });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
