import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import path from 'path';
import { promises as fs } from 'fs';
import { Logger } from '@/lib/logger';

// Set the correct absolute path for the surveys folder on VPS
const MEDIA_ROOT = '/var/www/surveys';
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
        { ok: false, error: 'Unauthorized: Access restricted to super admin' },
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
        // Skip system or internal folders
        if (['access_requests', 'temp', 'cache'].includes(entry.name)) continue;

        // Backup folders should follow the pattern: name_phone or name-phone
        // and usually contain many images, whereas Aadhaar folders have 2 images (front/back)
        const isBackupPattern = entry.name.includes('_') || (entry.name.includes('-') && !/^\d+$/.test(entry.name.split('-').pop() || ''));

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
            // Check if it looks like an Aadhaar folder (exactly 2 images named front/back)
            const isAadharFolder = images.length <= 4 && images.some(img =>
              img.name.toLowerCase().includes('front') ||
              img.name.toLowerCase().includes('back')
            );

            if (isAadharFolder && images.length < 5) {
              // Skip Aadhaar folders in media backup panel
              continue;
            }

            // Parse folder name to extract officer name and mobile
            // Format: person_name_mobile_no (e.g., Pranit_9561923703)
            let folderParts: string[];
            if (entry.name.includes('_')) {
              folderParts = entry.name.split('_');
            } else if (entry.name.includes('-')) {
              folderParts = entry.name.split('-');
            } else {
              folderParts = [entry.name];
            }

            // Last part is usually the mobile number
            const mobileNo = folderParts[folderParts.length - 1] || '';
            // Everything before the last part is the officer name
            const separator = entry.name.includes('_') ? '_' : (entry.name.includes('-') ? '-' : ' ');
            const officerName = folderParts.length > 1
              ? folderParts.slice(0, -1).join(separator)
              : entry.name;

            folders.push({
              folderName: entry.name,
              officerName: officerName.replace(/_/g, ' '),
              mobileNo,
              imageCount: images.length,
              images: images.slice(0, 10), // Show first 10 images in preview
              totalImages: images.length,
            });
          }
        } catch (err: any) {
          // Skip folders that can't be read
          Logger.error(`Error reading backup folder ${entry.name}:`, { error: err.message });
          continue;
        }
      }
    }

    // Sort by image count (descending) so active backups show first, then by name
    folders.sort((a, b) => {
      if (b.imageCount !== a.imageCount) {
        return b.imageCount - a.imageCount;
      }
      return a.officerName.localeCompare(b.officerName);
    });

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

/**
 * DELETE backup folder or individual image
 * Query params:
 * - folder: folder name (required)
 * - image: image filename (optional, if provided deletes only this image)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const { user, error } = await verifyAuth(request);
    if (!user || error) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userType = (user?.user_type || '').toLowerCase().trim();
    const userPhone = user?.phone || '';

    if (userType !== 'admin' || userPhone !== '7768068585') {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Access restricted to super admin' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const folderName = searchParams.get('folder');
    const imageName = searchParams.get('image');

    if (!folderName) {
      return NextResponse.json(
        { ok: false, error: 'Folder name is required' },
        { status: 400 }
      );
    }

    const folderPath = path.join(MEDIA_ROOT, decodeURIComponent(folderName));
    const resolvedPath = path.resolve(folderPath);
    const resolvedRoot = path.resolve(MEDIA_ROOT);

    // Security check: ensure path is within MEDIA_ROOT
    if (!resolvedPath.startsWith(resolvedRoot)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid folder path' },
        { status: 403 }
      );
    }

    // Check if folder exists
    try {
      await fs.access(folderPath);
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Folder not found' },
        { status: 404 }
      );
    }

    if (imageName) {
      // Delete individual image
      const imagePath = path.join(folderPath, decodeURIComponent(imageName));
      const resolvedImagePath = path.resolve(imagePath);

      // Security check: ensure image path is within folder
      if (!resolvedImagePath.startsWith(resolvedPath)) {
        return NextResponse.json(
          { ok: false, error: 'Invalid image path' },
          { status: 403 }
        );
      }

      try {
        await fs.unlink(imagePath);
        Logger.info('IMAGE_DELETED', {
          folder: folderName,
          image: imageName,
          deleted_by: user.id,
        });

        return NextResponse.json({
          ok: true,
          message: 'Image deleted successfully',
        });
      } catch (err: any) {
        Logger.error('IMAGE_DELETE_ERROR', {
          folder: folderName,
          image: imageName,
          error: err.message,
        });
        return NextResponse.json(
          { ok: false, error: 'Failed to delete image' },
          { status: 500 }
        );
      }
    } else {
      // Delete entire folder
      try {
        await fs.rm(folderPath, { recursive: true, force: true });
        Logger.info('FOLDER_DELETED', {
          folder: folderName,
          deleted_by: user.id,
        });

        return NextResponse.json({
          ok: true,
          message: 'Folder deleted successfully',
        });
      } catch (err: any) {
        Logger.error('FOLDER_DELETE_ERROR', {
          folder: folderName,
          error: err.message,
        });
        return NextResponse.json(
          { ok: false, error: 'Failed to delete folder' },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    Logger.error('DELETE_BACKUP_ERROR', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to delete' },
      { status: 500 }
    );
  }
}

