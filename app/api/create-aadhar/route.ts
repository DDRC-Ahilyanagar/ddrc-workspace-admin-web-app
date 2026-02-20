export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { validateAadhar, validateRequest } from '@/lib/validation';
import { requireAuth, verifyAuth } from '@/lib/auth';
import * as fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { NextResponse as _ } from 'next/server';
import { logTestUserActivity } from '@/lib/test-logger';

async function handleCreate(request: NextRequest, user?: any) {
  try {
    const body = await request.json();
    let aadharNo = (body.aadhar_no || '').trim();
    const hasNoAadhar = body.has_no_aadhar === true;
    const phone = (body.phone || '').trim();

    // Use authenticated user ID if available, otherwise use user_id from body or default to 1
    const userId = user?.id || body.user_id || 1;
    const userPhoneHeader = user?.phone || '';
    const bodyPhone = body.user_phone || '';
    const userPhone = userPhoneHeader || bodyPhone;

    // Log activity for test user tracking (Google Play review)
    if (userPhone === '7777777777') {
      await logTestUserActivity(userPhone, 'AADHAR_CREATION_STARTED', {
        aadhar_no: aadharNo ? (aadharNo.substring(0, 4) + '****') : 'HIDDEN',
        has_no_aadhar: hasNoAadhar
      });
    }

    const frontImage = body.front_image || null;
    const backImage = body.back_image || null;

    if (hasNoAadhar) {
      // Validate phone number instead of Aadhaar
      if (!/^\d{10}$/.test(phone)) {
        return NextResponse.json(
          { ok: false, error: 'Valid 10-digit phone number is required when Aadhaar is not available' },
          { status: 422 }
        );
      }
      // Generate a unique placeholder for Aadhaar No
      aadharNo = `PH-${phone}`;
    } else {
      // Standard Aadhaar validation
      const validation = validateRequest(body, {
        aadhar_no: (a) => validateAadhar(a || ''),
      });

      if (!validation.valid) {
        return NextResponse.json(
          { ok: false, error: validation.errors.join(', ') || 'Valid aadhar_no required' },
          { status: 422 }
        );
      }
    }

    const pool = getDbPool();
    const connection = await pool.getConnection();

    try {
      // Create table if not exists
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS survey_aadhar (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          aadhar_no VARCHAR(20) NOT NULL,
          user_id BIGINT UNSIGNED NOT NULL,
          front_image TEXT NULL,
          back_image TEXT NULL,
          holder_name VARCHAR(255) NULL,
          address_text TEXT NULL,
          pincode VARCHAR(10) NULL,
          taluka VARCHAR(100) NULL,
          district VARCHAR(100) NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY unique_aadhar (aadhar_no)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // Add columns if they don't exist
      try {
        await connection.execute(`ALTER TABLE survey_aadhar ADD COLUMN front_image TEXT NULL`);
      } catch (e: any) {
        if (!e.message.includes('Duplicate column')) throw e;
      }

      try {
        await connection.execute(`ALTER TABLE survey_aadhar ADD COLUMN back_image TEXT NULL`);
      } catch (e: any) {
        if (!e.message.includes('Duplicate column')) throw e;
      }

      try {
        await connection.execute(`ALTER TABLE survey_aadhar ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
      } catch (e: any) {
        if (!e.message.includes('Duplicate column')) throw e;
      }

      try {
        await connection.execute(`ALTER TABLE survey_aadhar ADD COLUMN holder_name VARCHAR(255) NULL`);
      } catch (e: any) {
        if (!e.message.includes('Duplicate column')) throw e;
      }
      try { await connection.execute(`ALTER TABLE survey_aadhar ADD COLUMN address_text TEXT NULL`); } catch (e: any) { if (!e.message.includes('Duplicate column')) throw e; }
      try { await connection.execute(`ALTER TABLE survey_aadhar ADD COLUMN pincode VARCHAR(10) NULL`); } catch (e: any) { if (!e.message.includes('Duplicate column')) throw e; }
      try { await connection.execute(`ALTER TABLE survey_aadhar ADD COLUMN taluka VARCHAR(100) NULL`); } catch (e: any) { if (!e.message.includes('Duplicate column')) throw e; }
      try { await connection.execute(`ALTER TABLE survey_aadhar ADD COLUMN district VARCHAR(100) NULL`); } catch (e: any) { if (!e.message.includes('Duplicate column')) throw e; }
      try { await connection.execute(`ALTER TABLE survey_aadhar ADD COLUMN gender VARCHAR(20) NULL`); } catch (e: any) { if (!e.message.includes('Duplicate column')) throw e; }
      try { await connection.execute(`ALTER TABLE survey_aadhar ADD COLUMN dob VARCHAR(20) NULL`); } catch (e: any) { if (!e.message.includes('Duplicate column')) throw e; }

      // Insert or update
      const [result] = await connection.execute(
        `INSERT INTO survey_aadhar (aadhar_no, user_id, front_image, back_image, holder_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, NOW(), NOW())
         ON DUPLICATE KEY UPDATE 
           user_id = VALUES(user_id),
           front_image = COALESCE(?, front_image),
           back_image = COALESCE(?, back_image),
           updated_at = NOW()`,
        [aadharNo, userId, frontImage, backImage, frontImage, backImage]
      );

      let aadharId: number;
      if ((result as any).insertId) {
        aadharId = (result as any).insertId;
      } else {
        const [existing] = await connection.execute(
          `SELECT id FROM survey_aadhar WHERE aadhar_no = ?`,
          [aadharNo]
        );
        aadharId = (existing as any[])[0]?.id;
      }

      // LOG ACTIVITY: Started New Survey / Created Aadhaar
      try {
        await connection.execute(
          `INSERT INTO survey_activity_logs (user_id, type, taluka, village, aadhaar_id, details) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            userId,
            'SURVEY_STARTED',
            body.taluka || null,
            body.village || null,
            aadharId,
            JSON.stringify({
              aadhar_no: aadharNo,
              action: 'create_aadhar'
            })
          ]
        );
      } catch (logError) {
        Logger.error('ACTIVITY_LOG_CREATE_AADHAAR_FAILED', { error: (logError as any).message });
      }

      // Try OCR to extract fields and stage files; accumulate for response
      let extractedName: string | null = null;
      let extractedGender: string | null = null;
      let extractedDob: string | null = null;
      let extractedAddress: string | null = null;
      let extractedPincode: string | null = null;
      let extractedTaluka: string | null = null;
      let extractedDistrict: string | null = null;
      try {
        const digits = aadharNo.replace(/\D+/g, '');
        let extractedNameLocal = '';
        // Download images locally first
        const downloads: { filePath: string, url: string }[] = [];
        const baseDir = path.join(process.cwd(), 'public', 'uploads');
        await fs.mkdir(baseDir, { recursive: true });
        const tempDir = path.join(baseDir, `tmp_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
        await fs.mkdir(tempDir, { recursive: true });

        async function downloadTo(fileUrl: string, fileName: string) {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error('download_failed');
          const arrayBuf = await res.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          const outPath = path.join(tempDir, fileName);
          await fs.writeFile(outPath, buf);
          downloads.push({ filePath: outPath, url: fileUrl });
        }

        if (frontImage) await downloadTo(frontImage, 'front.jpg');
        if (backImage) await downloadTo(backImage, 'back.jpg');

        // OCR processing removed as per refactor to prevent build hangs
        let text = '';

        if (text) {
          try {
            // Extract name heuristics: look for lines before Aadhaar or after labels like Name/नाम
            const nameMatch = /Name[:\-]?\s*([A-Za-z ]{3,})/i.exec(text) || /नाम[:\-]?\s*([A-Za-z ]{3,})/i.exec(text);
            if (nameMatch) extractedNameLocal = nameMatch[1].trim();
            // If not found, take first reasonable capitalized sequence
            if (!extractedNameLocal) {
              const cand = (text.match(/[A-Z][a-z]+\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?/) || [])[0];
              if (cand) extractedNameLocal = cand.trim();
            }

            // Marathi extraction heuristic
            // Split original (not space-collapsed) lines to preserve order
            const rawLines = text.split(/\n+/).map((l: string) => l.trim()).filter(Boolean as any);
            let marathiName: string | null = null;
            // 1) Look for line after label containing 'नाव' or 'नाम'
            for (let i = 0; i < rawLines.length; i++) {
              const ln = rawLines[i];
              if (/\b(नाव|नाम)\b/.test(ln)) {
                const next = rawLines[i + 1]?.trim();
                if (next && /[\u0900-\u097F]/.test(next)) { marathiName = next; break; }
              }
            }
            // 2) Otherwise pick the first line with majority Devanagari letters
            if (!marathiName) {
              for (const ln of rawLines) {
                const devCount = (ln.match(/[\u0900-\u097F]/g) || []).length;
                if (devCount >= Math.max(4, Math.floor(ln.length * 0.4))) { marathiName = ln; break; }
              }
            }
            if (marathiName) {
              marathiName = marathiName.replace(/[^\u0900-\u097Fa-zA-Z\s]/g, '').trim();
              if (marathiName.length >= 3) extractedNameLocal = marathiName;
            }

            // Extract gender (labels often absent; search direct values)
            let gender: string | null = null;
            const g = text.match(/\b(FEMALE|MALE|F|M)\b/i);
            if (g) {
              const gv = g[1].toUpperCase();
              gender = gv === 'M' ? 'Male' : gv === 'F' ? 'Female' : gv.charAt(0) + gv.slice(1).toLowerCase();
            }
            // Extract DOB (dd/mm/yyyy or yyyy-mm-dd)
            let dob: string | null = null;
            const d1 = text.match(/\b(\d{2})[\/-](\d{2})[\/-](\d{4})\b/);
            const d2 = text.match(/\b(\d{4})[\/-](\d{2})[\/-](\d{2})\b/);
            if (d1) {
              const dd = d1[1], mm = d1[2], yy = d1[3];
              dob = `${yy}-${mm}-${dd}`;
            } else if (d2) {
              dob = `${d2[1]}-${d2[2]}-${d2[3]}`;
            }
            // Persist these if available
            await connection.execute(
              `UPDATE survey_aadhar SET holder_name = COALESCE(?, holder_name), gender = COALESCE(?, gender), dob = COALESCE(?, dob) WHERE id = ?`,
              [extractedNameLocal || null, gender, dob, aadharId]
            );
            extractedName = extractedNameLocal || null;
            extractedGender = gender;
            extractedDob = dob;
          } catch (parseError: any) {
            Logger.error('create_aadhar_parse_ocr_failed', { error: parseError.message });
          }
        }

        // Fallback name
        if (!extractedNameLocal) extractedNameLocal = 'UNKNOWN';
        const safeName = extractedNameLocal.replace(/[^A-Za-z0-9 _-]/g, '').replace(/\s+/g, '_');
        const folderName = `${safeName}-${digits || 'NA'}`;
        const targetDir = path.join(baseDir, folderName);
        await fs.mkdir(targetDir, { recursive: true });
        // Move temp files into target dir
        for (const f of downloads) {
          const fileName = path.basename(f.filePath);
          const dest = path.join(targetDir, fileName);
          await fs.rename(f.filePath, dest).catch(async () => {
            // fallback copy
            const b = await fs.readFile(f.filePath);
            await fs.writeFile(dest, b);
          });
        }
        // Cleanup temp dir
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });

        // Update holder_name if we found something
        if (extractedNameLocal && extractedNameLocal !== 'UNKNOWN') {
          await connection.execute(`UPDATE survey_aadhar SET holder_name = ? WHERE id = ?`, [extractedNameLocal, aadharId]);
        }

        // OCR back for address - use lib/ocr.ts which has better error handling
        try {
          if (backImage) {
            // OCR processing removed
            let raw = '';

            if (raw) {
              try {
                // Extract pincode (6 digits)
                const pinMatch = raw.match(/\b(\d{6})\b/);
                const pincode = pinMatch ? pinMatch[1] : null;
                // Heuristic: find address even when no label is present
                const lines = raw.split(/\n+/).map((l: string) => l.trim()).filter(Boolean as any);
                const addrCandidates = lines.filter((l: string) => {
                  // Prefer lines with Devanagari or common address terms
                  const hasDevanagari = /[\u0900-\u097F]/.test(l);
                  const hasAddressTerms = /(address|to|resident|gaon|galli|road|nagar|taluk|taluka|district|post|village|ward|near|behind)/i.test(l);
                  // Many Aadhaar back sides list address in 3-6 consecutive lines; include medium-length lines
                  const plausibleLen = l.length >= 4 && l.length <= 80;
                  return plausibleLen && (hasDevanagari || hasAddressTerms);
                });
                const addressText = (addrCandidates.length > 0 ? addrCandidates.join(', ') : lines.slice(Math.max(0, lines.length - 6)).join(', ')).slice(0, 1000);
                // Try infer taluka/district keywords
                let taluka: string | null = null;
                let district: string | null = null;
                for (const l of lines) {
                  const t = l.match(/taluka\s*[:\-]?\s*([A-Za-z ]{3,})/i);
                  if (t && !taluka) taluka = t[1].trim();
                  const d = l.match(/district\s*[:\-]?\s*([A-Za-z ]{3,})/i);
                  if (d && !district) district = d[1].trim();
                }
                await connection.execute(
                  `UPDATE survey_aadhar SET address_text = COALESCE(?, address_text), pincode = COALESCE(?, pincode), taluka = COALESCE(?, taluka), district = COALESCE(?, district) WHERE id = ?`,
                  [(addressText && addressText.trim().length > 3) ? addressText : null, pincode, taluka, district, aadharId]
                );
                extractedAddress = (addressText && addressText.trim().length > 3) ? addressText : null;
                extractedPincode = pincode;
                extractedTaluka = taluka;
                extractedDistrict = district;
              } catch (parseError: any) {
                Logger.error('create_aadhar_parse_address_failed', { error: parseError.message });
              }
            }
          }
        } catch (e: any) {
          Logger.error('create_aadhar_address_ocr_failed', { error: e.message });
        }
      } catch (e: any) {
        Logger.error('create_aadhar_ocr_or_store_failed', { error: e.message });
      }

      // Log successful creation for test user
      if (userPhone === '7777777777') {
        await logTestUserActivity(userPhone, 'AADHAR_CREATION_SUCCESS', {
          aadhar_id: aadharId,
          extracted_name: extractedName
        });
      }

      return NextResponse.json({
        ok: true,
        aadhar_id: aadharId,
        extracted: {
          name: extractedName || null,
          gender: extractedGender,
          dob: extractedDob,
          address: extractedAddress,
          pincode: extractedPincode,
          taluka: extractedTaluka,
          district: extractedDistrict,
        }
      });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    Logger.error('create_aadhar_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// Make authentication optional for Aadhaar creation (can be created before full login)
export async function POST(request: NextRequest) {
  // Try to extract user from token if available, but don't require auth
  let user = null;
  try {
    const { user: authUser } = await verifyAuth(request);
    user = authUser;
  } catch (e) {
    // Auth not required, continue without user
  }

  return await handleCreate(request, user);
}


