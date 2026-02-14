import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { verifyAuth } from '@/lib/auth';
import { promises as fs } from 'fs';

const MEDIA_ROOT = process.env.MEDIA_BACKUP_DIR || path.join(process.cwd(), 'public', 'uploads');
const API_KEY = process.env.BACKUP_API_KEY || '';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

// Simple API key check (optional - remove if you want it fully public)
const checkApiKey = (request: NextRequest): boolean => {
  if (!API_KEY) return true; // No API key set, allow access
  const providedKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('api_key');
  return providedKey === API_KEY;
};

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) => {
  // Check authentication
  const { user } = await verifyAuth(request);
  const userType = (user?.user_type || '').toLowerCase().trim();
  const userPhone = user?.phone || '';

  const isSuperAdmin = userType === 'admin' && userPhone === '7768068585';

  if (!isSuperAdmin && !checkApiKey(request)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  try {
    const { path: pathArray } = await params;

    // Reconstruct the file path
    const filePath = path.join(MEDIA_ROOT, ...pathArray.map(p => decodeURIComponent(p)));

    // Security: Ensure the path is within mediaRoot
    const resolvedPath = path.resolve(filePath);
    const resolvedRoot = path.resolve(MEDIA_ROOT);

    if (!resolvedPath.startsWith(resolvedRoot)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid path' },
        { status: 403 }
      );
    }

    // Check if file exists
    try {
      await fs.access(resolvedPath);
    } catch {
      return NextResponse.json(
        { ok: false, error: 'File not found' },
        { status: 404 }
      );
    }

    // Read and return the file
    const fileBuffer = await fs.readFile(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.bmp') contentType = 'image/bmp';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*', // Allow CORS for super admin app
      },
    });
  } catch (error: any) {
    console.error('Error serving image:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to serve image' },
      { status: 500 }
    );
  }
};

