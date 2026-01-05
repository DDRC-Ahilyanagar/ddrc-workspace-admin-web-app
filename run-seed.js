// Simple runner for seed_surveys.ts
// Run with: node run-seed.js

const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('🌱 Starting survey seed script...');
  execSync('npx tsx seed_surveys.ts', {
    cwd: __dirname,
    stdio: 'inherit',
  });
  console.log('✅ Seed completed successfully!');
} catch (error) {
  console.error('❌ Seed failed:', error.message);
  process.exit(1);
}



