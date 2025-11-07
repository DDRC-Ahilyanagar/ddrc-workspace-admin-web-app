/**
 * Script to check database structure and compare with PHP API expectations
 * Run with: npx tsx scripts/check-db-structure.ts
 */

import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'ddrc_surveys',
};

interface ColumnInfo {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
}

interface TableRow {
  count: number;
}

async function checkDatabaseStructure(): Promise<void> {
  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database:', dbConfig.database);

    // Get all tables
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('\n📊 Database Tables:');
    console.log('='.repeat(60));

    const tableNames = (tables as any[]).map((row) => Object.values(row)[0] as string);
    
    for (const tableName of tableNames) {
      console.log(`\n📋 Table: ${tableName}`);
      console.log('-'.repeat(60));
      
      const [columns] = await connection.execute<mysql.RowDataPacket[]>(`DESCRIBE ${tableName}`);
      console.log('Columns:');
      (columns as ColumnInfo[]).forEach((col) => {
        console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
      });

      // Get row count
      const [count] = await connection.execute<mysql.RowDataPacket[]>(`SELECT COUNT(*) as count FROM ${tableName}`);
      console.log(`Row count: ${(count[0] as TableRow).count}`);
    }

    // Check expected tables from PHP API
    console.log('\n\n🔍 Expected Tables from PHP API:');
    console.log('='.repeat(60));
    const expectedTables = [
      'users',
      'otp_verifications',
      'survey_aadhar',
      'answers',
      'questions',
      'sections',
      'tbl_all_talukas',
      'tbl_taluka',
      'tbl_all_villages',
      'tbl_all_grams',
      'tbl_all_phc',
    ];

    for (const expectedTable of expectedTables) {
      const exists = tableNames.includes(expectedTable);
      console.log(`${exists ? '✅' : '❌'} ${expectedTable}`);
    }

    // Check specific table structures
    console.log('\n\n📝 Detailed Table Structure Checks:');
    console.log('='.repeat(60));

    // Check survey_aadhar
    if (tableNames.includes('survey_aadhar')) {
      const [cols] = await connection.execute<mysql.RowDataPacket[]>('DESCRIBE survey_aadhar');
      const colNames = (cols as ColumnInfo[]).map((c) => c.Field);
      const expectedCols = ['id', 'aadhar_no', 'user_id', 'created_at', 'front_image', 'back_image', 'updated_at'];
      console.log('\n📋 survey_aadhar columns:');
      expectedCols.forEach((col) => {
        const exists = colNames.includes(col);
        console.log(`  ${exists ? '✅' : '❌'} ${col}`);
      });
    }

    // Check answers
    if (tableNames.includes('answers')) {
      const [cols] = await connection.execute<mysql.RowDataPacket[]>('DESCRIBE answers');
      const colNames = (cols as ColumnInfo[]).map((c) => c.Field);
      const expectedCols = ['id', 'user_id', 'aadhar_id', 'section_id', 'question_id', 'answer', 'created_at'];
      console.log('\n📋 answers columns:');
      expectedCols.forEach((col) => {
        const exists = colNames.includes(col);
        console.log(`  ${exists ? '✅' : '❌'} ${col}`);
      });
    }

    // Check users
    if (tableNames.includes('users')) {
      const [cols] = await connection.execute<mysql.RowDataPacket[]>('DESCRIBE users');
      const colNames = (cols as ColumnInfo[]).map((c) => c.Field);
      const expectedCols = ['id', 'name', 'email', 'phone', 'user_type', 'is_active', 'email_verified_at', 'otp_verified_at', 'last_login', 'password', 'remember_token', 'created_at', 'updated_at'];
      console.log('\n📋 users columns:');
      expectedCols.forEach((col) => {
        const exists = colNames.includes(col);
        console.log(`  ${exists ? '✅' : '❌'} ${col}`);
      });
    }

    // Check otp_verifications
    if (tableNames.includes('otp_verifications')) {
      const [cols] = await connection.execute<mysql.RowDataPacket[]>('DESCRIBE otp_verifications');
      const colNames = (cols as ColumnInfo[]).map((c) => c.Field);
      const expectedCols = ['id', 'phone', 'otp', 'expires_at', 'status', 'verified_at', 'created_at', 'updated_at'];
      console.log('\n📋 otp_verifications columns:');
      expectedCols.forEach((col) => {
        const exists = colNames.includes(col);
        console.log(`  ${exists ? '✅' : '❌'} ${col}`);
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Connection closed');
    }
  }
}

checkDatabaseStructure();

