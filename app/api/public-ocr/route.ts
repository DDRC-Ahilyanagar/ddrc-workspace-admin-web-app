import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromImage, extractAadhaarInfo } from '@/lib/ocr';
import { Logger } from '@/lib/logger';
import { getDbPool } from '@/lib/db';

// Public OCR endpoint - no authentication required
export const maxDuration = 600; // 10 minutes

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const frontImageFile = formData.get('front_image') as File | null;
    const backImageFile = formData.get('back_image') as File | null;
    const cardType = (formData.get('card_type') as string) || 'aadhaar';
    const aadharIdParam = formData.get('aadhar_id');

    if (!frontImageFile && !backImageFile) {
      return NextResponse.json(
        { ok: false, error: 'At least one image file is required' },
        { status: 400 }
      );
    }

    if (cardType !== 'aadhaar') {
      return NextResponse.json(
        { ok: false, error: 'Only Aadhaar card type is supported for public form' },
        { status: 400 }
      );
    }

    Logger.info('PUBLIC_OCR_REQUEST', {
      hasFront: !!frontImageFile,
      hasBack: !!backImageFile,
      aadharId: aadharIdParam,
    });

    // Convert Files to Buffers
    let frontBuffer: Buffer | null = null;
    let backBuffer: Buffer | null = null;
    if (frontImageFile) frontBuffer = Buffer.from(await frontImageFile.arrayBuffer());
    if (backImageFile) backBuffer = Buffer.from(await backImageFile.arrayBuffer());

    // Validate image size (max 10MB each)
    if ((frontBuffer?.length || 0) > 10 * 1024 * 1024 || (backBuffer?.length || 0) > 10 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: 'Image size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Extract text from both images
    let ocrText = '';
    try {
      const [frontText, backText] = await Promise.all([
        frontBuffer ? extractTextFromImage(frontBuffer, 'aadhaar') : Promise.resolve(''),
        backBuffer ? extractTextFromImage(backBuffer, 'aadhaar') : Promise.resolve(''),
      ]);
      ocrText = `FRONT_IMAGE_TEXT\n${frontText}\n\nBACK_IMAGE_TEXT\n${backText}`;
    } catch (ocrError: any) {
      Logger.error('PUBLIC_OCR_EXTRACTION_FAILED', {
        error: ocrError.message,
        stack: ocrError.stack,
      });
      return NextResponse.json(
        { ok: false, error: ocrError.message || 'OCR extraction failed' },
        { status: 500 }
      );
    }

    Logger.info('PUBLIC_OCR_TEXT_EXTRACTED', {
      textLength: ocrText.length,
    });

    // Extract Aadhaar information
    const aadhaarInfo = extractAadhaarInfo(ocrText);
    
    // If we have separate front/back text, extract from each
    const backMatch = ocrText.match(/BACK_IMAGE_TEXT\n([\s\S]*)$/);
    const frontMatch = ocrText.match(/FRONT_IMAGE_TEXT\n([\s\S]*?)\n\nBACK_IMAGE_TEXT/);
    if (backMatch || frontMatch) {
      const backOnly = backMatch ? backMatch[1] : '';
      const frontOnly = frontMatch ? frontMatch[1] : '';
      const frontExtract = frontOnly ? extractAadhaarInfo(frontOnly) : {} as any;
      const backExtract = backOnly ? extractAadhaarInfo(backOnly) : {} as any;
      // Merge: address from back; other fields from front
      aadhaarInfo.address = backExtract.address || aadhaarInfo.address;
      aadhaarInfo.name = frontExtract.name || aadhaarInfo.name;
      aadhaarInfo.dob = frontExtract.dob || aadhaarInfo.dob;
      aadhaarInfo.age = frontExtract.age || aadhaarInfo.age;
      aadhaarInfo.gender = frontExtract.gender || aadhaarInfo.gender;
      aadhaarInfo.aadhaar = frontExtract.aadhaar || aadhaarInfo.aadhaar;
    }

    // Save extracted data to survey_aadhar if aadhar_id is provided
    if (aadharIdParam && aadhaarInfo) {
      const aadharId = parseInt(String(aadharIdParam));
      if (aadharId > 0) {
        try {
          const pool = getDbPool();
          const conn = await pool.getConnection();
          try {
            // Parse address components
            let addressText = aadhaarInfo.address || null;
            let pincode: string | null = null;
            let taluka: string | null = null;
            let district: string | null = null;

            if (addressText) {
              const pincodeMatch = addressText.match(/\b(\d{6})\b/);
              if (pincodeMatch) pincode = pincodeMatch[1];

              const districtMatch = addressText.match(/\b(district|जिल्हा|जि\.?)\s*:?\s*([A-Za-z\u0900-\u097F]+)/i);
              if (districtMatch) district = districtMatch[2].trim();

              const talukaMatch = addressText.match(/\b(taluka|तालुका|ता\.?)\s*:?\s*([A-Za-z\u0900-\u097F]+)/i);
              if (talukaMatch) taluka = talukaMatch[2].trim();
            }

            // Format DOB
            let dobFormatted: string | null = null;
            if (aadhaarInfo.dob) {
              const dobStr = String(aadhaarInfo.dob);
              const dobMatch = dobStr.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
              if (dobMatch) {
                const [, day, month, year] = dobMatch;
                dobFormatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              } else {
                dobFormatted = dobStr;
              }
            }

            // Format gender
            let genderFormatted: string | null = null;
            if (aadhaarInfo.gender) {
              const genderStr = String(aadhaarInfo.gender).toUpperCase();
              if (genderStr.includes('MALE') || genderStr === 'M') {
                genderFormatted = 'Male';
              } else if (genderStr.includes('FEMALE') || genderStr === 'F') {
                genderFormatted = 'Female';
              } else {
                genderFormatted = aadhaarInfo.gender;
              }
            }

            // Update Aadhaar number if extracted
            let aadharNo = null;
            if (aadhaarInfo.aadhaar) {
              aadharNo = aadhaarInfo.aadhaar.replace(/\D/g, '');
              if (aadharNo.length === 12) {
                await conn.query(
                  `UPDATE survey_aadhar SET aadhar_no = ? WHERE id = ?`,
                  [aadharNo, aadharId]
                );
              }
            }

            // Update survey_aadhar with extracted data
            await conn.query(
              `UPDATE survey_aadhar 
               SET holder_name = COALESCE(?, holder_name),
                   gender = COALESCE(?, gender),
                   dob = COALESCE(?, dob),
                   address_text = COALESCE(?, address_text),
                   pincode = COALESCE(?, pincode),
                   taluka = COALESCE(?, taluka),
                   district = COALESCE(?, district),
                   updated_at = NOW()
               WHERE id = ?`,
              [
                aadhaarInfo.name || null,
                genderFormatted,
                dobFormatted,
                addressText,
                pincode,
                taluka,
                district,
                aadharId
              ]
            );

            Logger.info('PUBLIC_OCR_DATA_SAVED', {
              aadhar_id: aadharId,
              has_name: !!aadhaarInfo.name,
              has_dob: !!aadhaarInfo.dob,
              has_gender: !!aadhaarInfo.gender,
              has_address: !!aadhaarInfo.address,
            });
          } finally {
            conn.release();
          }
        } catch (saveError: any) {
          Logger.error('PUBLIC_OCR_SAVE_FAILED', {
            error: saveError.message,
            aadhar_id: aadharIdParam,
          });
          // Don't fail the OCR request if save fails
        }
      }
    }

    return NextResponse.json({
      ok: true,
      card_type: 'aadhaar',
      aadhaar_info: aadhaarInfo,
    });
  } catch (error: any) {
    Logger.error('PUBLIC_OCR_PROCESSING_FAILED', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { ok: false, error: error.message || 'OCR processing failed' },
      { status: 500 }
    );
  }
}

