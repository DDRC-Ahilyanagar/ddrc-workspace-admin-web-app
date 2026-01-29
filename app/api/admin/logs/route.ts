import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { user, error } = await verifyAuth(request);

    if (!user || user.phone !== '7768068585') {
        return NextResponse.json(
            { ok: false, error: 'Unauthorized access' },
            { status: 403 }
        );
    }

    try {
        const logPath = path.join(process.cwd(), 'storage', 'logs', 'ddrc_api.log');

        if (!fs.existsSync(logPath)) {
            return NextResponse.json({ ok: true, logs: [] });
        }

        // Read the last ~50KB of the file to be efficient with 130MB+ file
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
