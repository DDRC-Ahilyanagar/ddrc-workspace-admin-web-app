import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Logger } from '@/lib/logger';

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload image file
 *     tags: [Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: string
 *                 format: binary
 *               user_name:
 *                 type: string
 *               user_phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *                 path:
 *                   type: string
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('files') as File;
    
    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const userName = formData.get('user_name')?.toString() || '';
    const userPhone = formData.get('user_phone')?.toString() || '';

    Logger.info('UPLOAD START', {
      filename: file.name,
      size: file.size,
      type: file.type,
      user_name: userName,
      user_phone: userPhone,
    });

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const uniqueId = randomUUID();
    const fileName = `${uniqueId}.${fileExtension}`;
    
    // For now, we'll return a URL structure (you can implement actual file storage)
    // In production, you might want to use cloud storage (S3, Cloudinary, etc.)
    const uploadBase = process.env.UPLOAD_BASE || 'https://bitnix.store/ddrc-app';
    const url = `${uploadBase}/uploads/${fileName}`;

    // Optionally save file locally (uncomment if you want local storage)
    /*
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    const filePath = join(uploadsDir, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);
    */

    Logger.info('UPLOAD RESP', {
      url,
      filename: fileName,
      status: 200,
    });

    return NextResponse.json({
      ok: true,
      url,
      path: `/uploads/${fileName}`,
    });
  } catch (error: any) {
    Logger.error('UPLOAD ERROR', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

