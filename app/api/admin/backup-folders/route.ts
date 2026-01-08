import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import path from 'path';
import { promises as fs } from 'fs';

const MEDIA_ROOT = path.join(process.cwd(), 'media_backups');
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

export const dynamic = 'force-dynamic';

/**
 * Get list of backup folders with images
 * Only accessible to admin user with phone 7768068585
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

    // Only allow admin with phone 7768068585
    const userType = (user?.user_type || '').toLowerCase().trim();
    const userPhone = user?.phone || '';
    
    if (userType !== 'admin' || userPhone !== '7768068585') {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Access restricted to specific admin user' },
        { status: 403 }
      );
    }

    // Check if requesting specific folder images
    const { searchParams } = new URL(request.url);
    const folderName = searchParams.get('folder');
    
    if (folderName) {
      // Return all images for a specific folder
      try {
        const folderPath = path.join(MEDIA_ROOT, decodeURIComponent(folderName));
        const resolvedPath = path.resolve(folderPath);
        const resolvedRoot = path.resolve(MEDIA_ROOT);
        
        // Security check
        if (!resolvedPath.startsWith(resolvedRoot)) {
          return NextResponse.json(
            { ok: false, error: 'Invalid folder path' },
            { status: 403 }
          );
        }

        const files = await fs.readdir(folderPath);
        const images = files
          .filter(file => {
            const ext = path.extname(file).toLowerCase();
            return IMAGE_EXTENSIONS.includes(ext);
          })
          .map(file => ({
            name: file,
            path: `/api/backup-images/${encodeURIComponent(folderName)}/${encodeURIComponent(file)}`,
          }));

        return NextResponse.json({
          ok: true,
          folderImages: images,
          totalImages: images.length,
        });
      } catch (err: any) {
        return NextResponse.json(
          { ok: false, error: 'Folder not found or cannot be accessed' },
          { status: 404 }
        );
      }
    }

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
            // Format: person_name_mobile_no (e.g., Pranit_9561923703)
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
              images: images.slice(0, 10), // Show first 10 images in preview
              totalImages: images.length,
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
      totalFolders: folders.length,
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
}

