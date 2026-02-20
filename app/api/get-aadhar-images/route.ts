import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbQueryOne } from '@/lib/db';
import { Logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const aadharId = parseInt(body.aadhar_id || '0');

    if (aadharId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid aadhar_id' },
        { status: 422 }
      );
    }

    const row = await dbQueryOne(
      'SELECT front_image, back_image FROM survey_aadhar WHERE id = ? LIMIT 1',
      [aadharId]
    );

    if (!row) {
      return NextResponse.json(
        { ok: false, error: 'Aadhaar ID not found' },
        { status: 404 }
      );
    }

    let frontImage = (row as any).front_image || null;
    let backImage = (row as any).back_image || null;

    if (!frontImage || !backImage) {
      try {
        const files = await dbQuery(
          `SELECT file_type, file_path 
             FROM survey_files 
            WHERE aadhaar_id = ? 
              AND file_type IN ('aadhaar_front','aadhaar_back')
            ORDER BY updated_at DESC`,
          [aadharId]
        );
        for (const file of files as any[]) {
          if (!frontImage && file.file_type === 'aadhaar_front') {
            frontImage = file.file_path;
          } else if (!backImage && file.file_type === 'aadhaar_back') {
            backImage = file.file_path;
          }
          if (frontImage && backImage) break;
        }
      } catch (fallbackError: any) {
        Logger.error('get_aadhar_images_fallback_failed', { error: fallbackError.message });
      }
    }

    return NextResponse.json({
      ok: true,
      front_image: frontImage || null,
      back_image: backImage || null,
    });
  } catch (error: any) {
    Logger.error('get_aadhar_images_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}


