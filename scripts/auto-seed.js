/* eslint-disable no-console */
/**
 * Auto-seed script - runs database seeding on app startup
 * Only seeds if tables are empty or AUTO_SEED=true is set
 */
require('dotenv').config({ path: '.env.local' });

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'ddrc_surveys',
  charset: 'utf8mb4',
};

async function checkIfSeedingNeeded() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // Check if lookup tables exist and have data
    const lookupTables = ['tbl_taluka', 'tbl_all_grams', 'tbl_all_villages', 'tbl_all_phc', 'tbl_all_talathi'];
    let needsSeeding = false;
    
    for (const table of lookupTables) {
      try {
        const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM \`${table}\``);
        const count = rows[0]?.count || 0;
        if (count === 0) {
          console.log(`   ⚠️  Table ${table} is empty`);
          needsSeeding = true;
        }
      } catch (error) {
        // Table doesn't exist
        if (error.code === 'ER_NO_SUCH_TABLE') {
          console.log(`   ⚠️  Table ${table} does not exist`);
          needsSeeding = true;
        }
      }
    }
    
    return needsSeeding;
  } catch (error) {
    console.error('Error checking seeding status:', error);
    return false;
  } finally {
    await connection.end();
  }
}

async function runSeed() {
  console.log('🌱 Running database seed...');
  const { execSync } = require('child_process');
  
  try {
    execSync('npm run prisma:seed', {
      stdio: 'inherit',
      cwd: require('path').join(__dirname, '..'),
    });
    console.log('✅ Database seeding completed');
    return true;
  } catch (error) {
    console.error('❌ Database seeding failed:', error.message);
    return false;
  }
}

async function main() {
  // Check if auto-seed is explicitly enabled
  const autoSeedEnabled = process.env.AUTO_SEED === 'true';
  
  if (autoSeedEnabled) {
    console.log('🔄 AUTO_SEED=true - Running seed automatically...');
    await runSeed();
    return;
  }
  
  // Otherwise, check if seeding is needed
  console.log('🔍 Checking if database seeding is needed...');
  const needsSeeding = await checkIfSeedingNeeded();
  
  if (needsSeeding) {
    console.log('📦 Database needs seeding - running seed script...');
    await runSeed();
  } else {
    console.log('✅ Database is already seeded - skipping');
  }
}

// Only run if called directly (not when imported)
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Auto-seed script failed:', error);
      process.exit(1);
    });
}

module.exports = { main, checkIfSeedingNeeded };

