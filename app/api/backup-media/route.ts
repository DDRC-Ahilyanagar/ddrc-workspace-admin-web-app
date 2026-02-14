import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

import { requireAuth } from '@/lib/auth';
import { Logger } from '@/lib/logger';

const MEDIA_ROOT = process.env.MEDIA_BACKUP_DIR || path.join(process.cwd(), 'public', 'uploads');

const sanitizeName = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 120) || 'backup';

const sanitizeFileName = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9_\-.]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 120) || `file_${Date.now()}`;

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

// GET endpoint to check existing files in a folder
export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const folderNameRaw = searchParams.get('folder_name');

    if (!folderNameRaw || typeof folderNameRaw !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'folder_name आवश्यक आहे' },
        { status: 400 },
      );
    }

    const folderName = sanitizeName(folderNameRaw);
    const targetDir = path.join(MEDIA_ROOT, folderName);

    try {
      const files = await fs.readdir(targetDir);
      // Filter only image files
      const imageFiles = files.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext);
      });

      return NextResponse.json({
        ok: true,
        folder: folderName,
        existing_files: imageFiles,
        count: imageFiles.length,
      });
    } catch (err: any) {
      // Folder doesn't exist yet, return empty list
      if (err.code === 'ENOENT') {
        return NextResponse.json({
          ok: true,
          folder: folderName,
          existing_files: [],
          count: 0,
        });
      }
      throw err;
    }
  } catch (error) {
    Logger.error('MEDIA_BACKUP_CHECK_ERROR', { error });
    return NextResponse.json(
      { ok: false, error: 'फाइल तपासण्यात अडचण आली' },
      { status: 500 },
    );
  }
});

export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const formData = await request.formData();
    const folderNameRaw = formData.get('folder_name');

    if (!folderNameRaw || typeof folderNameRaw !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'folder_name आवश्यक आहे' },
        { status: 400 },
      );
    }

    const folderName = sanitizeName(folderNameRaw);
    const files = formData.getAll('files');

    if (!files.length) {
      return NextResponse.json(
        { ok: false, error: 'किमान एक फाइल आवश्यक आहे' },
        { status: 400 },
      );
    }

    const targetDir = path.join(MEDIA_ROOT, folderName);
    await fs.mkdir(targetDir, { recursive: true });

    // Get existing files to avoid duplicates
    let existingFiles: string[] = [];
    try {
      const existing = await fs.readdir(targetDir);
      existingFiles = existing.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext);
      });
    } catch {
      // Folder doesn't exist yet, that's fine
      existingFiles = [];
    }

    const savedFiles: string[] = [];
    const skippedFiles: string[] = [];

    for (let idx = 0; idx < files.length; idx++) {
      const entry = files[idx];
      if (!(entry instanceof File)) {
        continue;
      }

      const originalName = entry.name || `upload_${Date.now()}_${idx}`;
      const safeName = `${Date.now()}_${idx}_${sanitizeFileName(originalName)}`;
      const filePath = path.join(targetDir, safeName);

      // Check if file with same name already exists
      // We check by comparing the original filename (without timestamp prefix)
      // Extract original filename from safeName (after timestamp and index)
      const originalNameFromSafe = safeName.split('_').slice(2).join('_');
      const alreadyExists = existingFiles.some((existingFile) => {
        const existingOriginal = existingFile.split('_').slice(2).join('_');
        return existingOriginal === originalNameFromSafe;
      });

      if (alreadyExists) {
        skippedFiles.push(safeName);
        continue;
      }

      // Also check if exact filename already exists
      if (existingFiles.includes(safeName)) {
        skippedFiles.push(safeName);
        continue;
      }

      const arrayBuffer = await entry.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await fs.writeFile(filePath, buffer);
      savedFiles.push(safeName);
    }

    Logger.info('MEDIA_BACKUP_SUCCESS', {
      user_id: user.id,
      folder_name: folderName,
      saved: savedFiles.length,
      skipped: skippedFiles.length,
    });

    return NextResponse.json({
      ok: true,
      folder: folderName,
      saved: savedFiles.length,
      skipped: skippedFiles.length,
      files: savedFiles,
      skipped_files: skippedFiles,
    });
  } catch (error) {
    Logger.error('MEDIA_BACKUP_ERROR', { error });
    return NextResponse.json(
      { ok: false, error: 'फाइल अपलोड करण्यात अडचण आली' },
      { status: 500 },
    );
  }
});

