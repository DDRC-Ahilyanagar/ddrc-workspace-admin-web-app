import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { validateAadhar } from '@/lib/validation';
import * as fs from 'fs/promises';
import path from 'path';

/**
 * Create Aadhar record for public form (no OCR)
 * Organizes files in uploads/<divyang_name>-<aadhar_no>/ folder structure
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const aadharNo = (body.aadhar_no || '').trim();
    const divyangName = (body.divyang_name || '').trim();
    const frontImageUrl = body.front_image || null;
    const backImageUrl = body.back_image || null;

    if (!aadharNo || !divyangName) {
      return NextResponse.json(
        { ok: false, error: 'Aadhar number and divyang name are required' },
        { status: 422 }
      );
    }

    if (!validateAadhar(aadharNo)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid Aadhar number format. Must be 12 digits.' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    const connection = await pool.getConnection();

    try {
      // Ensure table exists
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS survey_aadhar (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          aadhar_no VARCHAR(20) NOT NULL,
          user_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
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
      const columnsToAdd = [
        { name: 'front_image', type: 'TEXT NULL' },
        { name: 'back_image', type: 'TEXT NULL' },
        { name: 'holder_name', type: 'VARCHAR(255) NULL' },
        { name: 'address_text', type: 'TEXT NULL' },
        { name: 'pincode', type: 'VARCHAR(10) NULL' },
        { name: 'taluka', type: 'VARCHAR(100) NULL' },
        { name: 'district', type: 'VARCHAR(100) NULL' },
        { name: 'updated_at', type: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' },
      ];

      for (const col of columnsToAdd) {
        try {
          await connection.execute(`ALTER TABLE survey_aadhar ADD COLUMN ${col.name} ${col.type}`);
        } catch (e: any) {
          if (!e.message.includes('Duplicate column')) throw e;
        }
      }

      // Sanitize name for folder structure
      const safeName = divyangName
        .replace(/[^A-Za-z0-9 _-]/g, '')
        .replace(/\s+/g, '_')
        .trim() || 'UNKNOWN';

      const digits = aadharNo.replace(/\D+/g, '') || 'NA';
      const folderName = `${safeName}-${digits}`;
      const baseDir = path.join(process.cwd(), 'public', 'uploads');
      const targetDir = path.join(baseDir, folderName);

      // Ensure folder exists
      await fs.mkdir(targetDir, { recursive: true });

      // If images are provided as URLs, download and organize them
      let finalFrontImage = frontImageUrl;
      let finalBackImage = backImageUrl;

      if (frontImageUrl && (frontImageUrl.startsWith('http://') || frontImageUrl.startsWith('https://'))) {
        try {
          const res = await fetch(frontImageUrl);
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            const frontPath = path.join(targetDir, 'front.jpg');
            await fs.writeFile(frontPath, buf);
            finalFrontImage = `/uploads/${folderName}/front.jpg`;
          }
        } catch (e: any) {
          Logger.error('PUBLIC_CREATE_AADHAR_DOWNLOAD_FRONT_FAILED', { error: e.message });
        }
      }

      if (backImageUrl && (backImageUrl.startsWith('http://') || backImageUrl.startsWith('https://'))) {
        try {
          const res = await fetch(backImageUrl);
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            const backPath = path.join(targetDir, 'back.jpg');
            await fs.writeFile(backPath, buf);
            finalBackImage = `/uploads/${folderName}/back.jpg`;
          }
        } catch (e: any) {
          Logger.error('PUBLIC_CREATE_AADHAR_DOWNLOAD_BACK_FAILED', { error: e.message });
        }
      }

      // Insert or update Aadhar record (prevents duplicates via UNIQUE constraint)
      let aadharId: number;
      try {
        const [result] = await connection.execute(
          `INSERT INTO survey_aadhar (aadhar_no, user_id, front_image, back_image, holder_name, created_at, updated_at)
           VALUES (?, 1, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE 
             front_image = COALESCE(?, front_image),
             back_image = COALESCE(?, back_image),
             holder_name = COALESCE(?, holder_name),
             updated_at = NOW()`,
          [aadharNo, finalFrontImage, finalBackImage, divyangName, finalFrontImage, finalBackImage, divyangName]
        );

        if ((result as any).insertId) {
          aadharId = (result as any).insertId;
        } else {
          // ON DUPLICATE KEY UPDATE was triggered - fetch existing ID
          const [existing] = await connection.execute(
            `SELECT id FROM survey_aadhar WHERE aadhar_no = ? LIMIT 1`,
            [aadharNo]
          );
          if (Array.isArray(existing) && (existing as any[]).length > 0) {
            aadharId = (existing as any[])[0]?.id;
            Logger.info('PUBLIC_CREATE_AADHAR_EXISTING_UPDATED', {
              aadharId,
              aadharNo,
              holderName: divyangName,
            });
          } else {
            throw new Error('Failed to retrieve Aadhar ID after insert/update');
          }
        }
      } catch (insertError: any) {
        // Handle duplicate key error (shouldn't happen with ON DUPLICATE KEY UPDATE, but just in case)
        if (insertError.code === 'ER_DUP_ENTRY' || insertError.message?.includes('Duplicate entry')) {
          Logger.info('PUBLIC_CREATE_AADHAR_DUPLICATE_DETECTED', { aadharNo });
          const [existing] = await connection.execute(
            `SELECT id FROM survey_aadhar WHERE aadhar_no = ? LIMIT 1`,
            [aadharNo]
          );
          if (Array.isArray(existing) && (existing as any[]).length > 0) {
            aadharId = (existing as any[])[0]?.id;
            // Update the record with new data
            await connection.execute(
              `UPDATE survey_aadhar 
               SET front_image = COALESCE(?, front_image),
                   back_image = COALESCE(?, back_image),
                   holder_name = COALESCE(?, holder_name),
                   updated_at = NOW()
               WHERE id = ?`,
              [finalFrontImage, finalBackImage, divyangName, aadharId]
            );
          } else {
            throw new Error('Aadhar record exists but could not be retrieved');
          }
        } else {
          throw insertError;
        }
      }

      Logger.info('PUBLIC_CREATE_AADHAR_SUCCESS', {
        aadharId,
        aadharNo,
        holderName: divyangName,
        folderName,
      });

      return NextResponse.json({
        ok: true,
        aadhar_id: aadharId,
        folder: folderName,
        front_image: finalFrontImage,
        back_image: finalBackImage,
      });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    Logger.error('PUBLIC_CREATE_AADHAR_ERROR', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

