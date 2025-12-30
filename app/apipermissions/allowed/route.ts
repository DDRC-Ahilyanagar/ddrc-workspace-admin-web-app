import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    allowed: true,
    permissions: [],
    message: 'apipermissions stub response',
    timestamp: new Date().toISOString(),
  });
}

