import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

import { requireAuth } from '@/lib/auth';
import { Logger } from '@/lib/logger';

const MEDIA_ROOT = path.join(process.cwd(), 'media_backups');

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

    const savedFiles: string[] = [];
    for (let idx = 0; idx < files.length; idx++) {
      const entry = files[idx];
      if (!(entry instanceof File)) {
        continue;
      }

      const arrayBuffer = await entry.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const originalName = entry.name || `upload_${Date.now()}_${idx}`;
      const safeName = `${Date.now()}_${idx}_${sanitizeFileName(originalName)}`;
      const filePath = path.join(targetDir, safeName);

      await fs.writeFile(filePath, buffer);
      savedFiles.push(safeName);
    }

    Logger.info('MEDIA_BACKUP_SUCCESS', {
      user_id: user.id,
      folder_name: folderName,
      saved: savedFiles.length,
    });

    return NextResponse.json({
      ok: true,
      folder: folderName,
      saved: savedFiles.length,
      files: savedFiles,
    });
  } catch (error) {
    Logger.error('MEDIA_BACKUP_ERROR', { error });
    return NextResponse.json(
      { ok: false, error: 'फाइल अपलोड करण्यात अडचण आली' },
      { status: 500 },
    );
  }
});

