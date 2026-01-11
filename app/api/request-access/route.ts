import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

import { Logger } from '@/lib/logger';
import { getDbPool } from '@/lib/db';
import { logSignupStep } from '@/lib/signup-logger';

export const maxDuration = 60; // 60 seconds for file uploads

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  Logger.info('ACCESS_REQUEST_START', { timestamp: new Date().toISOString() });
  
  try {
    Logger.info('ACCESS_REQUEST_PARSING_FORM_DATA');
    const formData = await request.formData();
    Logger.info('ACCESS_REQUEST_FORM_DATA_PARSED', { 
      hasName: formData.has('name'),
      hasPhone: formData.has('phone'),
      hasSelfie: formData.has('selfie'),
    });
    
    const name = formData.get('name')?.toString().trim() ?? '';
    const phone = formData.get('phone')?.toString().trim() ?? '';
    const email = formData.get('email')?.toString().trim() ?? '';
    const selfie = formData.get('selfie') as File | null;
    
    Logger.info('ACCESS_REQUEST_FIELDS_EXTRACTED', { 
      nameLength: name.length,
      phoneLength: phone.length,
      hasSelfie: selfie !== null,
      selfieSize: selfie?.size ?? 0,
    });

    if (!name || name.length < 3) {
      return NextResponse.json({ ok: false, error: 'नाव आवश्यक आहे' }, { status: 400 });
    }

    if (!phone || phone.length < 10) {
      return NextResponse.json({ ok: false, error: 'मोबाईल क्रमांक आवश्यक आहे' }, { status: 400 });
    }

    if (!selfie) {
      return NextResponse.json({ ok: false, error: 'सेल्फी आवश्यक आहे' }, { status: 400 });
    }

    Logger.info('ACCESS_REQUEST_PROCESSING_SELFIE', { selfieName: selfie.name, selfieSize: selfie.size });
    const selfieBytes = Buffer.from(await selfie.arrayBuffer());
    Logger.info('ACCESS_REQUEST_SELFIE_LOADED', { bytesLength: selfieBytes.length });
    
    if (selfieBytes.length === 0) {
      Logger.error('ACCESS_REQUEST_EMPTY_FILE');
      return NextResponse.json({ ok: false, error: 'अवैध फाईल' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'access_requests');
    Logger.info('ACCESS_REQUEST_CREATING_DIR', { uploadsDir });
    await mkdir(uploadsDir, { recursive: true });

    const extension = (selfie.name.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const filePath = path.join(uploadsDir, fileName);

    Logger.info('ACCESS_REQUEST_WRITING_FILE', { filePath, fileSize: selfieBytes.length });
    await writeFile(filePath, selfieBytes);
    Logger.info('ACCESS_REQUEST_FILE_WRITTEN', { filePath });

    const relativeUrl = `/uploads/access_requests/${fileName}`;

    const pool = getDbPool();

    // Check if there's an existing pending request for this phone
    const [existing]: any = await pool.query(
      'SELECT id FROM access_requests WHERE phone = ? AND status = "pending" LIMIT 1',
      [phone]
    );

    let requestId: number;
    let isUpdate = false;

    if (Array.isArray(existing) && existing.length > 0) {
      // Update existing pending request instead of blocking
      const first = existing[0];
      requestId = first.id;
      isUpdate = true;
      
      Logger.info('ACCESS_REQUEST_UPDATING_EXISTING', { phone, existing_id: requestId });
      
      // Update the existing request with new data
      await pool.query(
        `UPDATE access_requests 
         SET name = ?, selfie_url = ?, email = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, relativeUrl, email || null, requestId]
      );
      
      Logger.info('ACCESS_REQUEST_UPDATED', {
        id: requestId,
        name,
        phone,
        selfie_url: relativeUrl,
      });
    } else {
      // Create new request
      const [result]: any = await pool.query(
        `INSERT INTO access_requests (name, phone, selfie_url, status, email)
         VALUES (?, ?, ?, 'pending', ?)`,
        [name, phone, relativeUrl, email || null]
      );
      
      requestId = result?.insertId;
      isUpdate = false;
      
      Logger.info('ACCESS_REQUEST_CREATED', {
        id: requestId,
        name,
        phone,
        selfie_url: relativeUrl,
      });
    }

    const duration = Date.now() - startTime;
      Logger.info('ACCESS_REQUEST_COMPLETED', {
        id: requestId,
        isUpdate,
        duration_ms: duration,
      });

      // Log signup step: Selfie uploaded (Step 1)
      await logSignupStep({
        phone,
        step: 'selfie_uploaded',
        step_number: 1,
        status: 'completed',
        data: { selfie_url: relativeUrl, is_update: isUpdate },
      });

      return NextResponse.json({ 
        ok: true, 
        id: requestId, 
        selfie_url: relativeUrl,
        updated: isUpdate 
      });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    Logger.error('ACCESS_REQUEST_CREATE_ERROR', { 
      error: error?.message, 
      stack: error?.stack,
      duration_ms: duration,
    });
    return NextResponse.json({ ok: false, error: 'विनंती प्रक्रिया करता आली नाही' }, { status: 500 });
  }
}


