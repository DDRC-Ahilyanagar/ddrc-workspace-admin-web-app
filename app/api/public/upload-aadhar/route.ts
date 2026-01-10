import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile, rename } from 'fs/promises';
import { join } from 'path';
import { Logger } from '@/lib/logger';

/**
 * Upload Aadhar images for public form
 * Stores images in uploads/<divyang_name>-<aadhar_no>/ folder structure
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const frontImage = formData.get('front_image') as File | null;
    const backImage = formData.get('back_image') as File | null;
    const aadharNo = formData.get('aadhar_no')?.toString()?.trim() || '';
    const divyangName = formData.get('divyang_name')?.toString()?.trim() || '';

    if (!frontImage || !backImage) {
      return NextResponse.json(
        { ok: false, error: 'Both front and back images are required' },
        { status: 400 }
      );
    }

    if (!aadharNo) {
      return NextResponse.json(
        { ok: false, error: 'Aadhar number is required' },
        { status: 400 }
      );
    }

    if (!divyangName) {
      return NextResponse.json(
        { ok: false, error: 'Divyang name is required' },
        { status: 400 }
      );
    }

    // Sanitize name: remove special chars, replace spaces with underscores
    const safeName = divyangName
      .replace(/[^A-Za-z0-9 _-]/g, '')
      .replace(/\s+/g, '_')
      .trim() || 'UNKNOWN';

    // Extract only digits from Aadhar number
    const digits = aadharNo.replace(/\D+/g, '') || 'NA';

    // Create folder structure: uploads/<divyang_name>-<aadhar_no>/
    const folderName = `${safeName}-${digits}`;
    const baseDir = join(process.cwd(), 'public', 'uploads');
    const targetDir = join(baseDir, folderName);
    await mkdir(targetDir, { recursive: true });

    // Save front image
    const frontBytes = await frontImage.arrayBuffer();
    const frontFilePath = join(targetDir, 'front.jpg');
    await writeFile(frontFilePath, Buffer.from(frontBytes));

    // Save back image
    const backBytes = await backImage.arrayBuffer();
    const backFilePath = join(targetDir, 'back.jpg');
    await writeFile(backFilePath, Buffer.from(backBytes));

    // Always return relative paths (not full URLs) to avoid localhost issues
    // The frontend/API will convert to absolute URLs when needed using getAbsoluteImageUrl
    const frontPath = `/uploads/${folderName}/front.jpg`;
    const backPath = `/uploads/${folderName}/back.jpg`;

    Logger.info('PUBLIC_AADHAR_UPLOAD_SUCCESS', {
      folderName,
      divyangName: safeName,
      aadharNo: digits,
      frontPath,
      backPath,
    });

    return NextResponse.json({
      ok: true,
      folder: folderName,
      front_image: frontPath, // Return relative path, not full URL
      back_image: backPath, // Return relative path, not full URL
      front_path: frontPath,
      back_path: backPath,
    });
  } catch (error: any) {
    Logger.error('PUBLIC_AADHAR_UPLOAD_ERROR', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}




