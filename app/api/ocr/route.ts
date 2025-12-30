import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromImage, extractAadhaarInfo, extractUDIDInfo, AadhaarInfo, UDIDInfo } from '@/lib/ocr';
import { Logger } from '@/lib/logger';
import { validateRequest } from '@/lib/validation';
import { verifyAuth } from '@/lib/auth';

// Extend timeout to 10 minutes for OCR processing
export const maxDuration = 600; // 10 minutes in seconds

/**
 * @swagger
 * /api/ocr:
 *   post:
 *     summary: Extract information from Aadhaar or UDID card images using OCR
 *     tags: [OCR]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *               - card_type
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               card_type:
 *                 type: string
 *                 enum: [aadhaar, udid]
 *                 description: Type of card being processed
 *     responses:
 *       200:
 *         description: OCR processing completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 card_type:
 *                   type: string
 *                 aadhaar_info:
 *                   type: object
 *                   properties:
 *                     aadhaar:
 *                       type: string
 *                     name:
 *                       type: string
 *                     dob:
 *                       type: string
 *                     age:
 *                       type: string
 *                     gender:
 *                       type: string
 *                     address:
 *                       type: string
 *                 udid_info:
 *                   type: object
 *                   properties:
 *                     udid:
 *                       type: string
 *                     disability_type:
 *                       type: string
 *                     disability_percentage:
 *                       type: string
 *                     validity_date:
 *                       type: string
 *                     issue_date:
 *                       type: string
 *                 raw_text:
 *                   type: string
 *                   description: Raw OCR text (optional, can be omitted in production)
 *       400:
 *         description: Invalid request
 *       500:
 *         description: OCR processing failed
 */
export async function POST(request: NextRequest) {
  try {
    // Require auth and validate passkey
    const { user, error } = await verifyAuth(request);
    if (!user || error) {
      return NextResponse.json({ ok: false, error: error || 'Authentication required' }, { status: 401 });
    }
    let passkeyHeader = request.headers.get('x-passkey') || '';
    Logger.info('OCR_PASSKEY_HEADER', { 
      user_id: user.id, 
      header_value: passkeyHeader || '(empty)',
      header_length: passkeyHeader.length 
    });
    const formData = await request.formData();
    // Fallback: allow passkey to be sent as form field when some clients strip custom headers
    if (!passkeyHeader) {
      const pkField = formData.get('passkey');
      Logger.info('OCR_PASSKEY_FALLBACK', { 
        user_id: user.id, 
        form_field_type: typeof pkField,
        form_field_value: typeof pkField === 'string' ? pkField : '(not string)'
      });
      if (typeof pkField === 'string') passkeyHeader = pkField;
    }
    if (!passkeyHeader) {
      Logger.error('OCR_PASSKEY_MISSING', { 
        user_id: user.id, 
        phone: user.phone,
        all_headers: Object.fromEntries(request.headers.entries()),
        form_keys: Array.from(formData.keys())
      });
      return NextResponse.json({ ok: false, error: 'Passkey required' }, { status: 401 });
    }
    try {
      const pk = passkeyHeader.trim();
      // Validate format: must be 4 digits
      if (!/^\d{4}$/.test(pk)) {
        Logger.error('OCR_PASSKEY_INVALID_FORMAT', { user_id: user.id, received: pk });
        return NextResponse.json({ ok: false, error: 'Invalid passkey format' }, { status: 401 });
      }
      const { getDbPool } = await import('@/lib/db');
      const pool = getDbPool();
      // Compare as strings to match VARCHAR column type
      const [rows]: any = await pool.query('SELECT id FROM users WHERE id = ? AND passkey = ? LIMIT 1', [user.id, pk]);
      Logger.info('OCR_PASSKEY_CHECK', { 
        user_id: user.id, 
        received_passkey: pk, 
        match_found: Array.isArray(rows) && rows.length > 0 
      });
      if (!Array.isArray(rows) || rows.length === 0) {
        // Log the actual passkey from DB for debugging (in dev only)
        const [dbRows]: any = await pool.query('SELECT passkey FROM users WHERE id = ? LIMIT 1', [user.id]);
        const dbPasskey = dbRows?.[0]?.passkey;
        Logger.error('OCR_PASSKEY_MISMATCH', { 
          user_id: user.id, 
          received: pk, 
          db_passkey: process.env.NODE_ENV === 'development' ? dbPasskey : '***' 
        });
        return NextResponse.json({ ok: false, error: 'Passkey mismatch' }, { status: 401 });
      }
    } catch (e: any) {
      Logger.error('OCR_PASSKEY_CHECK_FAILED', { user_id: user.id, error: e?.message, stack: e?.stack });
      return NextResponse.json({ ok: false, error: e?.message || 'Passkey check failed' }, { status: 401 });
    }
    // Support either single 'image' or separate 'front_image' and 'back_image'
    const imageFile = formData.get('image') as File | null;
    const frontImageFile = (formData.get('front_image') as File) || null;
    const backImageFile = (formData.get('back_image') as File) || null;
    const cardType = formData.get('card_type') as string;

    if (!imageFile && !frontImageFile && !backImageFile) {
      return NextResponse.json(
        { ok: false, error: 'Image file is required' },
        { status: 400 }
      );
    }

    if (!cardType || !['aadhaar', 'udid'].includes(cardType.toLowerCase())) {
      return NextResponse.json(
        { ok: false, error: 'card_type must be either "aadhaar" or "udid"' },
        { status: 400 }
      );
    }

    Logger.info('OCR_REQUEST', {
      filename: imageFile?.name || frontImageFile?.name || backImageFile?.name,
      size: imageFile?.size || frontImageFile?.size || backImageFile?.size,
      cardType,
      hasFront: !!frontImageFile,
      hasBack: !!backImageFile,
    });

    // Convert File to Buffer
    let imageBuffer: Buffer | null = null;
    if (imageFile) {
      imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    }
    let frontBuffer: Buffer | null = null;
    let backBuffer: Buffer | null = null;
    if (frontImageFile) frontBuffer = Buffer.from(await frontImageFile.arrayBuffer());
    if (backImageFile) backBuffer = Buffer.from(await backImageFile.arrayBuffer());

    // Validate image size (max 10MB)
    const mainLength = (imageBuffer?.length || 0) + (frontBuffer?.length || 0) + (backBuffer?.length || 0);
    if (mainLength > 10 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: 'Image size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Optimize image buffer for OCR (compress if too large)
    let optimizedBuffer = imageBuffer;
    if ((imageBuffer?.length || 0) > 2 * 1024 * 1024) { // If larger than 2MB
      Logger.info('OCR_IMAGE_LARGE', { 
        originalSize: imageBuffer?.length,
        message: 'Processing large image - this may take longer'
      });
    }

    // Extract text from image with timeout
    let ocrText: string;
    try {
      // Set a longer timeout for OCR processing (10 minutes for Tesseract)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OCR processing timeout')), 10 * 60 * 1000);
      });
      
      // If front/back are provided for Aadhaar, process separately per your rule
      if (cardType.toLowerCase() === 'aadhaar' && (frontBuffer || backBuffer)) {
        const [frontText, backText] = await Promise.all([
          frontBuffer ? extractTextFromImage(frontBuffer, 'aadhaar') : Promise.resolve(''),
          backBuffer ? extractTextFromImage(backBuffer, 'aadhaar') : Promise.resolve(''),
        ]);
        ocrText = `FRONT_IMAGE_TEXT\n${frontText}\n\nBACK_IMAGE_TEXT\n${backText}`;
      } else {
        ocrText = await Promise.race([
          extractTextFromImage(optimizedBuffer as Buffer, cardType.toLowerCase() as 'aadhaar' | 'udid'),
          timeoutPromise,
        ]) as string;
      }
    } catch (ocrError: any) {
      Logger.error('OCR_EXTRACTION_FAILED', { 
        error: ocrError.message,
        stack: ocrError.stack,
        code: ocrError.code
      });
      
      // Provide user-friendly error messages
      let errorMessage = ocrError.message || 'OCR extraction failed';
      
      if (ocrError.message?.includes('credentials') || ocrError.message?.includes('PERMISSION_DENIED')) {
        errorMessage = 'Google Cloud Vision API credentials not configured. Please configure GOOGLE_APPLICATION_CREDENTIALS.';
      } else if (ocrError.message?.includes('INVALID_ARGUMENT') || ocrError.message?.includes('Invalid image')) {
        errorMessage = 'Invalid image format. Please ensure the image is a valid image file.';
      } else if (ocrError.message?.includes('timeout')) {
        errorMessage = 'OCR processing timed out. Please try with a smaller or clearer image.';
      }
      
      return NextResponse.json(
        { ok: false, error: errorMessage },
        { status: 500 }
      );
    }
    
    Logger.info('OCR_TEXT_EXTRACTED', {
      textLength: ocrText.length,
      preview: ocrText.substring(0, 200),
    });

    const result: any = {
      ok: true,
      card_type: cardType.toLowerCase(),
    };

    // Extract information based on card type
    let aadhaarInfo: any = null;
    if (cardType.toLowerCase() === 'aadhaar') {
      aadhaarInfo = extractAadhaarInfo(ocrText);
      // If we have back image text, prefer address from BACK only, others from FRONT
      const backMatch = ocrText.match(/BACK_IMAGE_TEXT\n([\s\S]*)$/);
      const frontMatch = ocrText.match(/FRONT_IMAGE_TEXT\n([\s\S]*?)\n\nBACK_IMAGE_TEXT/);
      if (backMatch || frontMatch) {
        const backOnly = backMatch ? backMatch[1] : '';
        const frontOnly = frontMatch ? frontMatch[1] : '';
        const frontExtract = frontOnly ? extractAadhaarInfo(frontOnly) : {} as any;
        const backExtract = backOnly ? extractAadhaarInfo(backOnly) : {} as any;
        // Merge: address strictly from back; other fields from front when available
        aadhaarInfo.address = backExtract.address || aadhaarInfo.address;
        aadhaarInfo.name = frontExtract.name || aadhaarInfo.name;
        aadhaarInfo.dob = frontExtract.dob || aadhaarInfo.dob;
        aadhaarInfo.age = frontExtract.age || aadhaarInfo.age;
        aadhaarInfo.gender = frontExtract.gender || aadhaarInfo.gender;
        aadhaarInfo.aadhaar = frontExtract.aadhaar || aadhaarInfo.aadhaar;
      }
      result.aadhaar_info = aadhaarInfo;
      Logger.info('OCR_AADHAAR_EXTRACTED', aadhaarInfo);
    } else if (cardType.toLowerCase() === 'udid') {
      const udidInfo = extractUDIDInfo(ocrText);
      result.udid_info = udidInfo;
      Logger.info('OCR_UDID_EXTRACTED', udidInfo);
    }

    // Save extracted Aadhaar data to survey_aadhar if aadhar_id is provided
    if (cardType.toLowerCase() === 'aadhaar' && aadhaarInfo) {
      const aadharIdParam = formData.get('aadhar_id');
      const aadharId = aadharIdParam ? parseInt(String(aadharIdParam)) : null;
      
      if (aadharId && aadharId > 0) {
        try {
          const { getDbPool } = await import('@/lib/db');
          const pool = getDbPool();
          const conn = await pool.getConnection();
          try {
            // Parse address components if address is available
            let addressText = aadhaarInfo.address || null;
            let pincode: string | null = null;
            let taluka: string | null = null;
            let district: string | null = null;
            
            if (addressText) {
              // Try to extract pincode (6 digits)
              const pincodeMatch = addressText.match(/\b(\d{6})\b/);
              if (pincodeMatch) {
                pincode = pincodeMatch[1];
              }
              
              // Try to extract district and taluka from address text
              // This is a simple extraction - can be improved with AI parsing
              const districtMatch = addressText.match(/\b(district|जिल्हा|जि\.?)\s*:?\s*([A-Za-z\u0900-\u097F]+)/i);
              if (districtMatch) {
                district = districtMatch[2].trim();
              }
              
              const talukaMatch = addressText.match(/\b(taluka|तालुका|ता\.?)\s*:?\s*([A-Za-z\u0900-\u097F]+)/i);
              if (talukaMatch) {
                taluka = talukaMatch[2].trim();
              }
            }
            
            // Format DOB if available
            let dobFormatted: string | null = null;
            if (aadhaarInfo.dob) {
              // Try to parse and format DOB
              const dobStr = String(aadhaarInfo.dob);
              // Handle various formats: DD-MM-YYYY, YYYY-MM-DD, etc.
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
            
            Logger.info('OCR_DATA_SAVED_TO_SURVEY_AADHAR', {
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
          Logger.error('OCR_SAVE_TO_DB_FAILED', {
            error: saveError.message,
            aadhar_id: aadharId,
          });
          // Don't fail the OCR request if save fails
        }
      }
    }

    // Include raw text in development (optional)
    if (process.env.NODE_ENV === 'development') {
      result.raw_text = ocrText;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    Logger.error('OCR_PROCESSING_FAILED', { 
      error: error.message,
      stack: error.stack 
    });
    return NextResponse.json(
      { ok: false, error: error.message || 'OCR processing failed' },
      { status: 500 }
    );
  }
}

