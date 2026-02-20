import { NextRequest, NextResponse } from 'next/server';
import { dbQueryOne } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sectionId = parseInt(searchParams.get('section_id') || '0');

    if (sectionId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid section_id' },
        { status: 400 }
      );
    }

    const section = await dbQueryOne(
      'SELECT name FROM sections WHERE id = ? LIMIT 1',
      [sectionId]
    );

    if (!section) {
      return NextResponse.json(
        { ok: false, error: 'Section not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, name: (section as any).name });
  } catch (error: any) {
    Logger.error('get_section_name_fail', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}


