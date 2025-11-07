import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

import { Logger } from '@/lib/logger';
import { getDbPool } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const name = formData.get('name')?.toString().trim() ?? '';
    const phone = formData.get('phone')?.toString().trim() ?? '';
    const selfie = formData.get('selfie') as File | null;

    if (!name || name.length < 3) {
      return NextResponse.json({ ok: false, error: 'नाव आवश्यक आहे' }, { status: 400 });
    }

    if (!phone || phone.length < 10) {
      return NextResponse.json({ ok: false, error: 'मोबाईल क्रमांक आवश्यक आहे' }, { status: 400 });
    }

    if (!selfie) {
      return NextResponse.json({ ok: false, error: 'सेल्फी आवश्यक आहे' }, { status: 400 });
    }

    const selfieBytes = Buffer.from(await selfie.arrayBuffer());
    if (selfieBytes.length === 0) {
      return NextResponse.json({ ok: false, error: 'अवैध फाईल' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'access_requests');
    await mkdir(uploadsDir, { recursive: true });

    const extension = (selfie.name.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const filePath = path.join(uploadsDir, fileName);

    await writeFile(filePath, selfieBytes);

    const relativeUrl = `/uploads/access_requests/${fileName}`;

    const pool = getDbPool();

    const [existing]: any = await pool.query(
      'SELECT id FROM access_requests WHERE phone = ? AND status = "pending" LIMIT 1',
      [phone]
    );

    if (Array.isArray(existing) && existing.length > 0) {
      const first = existing[0];
      Logger.info('ACCESS_REQUEST_DUPLICATE', { phone, existing_id: first.id });
      return NextResponse.json(
        { ok: false, error: 'या मोबाईल क्रमांकाची विनंती आधीपासून प्रलंबित आहे' },
        { status: 409 }
      );
    }

    const [result]: any = await pool.query(
      `INSERT INTO access_requests (name, phone, selfie_url, status)
       VALUES (?, ?, ?, 'pending')`,
      [name, phone, relativeUrl]
    );

    Logger.info('ACCESS_REQUEST_CREATED', {
      id: result?.insertId,
      name,
      phone,
      selfie_url: relativeUrl,
    });

    return NextResponse.json({ ok: true, id: result?.insertId, selfie_url: relativeUrl });
  } catch (error: any) {
    Logger.error('ACCESS_REQUEST_CREATE_ERROR', { error: error?.message, stack: error?.stack });
    return NextResponse.json({ ok: false, error: 'विनंती प्रक्रिया करता आली नाही' }, { status: 500 });
  }
}


