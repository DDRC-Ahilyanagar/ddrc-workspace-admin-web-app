import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

const ALLOWED_ADMIN_PHONE = '7768068585';

export async function POST(req: NextRequest) {
    return NextResponse.json({ success: true, log: {} });
    /*
    try {
        const { user } = await verifyAuth(req);
        const body = await req.json();
        const { sessionId, level, message, details, stage } = body;

        // Implementation disabled due to missing Prisma model
        return NextResponse.json({ success: true, log: {} });
    } catch (error: any) {
        console.error('Error creating log:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    */
}

export async function GET(req: NextRequest) {
    return NextResponse.json({ success: true, logs: [] });
    /*
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

        // Implementation disabled due to missing Prisma model
        return NextResponse.json({ success: true, logs: [] });
    } catch (error: any) {
        console.error('Error fetching logs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    */
}
