import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

const ALLOWED_ADMIN_PHONE = '7768068585';

// Helper to serialize BigInt
const serialize = (data: any) => {
    return JSON.parse(
        JSON.stringify(data, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        )
    );
};

export async function POST(req: NextRequest) {
    try {
        // Optional: Only allow authenticated users to post logs
        const { user } = await verifyAuth(req);
        // If we want any authenticated user to send logs, we keep it simple
        // if (!user) { return NextResponse.json({ error: 'Auth required' }, { status: 401 }); }

        const body = await req.json();
        const { sessionId, level, message, details, stage } = body;

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const log = await prisma.appLog.create({
            data: {
                sessionId,
                level: level || 'info',
                message,
                details: details || {},
                stage,
            },
        });

        return NextResponse.json({ success: true, log: serialize(log) });
    } catch (error: any) {
        console.error('Error creating log:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { user, error } = await verifyAuth(req);

        if (!user || user.phone !== ALLOWED_ADMIN_PHONE) {
            return NextResponse.json({
                success: false,
                error: 'Access denied. Only authorized administrators can view live logs.'
            }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '100');
        const sessionId = searchParams.get('sessionId');

        const logs = await prisma.appLog.findMany({
            where: sessionId ? { sessionId } : {},
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        return NextResponse.json({ success: true, logs: serialize(logs) });
    } catch (error: any) {
        console.error('Error fetching logs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
