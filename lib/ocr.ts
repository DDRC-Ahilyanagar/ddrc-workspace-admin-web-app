import { ImageAnnotatorClient } from '@google-cloud/vision';
import { Logger } from './logger';

export interface AadhaarInfo {
  aadhaar?: string;
  name?: string;
  dob?: string;
  age?: string;
  gender?: string;
  address?: string;
}

export interface UDIDInfo {
  udid?: string;
  disability_type?: string;
  disability_percentage?: string;
  validity_date?: string;
  issue_date?: string;
}

// Initialize Google Cloud Vision client
let visionClient: ImageAnnotatorClient | null = null;
let useGoogleVision = false;

function getVisionClient(): ImageAnnotatorClient | null {
  // Check if credentials are configured
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT_ID) {
    if (!visionClient) {
      try {
        visionClient = new ImageAnnotatorClient({
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        });
        useGoogleVision = true;
        Logger.info('OCR_ENGINE_INIT', { engine: 'Google Cloud Vision' });
      } catch (error) {
        Logger.info('OCR_ENGINE_INIT_FAILED', { error: 'Google Vision init failed' });
        useGoogleVision = false;
      }
    }
    return visionClient;
  }
  return null;
}

async function extractTextWithGoogleVision(imageBuffer: Buffer): Promise<string> {
  const client = getVisionClient();
  if (!client) {
    throw new Error('Google Cloud Vision client not initialized');
  }

  Logger.info('OCR_START', { bufferSize: imageBuffer.length, engine: 'Google Cloud Vision' });

  // Perform text detection using Google Cloud Vision API
  const [result] = await client.textDetection({
    image: { content: imageBuffer },
  });

  // Extract all detected text
  const detections = result.textAnnotations;
  if (!detections || detections.length === 0) {
    Logger.info('OCR_NO_TEXT_DETECTED');
    return '';
  }

  // The first annotation contains all detected text
  const fullText = detections[0].description || '';

  Logger.info('OCR_COMPLETE', {
    textLength: fullText.length,
    detectedBlocks: detections.length - 1,
    engine: 'Google Cloud Vision'
  });

  return fullText;
}

// Tesseract fallback removed for build stability and resource optimization.
// Relying on Google Cloud Vision.
async function extractTextWithTesseract(imageBuffer: Buffer): Promise<string> {
  Logger.warn('TESSERACT_FALLBACK_CALLED', { message: 'Tesseract is disabled. Please configure Google Vision.' });
  return '';
}

/**
 * Preprocess image for better OCR - enhance contrast and sharpness
 */
async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  // sharp is removed to prevent build hangs. Returning original buffer.
  return imageBuffer;
}

/**
 * Crop and zoom specific region from image (for focusing on specific sections)
 */
async function cropImageRegion(imageBuffer: Buffer, x: number, y: number, width: number, height: number, zoomFactor: number = 2): Promise<Buffer> {
  // sharp is removed. Multi-region OCR will now just use the full image.
  return imageBuffer;
}

/**
 * Extract text from specific regions of Aadhaar card (front side)
 * Aadhaar card layout:
 * - Left side (0-35%): Photo (skip)
 * - Right side top (35-100% width, 10-40% height): Name area
 * - Right side middle (35-100% width, 40-65% height): DOB and Gender
 * - Bottom (0-100% width, 85-95% height): Aadhaar number
 */
async function extractAadhaarRegions(imageBuffer: Buffer, ocrFunction: (buffer: Buffer) => Promise<string>): Promise<string> {
  const regions: string[] = [];

  try {
    // Region 1: Name region (right side, top 10-40% of card height)
    // Aadhaar cards have photo on left (30-35%), name on right (35-100%)
    const nameRegion = await cropImageRegion(imageBuffer, 35, 10, 60, 30, 4);
    const nameText = await ocrFunction(nameRegion);
    if (nameText.trim()) {
      regions.push(`NAME_REGION:\n${nameText}`);
      Logger.info('OCR_AADHAAR_NAME', { textLength: nameText.length });
    }

    // Region 2: DOB and Gender region (right side, middle 40-65% of card height)
    const dobGenderRegion = await cropImageRegion(imageBuffer, 35, 40, 60, 25, 4);
    const dobGenderText = await ocrFunction(dobGenderRegion);
    if (dobGenderText.trim()) {
      regions.push(`DOB_GENDER_REGION:\n${dobGenderText}`);
      Logger.info('OCR_AADHAAR_DOB_GENDER', { textLength: dobGenderText.length });
    }

    // Region 3: Aadhaar number (bottom, full width, last 10-15% of card)
    // Aadhaar number is typically at the very bottom in large font
    const aadhaarNumberRegion = await cropImageRegion(imageBuffer, 0, 85, 100, 12, 5);
    const aadhaarNumberText = await ocrFunction(aadhaarNumberRegion);
    if (aadhaarNumberText.trim()) {
      regions.push(`AADHAAR_NUMBER_REGION:\n${aadhaarNumberText}`);
      Logger.info('OCR_AADHAAR_NUMBER', { textLength: aadhaarNumberText.length });
    }

    // Also process full image for any missed information
    const fullImageText = await ocrFunction(await preprocessImage(imageBuffer));
    if (fullImageText.trim()) {
      regions.push(`FULL_IMAGE:\n${fullImageText}`);
    }

    return regions.join('\n\n');
  } catch (error: any) {
    Logger.error('OCR_REGIONS_FAILED', { error: error.message });
    // Fallback to full image OCR
    return await ocrFunction(await preprocessImage(imageBuffer));
  }
}

/**
 * Extract text from specific regions of UDID card
 */
async function extractUDIDRegions(imageBuffer: Buffer, ocrFunction: (buffer: Buffer) => Promise<string>): Promise<string> {
  const regions: string[] = [];

  try {
    // Region 1: Top section (UDID number) - typically top 25% of card
    const topRegion = await cropImageRegion(imageBuffer, 5, 5, 90, 25, 3.5);
    const topText = await ocrFunction(topRegion);
    if (topText.trim()) {
      regions.push(`TOP_REGION:\n${topText}`);
      Logger.info('OCR_UDID_TOP', { textLength: topText.length });
    }

    // Region 2: Middle section (Disability type, percentage) - typically middle 30% of card
    const middleRegion = await cropImageRegion(imageBuffer, 5, 30, 90, 30, 3);
    const middleText = await ocrFunction(middleRegion);
    if (middleText.trim()) {
      regions.push(`MIDDLE_REGION:\n${middleText}`);
      Logger.info('OCR_UDID_MIDDLE', { textLength: middleText.length });
    }

    // Region 3: Bottom section (Dates - validity, issue) - typically bottom 35% of card
    const bottomRegion = await cropImageRegion(imageBuffer, 5, 65, 90, 30, 3);
    const bottomText = await ocrFunction(bottomRegion);
    if (bottomText.trim()) {
      regions.push(`BOTTOM_REGION:\n${bottomText}`);
      Logger.info('OCR_UDID_BOTTOM', { textLength: bottomText.length });
    }

    return regions.join('\n\n');
  } catch (error: any) {
    Logger.error('OCR_REGIONS_FAILED', { error: error.message });
    // Fallback to full image OCR
    return await ocrFunction(imageBuffer);
  }
}

export async function extractTextFromImage(imageBuffer: Buffer, cardType?: 'aadhaar' | 'udid'): Promise<string> {
  // Preprocess base image for better OCR accuracy
  const processedBuffer = await preprocessImage(imageBuffer);

  // OCR function that will be used for region extraction
  const performOCR = async (buffer: Buffer): Promise<string> => {
    // Try Google Cloud Vision first if configured
    const client = getVisionClient();
    if (client) {
      try {
        return await extractTextWithGoogleVision(buffer);
      } catch (error: any) {
        Logger.info('OCR_GOOGLE_VISION_FAILED', {
          error: error.message,
          code: error.code,
          fallingBack: 'None (Tesseract disabled)'
        });

        // Only fallback if it's not a credential/permission error
        if (!error.message?.includes('credentials') && !error.message?.includes('PERMISSION_DENIED')) {
          throw error;
        }
      }
    }

    // Fallback disabled
    return '';
  };

  // If card type is specified, use region-based extraction for better accuracy
  if (cardType === 'aadhaar') {
    Logger.info('OCR_USING_REGIONS', { cardType: 'aadhaar', method: 'region-based extraction' });
    try {
      return await extractAadhaarRegions(imageBuffer, performOCR);
    } catch (error: any) {
      Logger.info('OCR_REGIONS_FAILED', { error: error.message, fallingBack: 'full image' });
      // Fallback to full image OCR
    }
  } else if (cardType === 'udid') {
    Logger.info('OCR_USING_REGIONS', { cardType: 'udid', method: 'region-based extraction' });
    try {
      return await extractUDIDRegions(imageBuffer, performOCR);
    } catch (error: any) {
      Logger.info('OCR_REGIONS_FAILED', { error: error.message, fallingBack: 'full image' });
      // Fallback to full image OCR
    }
  }

  // Default: Process full image with preprocessing
  Logger.info('OCR_FULL_IMAGE', { cardType: cardType || 'unknown' });
  try {
    return await performOCR(processedBuffer);
  } catch (error: any) {
    Logger.error('OCR_ERROR', {
      error: error.message,
      stack: error.stack,
      engine: 'Tesseract.js'
    });
    throw error;
  }
}

export function extractAadhaarInfo(ocrText: string): AadhaarInfo {
  const info: AadhaarInfo = {};

  // Extract text from specific regions if available
  const nameRegionMatch = ocrText.match(/NAME_REGION:\s*([\s\S]*?)(?=\n(?:DOB_GENDER_REGION|AADHAAR_NUMBER_REGION|FULL_IMAGE)|$)/i);
  const dobGenderRegionMatch = ocrText.match(/DOB_GENDER_REGION:\s*([\s\S]*?)(?=\n(?:AADHAAR_NUMBER_REGION|FULL_IMAGE|NAME_REGION)|$)/i);
  const aadhaarNumberRegionMatch = ocrText.match(/AADHAAR_NUMBER_REGION:\s*([\s\S]*?)(?=\n(?:FULL_IMAGE|NAME_REGION|DOB_GENDER_REGION)|$)/i);
  const fullImageMatch = ocrText.match(/FULL_IMAGE:\s*([\s\S]*?)$/i);

  // Prioritize region-specific text, fallback to full text
  const nameText = nameRegionMatch ? nameRegionMatch[1] : ocrText;
  const dobGenderText = dobGenderRegionMatch ? dobGenderRegionMatch[1] : ocrText;
  const aadhaarNumberText = aadhaarNumberRegionMatch ? aadhaarNumberRegionMatch[1] : ocrText;
  const fullText = fullImageMatch ? fullImageMatch[1] : ocrText;

  // Clean up region markers for general parsing
  const cleanText = ocrText.replace(/(?:NAME_REGION|DOB_GENDER_REGION|AADHAAR_NUMBER_REGION|FULL_IMAGE|TOP_REGION|MIDDLE_REGION|BOTTOM_REGION):/gi, '').trim();
  // Remove common non-address boilerplate often OCR'd from Aadhaar cards
  const cleanedForAddressScan = cleanText
    .replace(/Note:\s*Children on attaining[\s\S]{0,200}?biometric information\.?/i, '')
    .replace(/to establish identity,?\s*authenticate online[,\s]*/gi, '')
    .replace(/non-?government services in future\.?/gi, '')
    .replace(/information\.?/gi, '');

  // Extract Aadhaar number (prioritize AADHAAR_NUMBER_REGION, then full text)
  const aadhaarPatterns = [
    /(\d{4}[\s-]?\d{4}[\s-]?\d{4})/,
    /(\d{12})/,
    /AADHAAR[:\s]*(\d{4}[\s-]?\d{4}[\s-]?\d{4})/i,
    /\b(\d{4})\s*[-/]?\s*(\d{4})\s*[-/]?\s*(\d{4})\b/,
  ];

  // First try Aadhaar number region (most accurate)
  for (const pattern of aadhaarPatterns) {
    const match = aadhaarNumberText.replace(/[^\d\s-]/g, ' ').match(pattern);
    if (match) {
      const digits = match[1]?.replace(/\D/g, '') ||
        (match[1] && match[2] && match[3] ? match[1] + match[2] + match[3] : '').replace(/\D/g, '');
      if (digits.length === 12) {
        info.aadhaar = `${digits.substring(0, 4)}-${digits.substring(4, 8)}-${digits.substring(8, 12)}`;
        break;
      }
    }
  }

  // Fallback to full text if not found in number region
  if (!info.aadhaar) {
    for (const pattern of aadhaarPatterns) {
      const match = cleanText.replace(/[^\d\s-]/g, ' ').match(pattern);
      if (match) {
        const digits = match[1]?.replace(/\D/g, '') ||
          (match[1] && match[2] && match[3] ? match[1] + match[2] + match[3] : '').replace(/\D/g, '');
        if (digits.length === 12) {
          info.aadhaar = `${digits.substring(0, 4)}-${digits.substring(4, 8)}-${digits.substring(8, 12)}`;
          break;
        }
      }
    }
  }

  // Extract Gender - prioritize DOB_GENDER_REGION
  // Enhanced patterns to handle OCR errors and various formats
  const genderPatterns = [
    // Standard patterns with label
    /(?:Gender|लिंग|GENDER|SEX)[:\s/]*([MF]|Male|Female|पुरुष|स्त्री|M|F|म|प)/i,
    // Standalone gender words (exact match)
    /\b(Male|Female|पुरुष|स्त्री|महिला|M|F)\b/i,
    // Gender after DOB (common layout: DOB / Gender)
    /(?:\d{1,2}[-/\s]\d{1,2}[-/\s]\d{4})[:\s/]*([MF]|Male|Female|पुरुष|स्त्री|M|F)/i,
    // Gender with slash separator
    /\/?([MF])\/?/i,
    // Marathi/Hindi gender words
    /(पुरुष|स्त्री|महिला)/i,
    // Single letter M or F (often near DOB, standalone)
    /\b([MF])\b(?=\s|$|,|\.|\/)/i,
    // Gender in DOB line format: DD/MM/YYYY / M or F
    /(\d{1,2}[-/\s]\d{1,2}[-/\s]\d{4})\s*[/-]\s*([MF]|Male|Female)/i,
    // OCR error-tolerant: "Male" variations (l read as | or 1)
    /\b(Ma[|1l]e|Ma[|1]e|M[|1]le)\b/i,
    // OCR error-tolerant: "Female" variations
    /\b(Fe[|1l]ma[|1l]e|Fema[|1l]e|F[|1l]male)\b/i,
  ];

  // Helper function to normalize gender text (handles OCR errors)
  const normalizeGender = (text: string): string | null => {
    if (!text) return null;
    const lower = text.toLowerCase().trim();

    // Exact matches first
    if (lower === 'm' || lower === 'म') return 'पुरुष';
    if (lower === 'f') return 'स्त्री';

    // Handle "Male" with OCR errors (l -> | or 1)
    if (lower.match(/^ma[|1l]e$/i) ||
      lower.match(/^ma[|1]e$/i) ||
      lower.match(/^m[|1]le$/i) ||
      lower.includes('male') ||
      lower.includes('पुरुष')) {
      return 'पुरुष';
    }

    // Handle "Female" with OCR errors
    if (lower.match(/^fe[|1l]ma[|1l]e$/i) ||
      lower.match(/^fema[|1l]e$/i) ||
      lower.match(/^f[|1l]male$/i) ||
      lower.includes('female') ||
      lower.includes('स्त्री') ||
      lower.includes('महिला')) {
      return 'स्त्री';
    }

    return null;
  };

  // First try DOB_GENDER_REGION (most accurate)
  Logger.info('OCR_GENDER_EXTRACTION', {
    region: 'DOB_GENDER_REGION',
    textPreview: dobGenderText.substring(0, 200)
  });

  for (const pattern of genderPatterns) {
    const match = dobGenderText.match(pattern);
    if (match) {
      // Try match[1] first, then match[2] (for patterns with multiple groups)
      const genderText = (match[1] || match[2] || match[0] || '').trim();
      if (genderText) {
        const normalized = normalizeGender(genderText);
        if (normalized) {
          info.gender = normalized;
          Logger.info('OCR_GENDER_FOUND', {
            region: 'DOB_GENDER_REGION',
            raw: genderText,
            normalized: normalized
          });
          break;
        }
      }
    }
  }

  // Fallback to full text if not found in region
  if (!info.gender) {
    Logger.info('OCR_GENDER_FALLBACK', {
      region: 'FULL_TEXT',
      textPreview: cleanText.substring(0, 300)
    });

    for (const pattern of genderPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const genderText = (match[1] || match[2] || match[0] || '').trim();
        if (genderText) {
          const normalized = normalizeGender(genderText);
          if (normalized) {
            info.gender = normalized;
            Logger.info('OCR_GENDER_FOUND', {
              region: 'FULL_TEXT',
              raw: genderText,
              normalized: normalized
            });
            break;
          }
        }
      }
    }
  }

  // Final fallback: Look for M/F near DOB in any format
  if (!info.gender) {
    const dobGenderLinePattern = /(\d{1,2}[-/\s]\d{1,2}[-/\s]\d{4})[^\n]{0,30}?([MF])\b/i;
    const lineMatch = cleanText.match(dobGenderLinePattern);
    if (lineMatch && lineMatch[2]) {
      const genderChar = lineMatch[2].toUpperCase();
      info.gender = genderChar === 'M' ? 'पुरुष' : 'स्त्री';
      Logger.info('OCR_GENDER_FOUND_FALLBACK', {
        method: 'DOB_LINE_PROXIMITY',
        raw: genderChar,
        normalized: info.gender
      });
    }
  }

  if (!info.gender) {
    Logger.info('OCR_GENDER_NOT_FOUND', {
      dobGenderRegion: dobGenderText.substring(0, 100),
      fullTextPreview: cleanText.substring(0, 200)
    });
  }

  // Extract Date of Birth - MUST have DOB prefix (Aadhaar cards always have prefix)
  // Priority 1: Patterns with DOB prefix (strict requirement)
  const dobWithPrefixPatterns = [
    // English prefixes
    /(?:DOB|DATE\s+OF\s+BIRTH|BIRTH\s+DATE|BIRTHDATE|Date\s+of\s+Birth)[:\s/]*(\d{1,2})[-/\s](\d{1,2})[-/\s](\d{4})/i,
    /(?:DOB|DATE\s+OF\s+BIRTH|BIRTH\s+DATE)[:\s/]+(\d{1,2})[-/\s](\d{1,2})[-/\s](\d{4})/i,
    // Marathi/Hindi prefixes
    /(?:जन्म\s*तारीख|जन्मतारीख|जन्म\s*दिनांक)[:\s/]*(\d{1,2})[-/\s](\d{1,2})[-/\s](\d{4})/i,
    /(?:जन्म\s*तारीख|जन्मतारीख)[:\s/]+(\d{1,2})[-/\s](\d{1,2})[-/\s](\d{4})/i,
    // With colon or slash separator
    /(?:DOB|जन्म\s*तारीख)[:\s/]+(\d{1,2})[-/\s](\d{1,2})[-/\s](\d{4})/i,
    // OCR error-tolerant: "DOB" might be read as "DO8", "D0B", etc.
    /(?:DO[8B0]|D[0O]B|DATE\s+OF\s+BIRTH)[:\s/]*(\d{1,2})[-/\s](\d{1,2})[-/\s](\d{4})/i,
  ];

  // Priority 2: Patterns with prefix but flexible spacing (fallback)
  const dobWithPrefixFlexiblePatterns = [
    /(?:DOB|DATE\s+OF\s+BIRTH|जन्म\s*तारीख).{0,30}?(\d{1,2})[-/\s](\d{1,2})[-/\s](\d{4})/i,
  ];

  // Priority 3: Standalone date patterns (ONLY as last resort, and only in DOB_GENDER_REGION)
  const standaloneDatePatterns = [
    /(\d{1,2})[-/\s](\d{1,2})[-/\s](\d{4})/,
  ];

  // Exclude print/issue dates
  const excludedDates: string[] = [];
  const printDatePattern = /(?:PRINT\s+DATE|ISSUE\s+DATE|Print\s+Date|Issue\s+Date|जारी|मिळाल्याची)[:\s]*(\d{1,2})[-/\s](\d{1,2})[-/\s](\d{4})/i;
  let match;
  while ((match = printDatePattern.exec(cleanText)) !== null) {
    if (match[1] && match[2] && match[3]) {
      const excludedDate = `${match[1]}-${match[2]}-${match[3]}`;
      excludedDates.push(excludedDate.trim());
    }
  }

  // Helper function to validate and extract DOB
  const extractAndValidateDOB = (dayStr: string, monthStr: string, yearStr: string): string | null => {
    const day = parseInt(dayStr);
    const month = parseInt(monthStr);
    const year = parseInt(yearStr);

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= new Date().getFullYear()) {
      const dobStr = `${day}-${month}-${year}`;
      // Check if it's an excluded date (print/issue date)
      if (!excludedDates.includes(dobStr)) {
        return dobStr;
      }
    }
    return null;
  };

  // First try DOB_GENDER_REGION with prefix patterns (strict)
  Logger.info('OCR_DOB_EXTRACTION', {
    region: 'DOB_GENDER_REGION',
    textPreview: dobGenderText.substring(0, 200)
  });

  // Priority 1: Patterns with DOB prefix (strict)
  for (const pattern of dobWithPrefixPatterns) {
    const matches = dobGenderText.matchAll(new RegExp(pattern.source, 'gi'));
    for (const dobMatch of matches) {
      if (dobMatch[1] && dobMatch[2] && dobMatch[3]) {
        const dobStr = extractAndValidateDOB(dobMatch[1], dobMatch[2], dobMatch[3]);
        if (dobStr) {
          info.dob = dobStr;
          const dob = new Date(parseInt(dobMatch[3]), parseInt(dobMatch[2]) - 1, parseInt(dobMatch[1]));
          const now = new Date();
          let age = now.getFullYear() - dob.getFullYear();
          if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) {
            age--;
          }
          if (age > 0 && age < 150) {
            info.age = `${age} वर्षे`;
          }
          Logger.info('OCR_DOB_FOUND', {
            region: 'DOB_GENDER_REGION',
            method: 'PREFIX_STRICT',
            dob: dobStr,
            age: info.age
          });
          break;
        }
      }
    }
    if (info.dob) break;
  }

  // Priority 2: Flexible prefix patterns (if not found with strict)
  if (!info.dob) {
    for (const pattern of dobWithPrefixFlexiblePatterns) {
      const matches = dobGenderText.matchAll(new RegExp(pattern.source, 'gi'));
      for (const dobMatch of matches) {
        if (dobMatch[1] && dobMatch[2] && dobMatch[3]) {
          const dobStr = extractAndValidateDOB(dobMatch[1], dobMatch[2], dobMatch[3]);
          if (dobStr) {
            info.dob = dobStr;
            const dob = new Date(parseInt(dobMatch[3]), parseInt(dobMatch[2]) - 1, parseInt(dobMatch[1]));
            const now = new Date();
            let age = now.getFullYear() - dob.getFullYear();
            if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) {
              age--;
            }
            if (age > 0 && age < 150) {
              info.age = `${age} वर्षे`;
            }
            Logger.info('OCR_DOB_FOUND', {
              region: 'DOB_GENDER_REGION',
              method: 'PREFIX_FLEXIBLE',
              dob: dobStr,
              age: info.age
            });
            break;
          }
        }
      }
      if (info.dob) break;
    }
  }

  // Priority 3: Standalone date patterns (ONLY in DOB_GENDER_REGION as last resort)
  if (!info.dob) {
    Logger.info('OCR_DOB_FALLBACK', {
      region: 'DOB_GENDER_REGION',
      method: 'STANDALONE_DATE',
      note: 'Using standalone pattern as last resort in DOB_GENDER_REGION only'
    });
    for (const pattern of standaloneDatePatterns) {
      const matches = dobGenderText.matchAll(new RegExp(pattern.source, 'gi'));
      for (const dobMatch of matches) {
        if (dobMatch[1] && dobMatch[2] && dobMatch[3]) {
          const dobStr = extractAndValidateDOB(dobMatch[1], dobMatch[2], dobMatch[3]);
          if (dobStr) {
            info.dob = dobStr;
            const dob = new Date(parseInt(dobMatch[3]), parseInt(dobMatch[2]) - 1, parseInt(dobMatch[1]));
            const now = new Date();
            let age = now.getFullYear() - dob.getFullYear();
            if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) {
              age--;
            }
            if (age > 0 && age < 150) {
              info.age = `${age} वर्षे`;
            }
            Logger.info('OCR_DOB_FOUND', {
              region: 'DOB_GENDER_REGION',
              method: 'STANDALONE_DATE',
              dob: dobStr,
              age: info.age
            });
            break;
          }
        }
      }
      if (info.dob) break;
    }
  }

  // Fallback to full text if not found in DOB_GENDER_REGION (ONLY with prefix patterns)
  if (!info.dob) {
    Logger.info('OCR_DOB_FALLBACK', {
      region: 'FULL_TEXT',
      method: 'PREFIX_ONLY',
      note: 'Searching full text with prefix patterns only'
    });

    // Try prefix patterns in full text
    for (const pattern of [...dobWithPrefixPatterns, ...dobWithPrefixFlexiblePatterns]) {
      const matches = cleanText.matchAll(new RegExp(pattern.source, 'gi'));
      for (const dobMatch of matches) {
        if (dobMatch[1] && dobMatch[2] && dobMatch[3]) {
          const dobStr = extractAndValidateDOB(dobMatch[1], dobMatch[2], dobMatch[3]);
          if (dobStr) {
            info.dob = dobStr;
            const dob = new Date(parseInt(dobMatch[3]), parseInt(dobMatch[2]) - 1, parseInt(dobMatch[1]));
            const now = new Date();
            let age = now.getFullYear() - dob.getFullYear();
            if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) {
              age--;
            }
            if (age > 0 && age < 150) {
              info.age = `${age} वर्षे`;
            }
            Logger.info('OCR_DOB_FOUND', {
              region: 'FULL_TEXT',
              method: 'PREFIX_PATTERN',
              dob: dobStr,
              age: info.age
            });
            break;
          }
        }
      }
      if (info.dob) break;
    }
  }

  if (!info.dob) {
    Logger.info('OCR_DOB_NOT_FOUND', {
      dobGenderRegion: dobGenderText.substring(0, 150),
      fullTextPreview: cleanText.substring(0, 300),
      note: 'No DOB found with prefix patterns. Ensure Aadhaar card has DOB prefix visible.'
    });
  }

  // Extract Name - prioritize NAME_REGION
  const namePatterns = [
    /(?:Name|नाव|NAME)[:\s/]*([^\n]+?)(?:\n[^\n]*?(?:DOB|जन्म|Gender|लिंग|Address|पत्ता|Aadhaar|आधार|$|\d{1,2}[-/]\d{1,2}[-/]\d{4}))/i,
    // Try to find name before DOB/Gender markers
    /^([A-Z][A-Za-z\s]{2,50}?)(?:\s+(?:DOB|जन्म|Gender|लिंग|\d{1,2}[-/]\d{1,2}[-/]\d{4}))/im,
    // Look for capitalized text at the start (typical name format)
    /^([A-Z][A-Za-z\s]{2,50}?)(?:\s*\n|\s+(?:\/|M|F|\d))/m,
  ];

  // First try NAME_REGION (most accurate)
  for (const namePattern of namePatterns) {
    const nameMatch = nameText.match(namePattern);
    if (nameMatch && nameMatch[1]) {
      let nameTextValue = nameMatch[1].trim();

      const cleanedLines = nameTextValue
        .split('\n')
        .map(l => l.trim())
        .filter(l => {
          const lower = l.toLowerCase();
          return l &&
            l.length >= 2 &&
            l.length <= 80 &&
            !lower.includes('dob') &&
            !lower.includes('जन्म') &&
            !lower.includes('gender') &&
            !lower.includes('लिंग') &&
            !lower.includes('date') &&
            !lower.includes('print') &&
            !lower.includes('government') &&
            !lower.includes('india') &&
            !lower.includes('www.') &&
            !lower.includes('@') &&
            !lower.includes('aadhaar') &&
            !lower.includes('आधार');
        });

      if (cleanedLines.length > 0) {
        const cleanedName = cleanedLines[0];
        if (/[A-Za-zअ-ह]/.test(cleanedName)) {
          info.name = cleanedName;
          break;
        }
      }
    }
  }

  // If no name found, try extracting from first line of NAME_REGION (usually the name)
  if (!info.name && nameText) {
    const lines = nameText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    for (const line of lines.slice(0, 3)) {
      const lower = line.toLowerCase();
      if (line.length >= 2 &&
        line.length <= 80 &&
        !lower.includes('dob') &&
        !lower.includes('जन्म') &&
        !lower.includes('gender') &&
        !lower.includes('लिंग') &&
        !lower.includes('date') &&
        !lower.includes('print') &&
        !lower.includes('government') &&
        !lower.includes('india') &&
        /[A-Za-zअ-ह]/.test(line)) {
        info.name = line;
        break;
      }
    }
  }

  // Fallback to full text if not found
  if (!info.name) {
    for (const namePattern of namePatterns) {
      const nameMatch = cleanText.match(namePattern);
      if (nameMatch && nameMatch[1]) {
        let nameTextValue = nameMatch[1].trim();

        const cleanedLines = nameTextValue
          .split('\n')
          .map(l => l.trim())
          .filter(l => {
            const lower = l.toLowerCase();
            return l &&
              l.length >= 2 &&
              l.length <= 80 &&
              !lower.includes('dob') &&
              !lower.includes('जन्म') &&
              !lower.includes('gender') &&
              !lower.includes('लिंग') &&
              !lower.includes('date') &&
              !lower.includes('print') &&
              !lower.includes('government') &&
              !lower.includes('india') &&
              !lower.includes('www.') &&
              !lower.includes('@') &&
              !lower.includes('aadhaar') &&
              !lower.includes('आधार');
          });

        if (cleanedLines.length > 0) {
          const cleanedName = cleanedLines[0];
          if (/[A-Za-zअ-ह]/.test(cleanedName)) {
            info.name = cleanedName;
            break;
          }
        }
      }
    }
  }

  // Extract Address (simplified - full implementation would be more complex)
  const addressPattern = /(?:Address|पत्ता|ADDRESS)[:\s]*([^\n]+(?:\n[^\n]+){0,10})/i;
  const addressMatch = cleanedForAddressScan.match(addressPattern);
  if (addressMatch && addressMatch[1]) {
    const addressLines = addressMatch[1]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && l.length >= 3 && l.length < 150)
      .filter(l => {
        const lower = l.toLowerCase();
        // Exclude boilerplate/non-address content
        return !lower.includes('note:') &&
          !lower.includes('children on attaining') &&
          !lower.includes('biometric information') &&
          !lower.includes('establish identity') &&
          !lower.includes('authenticate online') &&
          !lower.includes('services in future') &&
          !lower.includes('government') &&
          !lower.includes('india') &&
          !lower.includes('aadhaar') &&
          !lower.includes('आधार');
      })
      // Remove phone-like numbers from address lines
      .map(l => l.replace(/\b\+?\d{10,}\b/g, '').replace(/\s{2,}/g, ' ').replace(/^,|,$/g, '').trim())
      .slice(0, 10);

    if (addressLines.length > 0) {
      info.address = addressLines.join(', ');
    }
  }

  return info;
}

export function extractUDIDInfo(ocrText: string): UDIDInfo {
  const info: UDIDInfo = {};
  const upperText = ocrText.toUpperCase().replace(/\s+/g, ' ');

  // Extract UDID number
  const udidPatterns = [
    /UDID[/\s-]?([A-Z]{2})[\s-]?(\d{2}[\s-]?\d{11})/,
    /UDID[/\s-]?([A-Z]{2})(\d{13})/,
    /([A-Z]{2})(\d{2}[\s-]?\d{11})/,
    /([A-Z]{2})(\d{13})/,
  ];

  for (const pattern of udidPatterns) {
    const match = upperText.match(pattern);
    if (match && match[1] && match[2]) {
      const stateCode = match[1].replace(/[^A-Z]/g, '');
      const digits = match[2].replace(/\D/g, '');
      if (stateCode.length === 2 && digits.length === 13) {
        info.udid = `${stateCode}${digits}`;
        break;
      }
    }
  }

  // Extract Disability Type
  const disabilityPatterns = [
    /(?:DISABILITY|TYPE|दिव्यांगता|विकलांगता|प्रकार)[:\s-]*([A-Z][^,\n]{5,60})/i,
    /\b(Blindness|Low[-\s]?vision|Hearing[-\s]?Impairment|Deaf|Speech[-\s]?and[-\s]?Language|Locomotor[-\s]?Disability|Mental[-\s]?Illness|Cerebral[-\s]?Palsy|Autism|Multiple[-\s]?Disabilities|Leprosy|Dwarfism|Intellectual[-\s]?Disability|Muscular[-\s]?Dystrophy|Neurological|Sclerosis|Thalassemia|Hemophilia|Sickle[-\s]?Cell|Parkinson)\b/i,
    /\b(अंध|दृष्टिदोष|कर्णबधिर|बधिर|वाचादोष|अस्थिव्यंग|मानसिक|मेंदूचा[-\s]?पक्षाघात|सेरेब्रल[-\s]?पालसी|स्वमग्न|बहुविकलांग|कुष्ठरोग|बुटकेपणा|मतिमंद|अविकसित[-\s]?मांसपेशी|मज्जासंस्थेचे|अध्ययन[-\s]?अक्षमता)\b/i,
  ];

  for (const pattern of disabilityPatterns) {
    const match = ocrText.match(pattern);
    if (match && match[1]) {
      const disabilityText = match[1].trim();
      if (disabilityText.length > 3 && disabilityText.length < 100) {
        info.disability_type = normalizeDisabilityType(disabilityText);
        break;
      }
    }
  }

  // Extract Disability Percentage
  const percentagePatterns = [
    /(?:PERCENTAGE|PERCENT|%|टक्केवारी)[:\s-]*(\d{1,3})%?/i,
    /(\d{1,3})[%\s]*(?:PERCENTAGE|PERCENT|टक्केवारी|DISABILITY)/i,
    /DISABILITY[:\s-]*\d*[:\s-]*(\d{1,3})%?/i,
  ];

  for (const pattern of percentagePatterns) {
    const match = ocrText.match(pattern);
    if (match && match[1]) {
      const percentage = parseInt(match[1]);
      if (percentage >= 1 && percentage <= 100) {
        info.disability_percentage = `${percentage}%`;
        break;
      }
    }
  }

  // Extract Validity Date
  if (ocrText.toLowerCase().includes('permanent') &&
    (ocrText.toLowerCase().includes('valid') || ocrText.toLowerCase().includes('वैध'))) {
    info.validity_date = 'Permanent';
  } else {
    const validityPatterns = [
      /(?:VALID|VALIDITY|VALID\s+Upto|VALID\s+UPTO|वैध)[:\s-]*(\d{1,2}[-/\s]\d{1,2}[-/\s]\d{4})/i,
      /(?:VALID|VALIDITY|वैध).{0,30}?(\d{1,2}[-/\s]\d{1,2}[-/\s]\d{4})/i,
    ];

    for (const pattern of validityPatterns) {
      const match = ocrText.match(pattern);
      if (match && match[1]) {
        info.validity_date = match[1].trim();
        break;
      }
    }
  }

  // Extract Issue Date (handle OCR typo "lssue" for "Issue")
  const issuePatterns = [
    /(?:DATE\s+OF\s+ISSUE|ISSUE\s+DATE|Date\s+of\s+Issue|lssue\s+Date|जारी|मिळाल्याची)[:\s-]*(\d{1,2}[-/\s]\d{1,2}[-/\s]\d{4})/i,
    /(?:ISSUE|lssue|जारी|मिळाल्याची).{0,30}?(\d{1,2}[-/\s]\d{1,2}[-/\s]\d{4})/i,
  ];

  for (const pattern of issuePatterns) {
    const match = ocrText.match(pattern);
    if (match && match[1]) {
      info.issue_date = match[1].trim();
      break;
    }
  }

  return info;
}

function normalizeDisabilityType(text: string): string {
  const disabilityMap: Record<string, string> = {
    'blindness': 'Blindness',
    'low vision': 'Low Vision',
    'hearing impairment': 'Hearing Impairment',
    'deaf': 'Hearing Impairment',
    'locomotor': 'Locomotor Disability',
    'mental illness': 'Mental Illness',
    'cerebral palsy': 'Cerebral Palsy',
    'autism': 'Autism',
    'multiple disabilities': 'Multiple Disabilities',
    'leprosy': 'Leprosy',
    'अंध': 'Blindness',
    'दृष्टिदोष': 'Low Vision',
    'कर्णबधिर': 'Hearing Impairment',
    'अस्थिव्यंग': 'Locomotor Disability',
    'मानसिक': 'Mental Illness',
  };

  const lowerText = text.toLowerCase().trim();
  for (const [key, value] of Object.entries(disabilityMap)) {
    if (lowerText.includes(key)) {
      return value;
    }
  }

  return text;
}

