/* eslint-disable no-console */
// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { PrismaClient, UserType, UserStatus, AccessRequestStatus } = require('@prisma/client');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Database connection for questions/sections (not in Prisma schema)
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'ddrc_surveys',
  charset: 'utf8mb4',
};

async function seedSportsData() {
  console.log('🏃 Seeding sports data...');
  
  const connection = await mysql.createConnection(dbConfig);

  try {
    // Create sports_types table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sports_types (
        id bigint unsigned NOT NULL AUTO_INCREMENT,
        name_marathi varchar(255) NOT NULL,
        name_english varchar(255) DEFAULT NULL,
        sort_order int NOT NULL DEFAULT 0,
        is_active tinyint(1) NOT NULL DEFAULT 1,
        created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sort_order (sort_order),
        KEY idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create sport_names table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sport_names (
        id bigint unsigned NOT NULL AUTO_INCREMENT,
        sports_type_id bigint unsigned NOT NULL,
        name_marathi varchar(255) NOT NULL,
        name_english varchar(255) DEFAULT NULL,
        sort_order int NOT NULL DEFAULT 0,
        is_active tinyint(1) NOT NULL DEFAULT 1,
        created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sports_type_id (sports_type_id),
        KEY idx_sort_order (sort_order),
        KEY idx_is_active (is_active),
        CONSTRAINT fk_sport_names_sports_type FOREIGN KEY (sports_type_id) REFERENCES sports_types (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Sports data from the educational form
    const sportsData = [
      {
        type_marathi: 'मैदानी खेळ',
        type_english: 'Field Sports',
        names: [
          { marathi: 'धावणे', english: 'Running' },
          { marathi: 'गोळाफेक', english: 'Shot Put' },
          { marathi: 'उंच उडी', english: 'High Jump' },
          { marathi: 'लांब उडी', english: 'Long Jump' },
          { marathi: 'सायकलींग', english: 'Cycling' },
          { marathi: 'पोहणे', english: 'Swimming' },
          { marathi: 'तिकडचं कूद', english: 'Triple Jump' },
          { marathi: 'स्पॉट कूद', english: 'Pole Vault' },
          { marathi: 'जॅव्हेलिन फेंक', english: 'Javelin Throw' }
        ]
      },
      {
        type_marathi: 'सांघिक खेळ',
        type_english: 'Team Sports',
        names: [
          { marathi: 'फुटबाँल', english: 'Football' },
          { marathi: 'क्रिकेट', english: 'Cricket' },
          { marathi: 'कबड्डी', english: 'Kabaddi' },
          { marathi: 'खो-खो', english: 'Kho-Kho' }
        ]
      },
      {
        type_marathi: 'वैयक्तिक खेळ',
        type_english: 'Individual Sports',
        names: [
          { marathi: 'बुद्धिबळ', english: 'Chess' },
          { marathi: 'कॅरम', english: 'Carrom' },
          { marathi: 'बॅडमिंटन', english: 'Badminton' },
          { marathi: 'बॉक्सिंग', english: 'Boxing' },
          { marathi: 'कराटे', english: 'Karate' },
          { marathi: 'सॉफटबॉल', english: 'Softball' },
          { marathi: 'व्हीलचेअर रेस', english: 'Wheelchair Race' },
          { marathi: 'पोहणे', english: 'Swimming' }
        ]
      }
    ];

    // Insert sports types and their names
    for (let i = 0; i < sportsData.length; i++) {
      const sportType = sportsData[i];
      
      // Check if sports type already exists
      const [existingType] = await connection.execute(
        'SELECT id FROM sports_types WHERE name_marathi = ?',
        [sportType.type_marathi]
      );

      let typeId;
      if (Array.isArray(existingType) && existingType.length > 0) {
        typeId = existingType[0].id;
        // Update existing type
        await connection.execute(
          `UPDATE sports_types SET 
            name_english = ?, 
            sort_order = ?, 
            updated_at = NOW() 
          WHERE id = ?`,
          [sportType.type_english, i + 1, typeId]
        );
        console.log(`   ✓ Sports type "${sportType.type_marathi}" already exists (ID: ${typeId}), updated`);
      } else {
        // Insert new type
        const [result] = await connection.execute(
          `INSERT INTO sports_types (name_marathi, name_english, sort_order, is_active, created_at, updated_at)
           VALUES (?, ?, ?, 1, NOW(), NOW())`,
          [sportType.type_marathi, sportType.type_english, i + 1]
        );
        typeId = result.insertId;
        console.log(`   ✓ Created sports type "${sportType.type_marathi}" (ID: ${typeId})`);
      }

      // Delete existing sport names for this type (to allow re-seeding)
      await connection.execute(
        'DELETE FROM sport_names WHERE sports_type_id = ?',
        [typeId]
      );

      // Insert sport names
      for (let j = 0; j < sportType.names.length; j++) {
        const sportName = sportType.names[j];
        await connection.execute(
          `INSERT INTO sport_names (sports_type_id, name_marathi, name_english, sort_order, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
          [typeId, sportName.marathi, sportName.english, j + 1]
        );
      }
      console.log(`   ✓ Inserted ${sportType.names.length} sport names for "${sportType.type_marathi}"`);
    }

    console.log('✅ Sports data seeding complete');
  } catch (error) {
    console.error('❌ Error seeding sports data:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

async function seedLookupTables() {
  console.log('🗺️  Seeding lookup tables (taluka, grams, villages, PHC, talathi)...');
  
  const sqlFilePath = path.join(__dirname, '..', 'sql_dumps', 'u686550969_ddrcnagar_new.sql');
  
  if (!fs.existsSync(sqlFilePath)) {
    console.log('⚠️  SQL file not found. Skipping lookup tables seeding.');
    console.log(`   Expected path: ${sqlFilePath}`);
    return;
  }

  const connection = await mysql.createConnection({
    ...dbConfig,
    multipleStatements: true, // Allow multiple statements
  });

  try {
    // Read SQL file
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    const lookupTables = ['tbl_taluka', 'tbl_all_grams', 'tbl_all_villages', 'tbl_all_phc', 'tbl_all_talathi'];
    
    // Extract CREATE TABLE statements for lookup tables
    const createTableRegex = /CREATE TABLE\s+`?(\w+)`?\s*\([^;]+\)[^;]*;/gi;
    let createMatch;
    
    while ((createMatch = createTableRegex.exec(sqlContent)) !== null) {
      const tableName = createMatch[1];
      if (!lookupTables.includes(tableName)) continue;
      
      const createStmt = createMatch[0];
      // Replace CREATE TABLE with CREATE TABLE IF NOT EXISTS
      const modifiedStmt = createStmt.replace(/CREATE TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
      try {
        await connection.execute(modifiedStmt);
        console.log(`   ✓ Created/verified table: ${tableName}`);
      } catch (error) {
        // Table might already exist, that's okay
        if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
          console.warn(`   ⚠️  Error creating table ${tableName}:`, error.message);
        }
      }
    }

    // Extract INSERT statements for lookup tables - handle multi-line statements
    // Split by INSERT INTO to find all insert statements
    const insertStatements = sqlContent.split(/INSERT INTO\s+/gi);
    let totalInserted = 0;

    for (const stmt of insertStatements) {
      if (!stmt.trim()) continue;
      
      // Extract table name (first word after INSERT INTO)
      const tableMatch = stmt.match(/^`?(\w+)`?\s*\(/i);
      if (!tableMatch) continue;
      
      const tableName = tableMatch[1];
      if (!lookupTables.includes(tableName)) continue;

      // Find column list (between first parentheses)
      let colStart = tableMatch[0].length;
      let colEnd = colStart;
      let depth = 1;
      for (let i = colStart; i < stmt.length; i++) {
        if (stmt[i] === '(') depth++;
        if (stmt[i] === ')') {
          depth--;
          if (depth === 0) {
            colEnd = i;
            break;
          }
        }
      }
      
      const columnsPart = stmt.substring(colStart, colEnd);
      const columns = columnsPart
        .split(',')
        .map(col => col.trim().replace(/`/g, ''));
      
      // Find VALUES part - from "VALUES" until semicolon
      const valuesMatch = stmt.substring(colEnd + 1).match(/VALUES\s*([^;]+);/is);
      if (!valuesMatch) {
        console.warn(`   ⚠️  Could not parse VALUES for ${tableName}`);
        continue;
      }
      
      const valuesPart = valuesMatch[1].trim();
      
      // Modify INSERT to use ON DUPLICATE KEY UPDATE
      const updateClause = columns
        .filter(col => col !== 'id')
        .map(col => `\`${col}\` = VALUES(\`${col}\`)`)
        .join(', ');

      const modifiedInsert = `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) 
                               VALUES ${valuesPart}
                               ON DUPLICATE KEY UPDATE ${updateClause}`;

      try {
        // Execute the modified INSERT statement
        const [result] = await connection.execute(modifiedInsert);
        const affectedRows = result.affectedRows || 0;
        totalInserted += affectedRows;
        console.log(`   ✓ Inserted/updated ${affectedRows} rows in ${tableName}`);
      } catch (error) {
        console.warn(`   ⚠️  Error inserting into ${tableName}:`, error.message);
        // Continue with next table
      }
    }

    console.log(`✅ Lookup tables seeding complete: ${totalInserted} total rows inserted/updated`);
  } catch (error) {
    console.error('❌ Error seeding lookup tables:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

async function seedQuestionsAndSections() {
  const questionsPath = path.join(__dirname, 'questions.json');
  
  if (!fs.existsSync(questionsPath)) {
    console.log('⚠️  questions.json not found. Skipping questions seeding.');
    console.log('   To seed questions, copy sequenced_questions.json to prisma/questions.json');
    return;
  }

  console.log('📖 Reading questions from questions.json...');
  const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
  
  if (!Array.isArray(questionsData) || questionsData.length === 0) {
    console.log('⚠️  No questions found in questions.json');
    return;
  }

  console.log(`📋 Found ${questionsData.length} questions`);

  // Create database connection
  const connection = await mysql.createConnection(dbConfig);

  try {
    // Ensure tables exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sections (
        id bigint unsigned NOT NULL AUTO_INCREMENT,
        title_marathi varchar(255) NOT NULL,
        title_english varchar(255) DEFAULT NULL,
        sort_order int NOT NULL,
        is_active tinyint(1) NOT NULL DEFAULT 1,
        created_at timestamp NULL DEFAULT NULL,
        updated_at timestamp NULL DEFAULT NULL,
        name varchar(255) NOT NULL,
        PRIMARY KEY (id),
        KEY sections_sort_order_index (sort_order),
        KEY sections_is_active_index (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS questions (
        id bigint unsigned NOT NULL,
        section_id bigint unsigned NOT NULL,
        question text NOT NULL,
        question_type varchar(50) NOT NULL,
        multi_select tinyint(1) NOT NULL DEFAULT 0,
        options text DEFAULT NULL,
        rendering_condition varchar(10) DEFAULT NULL,
        rendering_question varchar(255) DEFAULT NULL,
        rendering_value varchar(255) DEFAULT NULL,
        regex varchar(255) DEFAULT NULL,
        valid_input varchar(20) DEFAULT NULL,
        max_length int DEFAULT NULL,
        status varchar(20) DEFAULT 'Active',
        created_by bigint unsigned DEFAULT NULL,
        created_on timestamp NULL DEFAULT NULL,
        updated_by bigint unsigned DEFAULT NULL,
        updated_on timestamp NULL DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_section_id (section_id),
        CONSTRAINT fk_questions_section FOREIGN KEY (section_id) REFERENCES sections (id) ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    // Extract unique section titles
    const sectionTitles = [...new Set(questionsData.map(q => q.title).filter(Boolean))];
    console.log(`📑 Found ${sectionTitles.length} unique sections`);

    // Create sections and map titles to IDs
    const sectionMap = new Map();
    let sortOrder = 1;

    for (const title of sectionTitles) {
      // Check if section already exists
      const [existing] = await connection.execute(
        'SELECT id FROM sections WHERE name = ?',
        [title]
      );

      let sectionId;
      if (Array.isArray(existing) && existing.length > 0) {
        sectionId = existing[0].id;
        console.log(`   ✓ Section "${title}" already exists (ID: ${sectionId})`);
      } else {
        const [result] = await connection.execute(
          `INSERT INTO sections (name, title_marathi, sort_order, is_active, created_at, updated_at)
           VALUES (?, ?, ?, 1, NOW(), NOW())`,
          [title, title, sortOrder]
        );
        sectionId = result.insertId;
        console.log(`   ✓ Created section "${title}" (ID: ${sectionId})`);
      }
      
      sectionMap.set(title, sectionId);
      sortOrder++;
    }

    // Insert questions
    console.log('📝 Inserting questions...');
    let inserted = 0;
    let skipped = 0;
    let updated = 0;

    for (const q of questionsData) {
      const sectionId = sectionMap.get(q.title);
      if (!sectionId) {
        console.warn(`   ⚠️  Skipping question ${q.id}: section "${q.title}" not found`);
        skipped++;
        continue;
      }

      // Normalize options (handle "NULL" string)
      let options = q.options;
      if (options === 'NULL' || options === null || options === '') {
        options = null;
      }

      // Normalize multi_select
      const multiSelect = q.multi_select === 'Yes' || q.multi_select === true || q.multi_select === 1 ? 1 : 0;

      // Normalize rendering_condition
      const renderingCondition = q.rendering_condition === 'Yes' || q.rendering_condition === true ? 'Yes' : 'No';

      // Check if question already exists
      const [existing] = await connection.execute(
        'SELECT id FROM questions WHERE id = ?',
        [parseInt(q.id)]
      );

      if (Array.isArray(existing) && existing.length > 0) {
        // Update existing question
        await connection.execute(
          `UPDATE questions SET
            section_id = ?,
            question = ?,
            question_type = ?,
            multi_select = ?,
            options = ?,
            rendering_condition = ?,
            rendering_question = ?,
            rendering_value = ?,
            regex = ?,
            valid_input = ?,
            max_length = ?,
            status = ?,
            updated_on = NOW()
          WHERE id = ?`,
          [
            sectionId,
            q.question,
            q.question_type,
            multiSelect,
            options,
            renderingCondition,
            q.rendering_question,
            q.rendering_value,
            q.regex || null,
            q.valid_input || null,
            q.max_length ? parseInt(q.max_length) : null,
            q.status || 'Active',
            parseInt(q.id)
          ]
        );
        updated++;
      } else {
        // Insert new question
        await connection.execute(
          `INSERT INTO questions (
            id, section_id, question, question_type, multi_select, options,
            rendering_condition, rendering_question, rendering_value,
            regex, valid_input, max_length, status, created_by, created_on
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            parseInt(q.id),
            sectionId,
            q.question,
            q.question_type,
            multiSelect,
            options,
            renderingCondition,
            q.rendering_question,
            q.rendering_value,
            q.regex || null,
            q.valid_input || null,
            q.max_length ? parseInt(q.max_length) : null,
            q.status || 'Active',
            q.created_by ? parseInt(q.created_by) : 1,
            q.created_on ? new Date(q.created_on) : new Date()
          ]
        );
        inserted++;
      }
    }

    console.log(`✅ Questions seeding complete:`);
    console.log(`   - Inserted: ${inserted}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Skipped: ${skipped}`);
  } catch (error) {
    console.error('❌ Error seeding questions:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

async function main() {
  const adminPhone = process.env.SEED_ADMIN_PHONE || '9999999999';
  const adminName = process.env.SEED_ADMIN_NAME || 'System Admin';
  const adminPasskey = process.env.SEED_ADMIN_PASSKEY
    ? parseInt(process.env.SEED_ADMIN_PASSKEY, 10)
    : null;

  const adminUser = await prisma.user.upsert({
    where: { contactNumber: adminPhone },
    update: {
      name: adminName,
      userType: UserType.admin,
      status: UserStatus.active,
      isActive: true,
      otpVerifiedAt: new Date(),
    },
    create: {
      name: adminName,
      contactNumber: adminPhone,
      userType: UserType.admin,
      status: UserStatus.active,
      isActive: true,
      passkey: adminPasskey ?? undefined,
    },
  });

  console.log('✅ Seeded admin user with ID:', adminUser.id.toString());

  if (process.env.SEED_SAMPLE_ACCESS_REQUEST === 'true') {
    const sample = await prisma.accessRequest.upsert({
      where: { phone: adminPhone },
      update: {},
      create: {
        name: adminName,
        phone: adminPhone,
        selfieUrl: '/uploads/access_requests/sample.jpg',
        status: AccessRequestStatus.pending,
      },
    });
    console.log('✅ Seeded sample access request:', sample.id);
  }

  // Seed sports data if enabled
  if (process.env.SEED_SPORTS !== 'false') {
    await seedSportsData();
  } else {
    console.log('⏭️  Skipping sports data seeding (SEED_SPORTS=false)');
  }

  // Seed lookup tables (taluka, grams, villages, PHC, talathi) if enabled
  if (process.env.SEED_LOOKUP_TABLES !== 'false') {
    await seedLookupTables();
  } else {
    console.log('⏭️  Skipping lookup tables seeding (SEED_LOOKUP_TABLES=false)');
  }

  // Seed questions and sections if enabled
  if (process.env.SEED_QUESTIONS !== 'false') {
    await seedQuestionsAndSections();
  } else {
    console.log('⏭️  Skipping questions seeding (SEED_QUESTIONS=false)');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('Prisma seed failed', err);
    await prisma.$disconnect();
    process.exit(1);
  });

