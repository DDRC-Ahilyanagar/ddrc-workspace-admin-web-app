import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

const MEDIA_ROOT = path.join(process.cwd(), 'media_backups');
const API_KEY = process.env.BACKUP_API_KEY || '';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

// Simple API key check (optional - remove if you want it fully public)
const checkApiKey = (request: NextRequest): boolean => {
  if (!API_KEY) return true; // No API key set, allow access
  const providedKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('api_key');
  return providedKey === API_KEY;
};

export const GET = async (request: NextRequest) => {
  // Optional API key check
  if (!checkApiKey(request)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  try {
    // Check if directory exists
    try {
      await fs.access(MEDIA_ROOT);
    } catch {
      return NextResponse.json({
        ok: true,
        folders: [],
        message: 'Media backups directory not found',
      });
    }

    // Read all folders
    const entries = await fs.readdir(MEDIA_ROOT, { withFileTypes: true });
    const folders = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const folderPath = path.join(MEDIA_ROOT, entry.name);
        
        try {
          // Read images in folder
          const files = await fs.readdir(folderPath);
          const images = files
            .filter(file => {
              const ext = path.extname(file).toLowerCase();
              return IMAGE_EXTENSIONS.includes(ext);
            })
            .map(file => ({
              name: file,
              path: `/api/backup-images/${encodeURIComponent(entry.name)}/${encodeURIComponent(file)}`,
            }));

          if (images.length > 0) {
            // Parse folder name to extract officer name and mobile
            // Handle both formats: name_mobile or name-mobile
            let folderParts: string[];
            if (entry.name.includes('-')) {
              folderParts = entry.name.split('-');
            } else {
              folderParts = entry.name.split('_');
            }
            
            // Last part is usually the mobile number
            const mobileNo = folderParts[folderParts.length - 1] || '';
            // Everything before the last part is the officer name
            const separator = entry.name.includes('-') ? '-' : '_';
            const officerName = folderParts.slice(0, -1).join(separator) || entry.name;

            folders.push({
              folderName: entry.name,
              officerName,
              mobileNo,
              imageCount: images.length,
              images,
            });
          }
        } catch (err) {
          // Skip folders that can't be read
          console.error(`Error reading folder ${entry.name}:`, err);
          continue;
        }
      }
    }

    // Sort by folder name
    folders.sort((a, b) => a.folderName.localeCompare(b.folderName));

    return NextResponse.json({
      ok: true,
      folders,
    });
  } catch (error: any) {
    console.error('Error reading backup folders:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Failed to read backup folders',
      },
      { status: 500 }
    );
  }
};

