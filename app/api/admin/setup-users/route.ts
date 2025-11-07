import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const pool = getDbPool();
    const conn = await pool.getConnection();
    try {
      // Create user_types table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS user_types (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_type VARCHAR(100) NOT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          created_by BIGINT UNSIGNED NULL,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          updated_by BIGINT UNSIGNED NULL,
          status ENUM('active', 'inactive') DEFAULT 'active',
          PRIMARY KEY (id),
          UNIQUE KEY unique_user_type (user_type),
          KEY idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // Check if user_types need seeding
      const [typeCount]: any = await conn.query('SELECT COUNT(*) AS c FROM user_types');
      const hasTypes = (typeCount as any[])[0]?.c > 0;

      if (!hasTypes) {
        // Seed user_types
        await conn.query(`
          INSERT INTO user_types (user_type, status, created_at, updated_at) VALUES
          ('Field officer', 'active', NOW(), NOW()),
          ('admin', 'active', NOW(), NOW()),
          ('practitioner', 'active', NOW(), NOW())
        `);
        Logger.info('user_types_seeded', { count: 3 });
      }

      // Get user_type ids
      const [adminType]: any = await conn.query(`SELECT id FROM user_types WHERE user_type = 'admin' LIMIT 1`);
      const adminTypeId = (adminType as any[])[0]?.id || 2; // Default to 2 if not found
      const [foType]: any = await conn.query(`SELECT id FROM user_types WHERE user_type = 'Field officer' LIMIT 1`);
      const fieldOfficerTypeId = (foType as any[])[0]?.id || 1;

      // Check if users table exists
      const [tables]: any = await conn.query(
        "SHOW TABLES LIKE 'users'"
      );
      const usersTableExists = Array.isArray(tables) && tables.length > 0;

      if (!usersTableExists) {
        // Create new users table
        await conn.query(`
          CREATE TABLE users (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NULL,
            contact_number VARCHAR(20) NOT NULL,
            passkey INT NULL,
            profile_photo TEXT NULL,
            user_type_id BIGINT UNSIGNED NOT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            created_by BIGINT UNSIGNED NULL,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            updated_by BIGINT UNSIGNED NULL,
            status ENUM('active', 'inactive') DEFAULT 'active',
            PRIMARY KEY (id),
            UNIQUE KEY unique_email (email),
            UNIQUE KEY unique_contact (contact_number),
            UNIQUE KEY unique_passkey (passkey),
            KEY idx_user_type (user_type_id),
            KEY idx_status (status),
            FOREIGN KEY (user_type_id) REFERENCES user_types(id) ON DELETE RESTRICT ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      } else {
        // Table exists - add missing columns
        try {
          await conn.query('ALTER TABLE users ADD COLUMN user_type_id BIGINT UNSIGNED NULL');
        } catch (e: any) {
          if (!e.message?.includes('Duplicate column')) {}
        }
        // Handle contact_number - check if phone exists first
        try {
          const [phoneCol]: any = await conn.query("SHOW COLUMNS FROM users LIKE 'phone'");
          const [contactCol]: any = await conn.query("SHOW COLUMNS FROM users LIKE 'contact_number'");
          if (Array.isArray(phoneCol) && phoneCol.length > 0 && (!Array.isArray(contactCol) || contactCol.length === 0)) {
            // Rename phone to contact_number
            await conn.query('ALTER TABLE users CHANGE COLUMN phone contact_number VARCHAR(20)');
          } else if ((!Array.isArray(phoneCol) || phoneCol.length === 0) && (!Array.isArray(contactCol) || contactCol.length === 0)) {
            await conn.query('ALTER TABLE users ADD COLUMN contact_number VARCHAR(20) NULL');
          }
        } catch (e: any) {
          if (!e.message?.includes('Duplicate column') && !e.message?.includes('Unknown column')) {}
        }
        try {
          await conn.query('ALTER TABLE users ADD COLUMN profile_photo TEXT NULL');
        } catch (e: any) {
          if (!e.message?.includes('Duplicate column')) {}
        }
        // Add passkey column and unique index
        try {
          await conn.query('ALTER TABLE users ADD COLUMN passkey INT NULL');
        } catch (e: any) {
          if (!e.message?.includes('Duplicate column')) {}
        }
        // Ensure unique index on passkey (check first to avoid duplicate key error)
        try {
          const [idxCheck]: any = await conn.query("SHOW INDEX FROM users WHERE Key_name = 'unique_passkey'");
          if (!Array.isArray(idxCheck) || idxCheck.length === 0) {
            await conn.query('ALTER TABLE users ADD UNIQUE KEY unique_passkey (passkey)');
          }
        } catch (e: any) {
          if (!e.message?.includes('Duplicate key name') && !e.message?.includes('Duplicate column')) {
            Logger.error('passkey_index_failed', { error: e.message });
          }
        }
        try {
          await conn.query('ALTER TABLE users ADD COLUMN created_by BIGINT UNSIGNED NULL');
        } catch (e: any) {
          if (!e.message?.includes('Duplicate column')) {}
        }
        try {
          await conn.query('ALTER TABLE users ADD COLUMN updated_by BIGINT UNSIGNED NULL');
        } catch (e: any) {
          if (!e.message?.includes('Duplicate column')) {}
        }
        // Update status column if it exists as is_active
        try {
          const [cols]: any = await conn.query("SHOW COLUMNS FROM users LIKE 'status'");
          if (!Array.isArray(cols) || cols.length === 0) {
            // Check if is_active exists
            const [isActiveCol]: any = await conn.query("SHOW COLUMNS FROM users LIKE 'is_active'");
            if (Array.isArray(isActiveCol) && isActiveCol.length > 0) {
              // Add status column
              await conn.query("ALTER TABLE users ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active'");
              // Migrate data
              await conn.query("UPDATE users SET status = CASE WHEN is_active = 1 THEN 'active' ELSE 'inactive' END");
            } else {
              await conn.query("ALTER TABLE users ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active'");
            }
          }
        } catch (e: any) {
          if (!e.message?.includes('Duplicate column')) {}
        }
        // Add foreign key if not exists
        try {
          await conn.query(`
            ALTER TABLE users 
            ADD CONSTRAINT fk_user_type 
            FOREIGN KEY (user_type_id) REFERENCES user_types(id) ON DELETE RESTRICT ON UPDATE CASCADE
          `);
        } catch (e: any) {
          if (!e.message?.includes('Duplicate foreign key')) {}
        }
        // Add unique constraints if not exists
        try {
          await conn.query('ALTER TABLE users ADD UNIQUE KEY unique_email (email)');
        } catch (e: any) {
          if (!e.message?.includes('Duplicate key name')) {}
        }
        try {
          const [contactCol]: any = await conn.query("SHOW COLUMNS FROM users LIKE 'contact_number'");
          if (Array.isArray(contactCol) && contactCol.length > 0) {
            await conn.query('ALTER TABLE users ADD UNIQUE KEY unique_contact (contact_number)');
          }
        } catch (e: any) {
          if (!e.message?.includes('Duplicate key name')) {}
        }
      }

      // Normalize any old admin email to new one
      try {
        await conn.query(`UPDATE users SET email = 'utkrranti@gmail.com' WHERE email = 'utjkrranti@gmail.com'`);
      } catch {}

      // Check if admin user exists (new required admin)
      const [adminCheck]: any = await conn.query(
        `SELECT id FROM users WHERE email = ? OR contact_number = ? LIMIT 1`,
        ['utkrranti@gmail.com', '7768068585']
      );
      const adminExists = Array.isArray(adminCheck) && adminCheck.length > 0;

      if (!adminExists) {
        // Seed admin user - check if user_type_id column exists, if not use default
        try {
          await conn.query(`
            INSERT INTO users (name, email, contact_number, user_type_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'active', NOW(), NOW())
          `, [
            'Admin User',
            'utkrranti@gmail.com',
            '7768068585',
            adminTypeId
          ]);
        } catch (e: any) {
          // If user_type_id doesn't exist yet, insert without it
          if (e.message?.includes('Unknown column') || e.message?.includes('user_type_id')) {
            await conn.query(`
              INSERT INTO users (name, email, contact_number, status, created_at, updated_at)
              VALUES (?, ?, ?, 'active', NOW(), NOW())
            `, [
              'Admin User',
              'utkrranti@gmail.com',
              '7768068585'
            ]);
            // Then update user_type_id if column was added
            try {
              await conn.query('UPDATE users SET user_type_id = ? WHERE email = ?', [adminTypeId, 'utkrranti@gmail.com']);
            } catch {}
          } else {
            throw e;
          }
        }
        // Ensure legacy schema columns are consistent
        try { await conn.query("UPDATE users SET user_type = 'admin' WHERE email = 'utkrranti@gmail.com' OR contact_number = '7768068585'"); } catch {}
        try { await conn.query("UPDATE users SET is_active = 1 WHERE email = 'utkrranti@gmail.com' OR contact_number = '7768068585'"); } catch {}
        Logger.info('admin_user_seeded', { email: 'utkrranti@gmail.com', phone: '7768068585' });
      } else {
        // Update existing admin user to have correct user_type_id if missing
        try {
          const [existingAdmin]: any = await conn.query(
            `SELECT user_type_id FROM users WHERE email = ? LIMIT 1`,
            ['utkrranti@gmail.com']
          );
          if (existingAdmin && Array.isArray(existingAdmin) && existingAdmin.length > 0) {
            const existingTypeId = existingAdmin[0]?.user_type_id;
            if (!existingTypeId) {
              await conn.query('UPDATE users SET user_type_id = ? WHERE email = ?', [adminTypeId, 'utkrranti@gmail.com']);
            }
          }
        } catch (e: any) {
          // Ignore if user_type_id column doesn't exist yet
        }
      }
      // Seed requested Field officer user if not present
      try {
        const [exists]: any = await conn.query(
          `SELECT id FROM users WHERE contact_number = ? LIMIT 1`,
          ['9561923703']
        );
        const hasUser = Array.isArray(exists) && exists.length > 0;
        if (!hasUser) {
          await conn.query(
            `INSERT INTO users (name, email, contact_number, user_type_id, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'active', NOW(), NOW())`,
            ['Pranit', 'utkrranti.cc@gmail.com', '9561923703', fieldOfficerTypeId]
          );
        }
        // Ensure legacy schema columns are consistent
        try { await conn.query("UPDATE users SET user_type = 'field_officer' WHERE contact_number = '9561923703'"); } catch {}
        try { await conn.query("UPDATE users SET is_active = 1 WHERE contact_number = '9561923703'"); } catch {}
        // Assign requested static passkey 1994 to current field officer (if free)
        // First ensure passkey column exists
        try {
          const [pkCol]: any = await conn.query("SHOW COLUMNS FROM users LIKE 'passkey'");
          if (Array.isArray(pkCol) && pkCol.length > 0) {
            const [taken]: any = await conn.query('SELECT id FROM users WHERE passkey = 1994 LIMIT 1');
            if (!Array.isArray(taken) || taken.length === 0) {
              await conn.query("UPDATE users SET passkey = 1994 WHERE contact_number = '9561923703' LIMIT 1");
              Logger.info('field_officer_passkey_assigned', { contact: '9561923703', passkey: 1994 });
            }
          }
        } catch (e: any) {
          Logger.error('field_officer_passkey_failed', { error: e.message });
        }
      } catch {}

      // Get counts
      const [userCount]: any = await conn.query('SELECT COUNT(*) AS c FROM users');
      const [typeCount2]: any = await conn.query('SELECT COUNT(*) AS c FROM user_types');
      const [adminUser]: any = await conn.query(
        `SELECT id, name, email, user_type_id FROM users WHERE email = ? LIMIT 1`,
        ['utkrranti@gmail.com']
      );

      return NextResponse.json({
        ok: true,
        message: 'Users and user_types tables setup completed',
        data: {
          user_types_count: (typeCount2 as any[])[0]?.c || 0,
          users_count: (userCount as any[])[0]?.c || 0,
          admin_user: adminUser && Array.isArray(adminUser) && adminUser.length > 0 ? adminUser[0] : null,
        }
      });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    Logger.error('setup_users_error', { error: e.message });
    return NextResponse.json({ 
      ok: false, 
      error: e.message 
    }, { status: 500 });
  }
}

