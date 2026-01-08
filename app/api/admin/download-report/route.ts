import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * Download a report file (PDF or Excel) from storage/reports
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { user, error } = await verifyAuth(request);
    if (!user || error) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only admin can download reports
    const userType = (user?.user_type || '').toLowerCase().trim();
    if (userType !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Only admins can download reports' },
        { status: 403 }
      );
    }

    // Get filename from query params
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('file');

    if (!filename) {
      return NextResponse.json(
        { ok: false, error: 'Filename is required' },
        { status: 400 }
      );
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'storage', 'reports', sanitizedFilename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { ok: false, error: 'File not found' },
        { status: 404 }
      );
    }

    // Determine content type
    const ext = path.extname(sanitizedFilename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.xlsx') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    // Read and return file
    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to download file',
      },
      { status: 500 }
    );
  }
}

