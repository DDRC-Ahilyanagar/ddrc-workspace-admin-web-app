import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

const mimeMap: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
};

const getContentType = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return mimeMap[ext] || 'application/octet-stream';
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  const segments = params.path?.filter(Boolean) || [];
  if (segments.length === 0) {
    return NextResponse.json({ ok: false, error: 'File not specified' }, { status: 400 });
  }

  try {
    const uploadsRoot = path.join(process.cwd(), 'public', 'uploads');
    const resolvedPath = path.join(uploadsRoot, ...segments);

    if (!resolvedPath.startsWith(uploadsRoot)) {
      return NextResponse.json({ ok: false, error: 'Invalid path' }, { status: 400 });
    }

    await stat(resolvedPath);
    const fileBuffer = await readFile(resolvedPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': getContentType(segments[segments.length - 1]),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'File not found' }, { status: 404 });
  }
}

