import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Logger } from '@/lib/logger';
import { convertFileToWebP, getWebPExtension } from '@/lib/image-utils';

const normalizeBase = (value?: string | null) => {
  if (!value) return undefined;
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const stripApiSuffix = (value?: string | null) => {
  if (!value) return value;
  return value.endsWith('/api') ? value.slice(0, -4) : value;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files').filter((item): item is File => item instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const userName = formData.get('user_name')?.toString() || '';
    const userPhone = formData.get('user_phone')?.toString() || '';

    let folderName = '';
    if (userName && userPhone) {
      folderName = `${userName}_${userPhone}`
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 120);
    }

    const baseDir = join(process.cwd(), 'public', 'uploads');
    const uploadsDir = folderName ? join(baseDir, folderName) : baseDir;

    await mkdir(uploadsDir, { recursive: true });

    const origin = normalizeBase(`${request.nextUrl.protocol}//${request.nextUrl.host}`);
    const publicBase =
      normalizeBase(process.env.UPLOAD_PUBLIC_BASE) ||
      normalizeBase(process.env.NEXT_PUBLIC_SITE_URL) ||
      normalizeBase(stripApiSuffix(process.env.UPLOAD_BASE)) ||
      normalizeBase(stripApiSuffix(process.env.API_BASE)) ||
      normalizeBase(stripApiSuffix(process.env.NEXT_PUBLIC_API_URL)) ||
      origin ||
      '';

    const savedFiles: { url: string; path: string; filename: string; size: number }[] = [];

    for (const file of files) {
      // Convert to WebP
      const webpBuffer = await convertFileToWebP(file, 85);

      const uniqueId = randomUUID();
      const fileName = `${uniqueId}.${getWebPExtension()}`;
      const filePath = join(uploadsDir, fileName);

      await writeFile(filePath, webpBuffer);

      // Always use relative path to avoid localhost issues
      // Frontend/API will convert to absolute URL when needed using getAbsoluteImageUrl
      const relativePath = folderName ? `/uploads/${folderName}/${fileName}` : `/uploads/${fileName}`;
      savedFiles.push({
        url: relativePath, // Return relative path as url for backward compatibility
        path: relativePath, // Primary path (relative)
        filename: fileName,
        size: webpBuffer.length, // Use WebP size
      });
    }

    Logger.info('UPLOAD RESP', {
      count: savedFiles.length,
      files: savedFiles,
      status: 200,
    });

    return NextResponse.json({
      ok: true,
      url: savedFiles[0]?.path, // Return relative path
      path: savedFiles[0]?.path, // Return relative path
      files: savedFiles,
    });
  } catch (error: any) {
    Logger.error('UPLOAD ERROR', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}


