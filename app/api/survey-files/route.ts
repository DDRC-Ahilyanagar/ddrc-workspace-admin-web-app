import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { Logger } from '@/lib/logger';
import { getDbConfig } from '@/lib/db';

export async function POST(request: NextRequest) {
  let connection: mysql.PoolConnection | null = null;
  try {
    const body = await request.json();
    const { aadhaar_id, user_id, file_type, file_path } = body;

    if (!aadhaar_id || !user_id || !file_type || !file_path) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: aadhaar_id, user_id, file_type, file_path' },
        { status: 400 }
      );
    }

    // Validate file_type enum
    const validTypes = ['aadhaar_front', 'aadhaar_back', 'udid', 'certificate', 'other'];
    if (!validTypes.includes(file_type)) {
      return NextResponse.json(
        { ok: false, error: `Invalid file_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const pool = mysql.createPool(getDbConfig());
    connection = await pool.getConnection();

    // Ensure survey_files table exists
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS survey_files (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        aadhaar_id BIGINT UNSIGNED NOT NULL,
        file_type ENUM('aadhaar_front','aadhaar_back','udid','certificate','other') NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user_id (user_id),
        KEY idx_aadhaar_id (aadhaar_id),
        KEY idx_file_type (file_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Insert file record
    const [result] = await connection.execute(
      `INSERT INTO survey_files (user_id, aadhaar_id, file_type, file_path)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE file_path = VALUES(file_path), updated_at = CURRENT_TIMESTAMP`,
      [user_id, aadhaar_id, file_type, file_path]
    );

    const insertId = (result as any).insertId;

    Logger.info('survey_file_saved', {
      file_id: insertId,
      aadhaar_id,
      user_id,
      file_type,
      file_path,
    });

    return NextResponse.json({
      ok: true,
      file_id: insertId,
      message: 'File record saved successfully',
    });
  } catch (error: any) {
    Logger.error('survey_file_save_error', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

