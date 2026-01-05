#!/usr/bin/env node

/**
 * Check Firebase FCM Configuration Status
 * 
 * This script checks if Firebase is properly configured for push notifications.
 * Run: node scripts/check-firebase-config.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Firebase FCM Configuration...\n');

const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');
const serviceAccountPath = path.join(rootDir, 'firebase-service-account.json');

// Check .env.local file
let envExists = false;
let hasFcmConfig = false;
let configType = null;
let configDetails = {};

if (fs.existsSync(envLocalPath)) {
  envExists = true;
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  
  // Check for V1 API config
  if (envContent.includes('FCM_SERVICE_ACCOUNT_PATH') || envContent.includes('FCM_SERVICE_ACCOUNT_JSON')) {
    hasFcmConfig = true;
    configType = 'V1 API';
    
    const serviceAccountPathMatch = envContent.match(/FCM_SERVICE_ACCOUNT_PATH=(.+)/);
    const projectIdMatch = envContent.match(/FCM_PROJECT_ID=(.+)/);
    
    if (serviceAccountPathMatch) {
      configDetails.serviceAccountPath = serviceAccountPathMatch[1].trim();
    }
    if (projectIdMatch) {
      configDetails.projectId = projectIdMatch[1].trim();
    }
  }
  // Check for Legacy API config
  else if (envContent.includes('FCM_SERVER_KEY')) {
    hasFcmConfig = true;
    configType = 'Legacy API';
    
    const serverKeyMatch = envContent.match(/FCM_SERVER_KEY=(.+)/);
    if (serverKeyMatch) {
      const key = serverKeyMatch[1].trim();
      configDetails.serverKey = key.substring(0, 20) + '...' + key.substring(key.length - 10);
    }
  }
} else {
  console.log('❌ .env.local file not found');
  console.log('   Create it in: ddrc-workspace-admin-web-app/.env.local\n');
}

// Check service account file (for V1 API)
let serviceAccountExists = false;
if (fs.existsSync(serviceAccountPath)) {
  serviceAccountExists = true;
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    configDetails.serviceAccountProjectId = serviceAccount.project_id;
    configDetails.serviceAccountEmail = serviceAccount.client_email;
  } catch (e) {
    console.log('⚠️  Service account file exists but is invalid JSON');
  }
}

// Print status
console.log('📋 Configuration Status:\n');

if (!envExists) {
  console.log('❌ .env.local: NOT FOUND');
  console.log('   → Create this file and add FCM configuration\n');
} else {
  console.log('✅ .env.local: EXISTS');
  
  if (!hasFcmConfig) {
    console.log('❌ FCM Configuration: NOT FOUND');
    console.log('   → Add either FCM_SERVER_KEY (Legacy) or FCM_SERVICE_ACCOUNT_PATH (V1)\n');
  } else {
    console.log(`✅ FCM Configuration: ${configType}`);
    
    if (configType === 'V1 API') {
      console.log(`   Project ID: ${configDetails.projectId || 'Not set'}`);
      console.log(`   Service Account Path: ${configDetails.serviceAccountPath || 'Not set'}`);
      
      if (serviceAccountExists) {
        console.log('✅ Service Account File: EXISTS');
        console.log(`   Project ID: ${configDetails.serviceAccountProjectId}`);
        console.log(`   Email: ${configDetails.serviceAccountEmail}`);
      } else {
        console.log('❌ Service Account File: NOT FOUND');
        if (configDetails.serviceAccountPath) {
          const fullPath = path.resolve(rootDir, configDetails.serviceAccountPath);
          console.log(`   Expected at: ${fullPath}`);
        }
      }
    } else if (configType === 'Legacy API') {
      console.log(`   Server Key: ${configDetails.serverKey || 'Not set'}`);
      console.log('   ⚠️  Legacy API is deprecated but still works');
    }
  }
}

// Summary
console.log('\n📊 Summary:');
if (envExists && hasFcmConfig) {
  if (configType === 'V1 API' && serviceAccountExists) {
    console.log('✅ Firebase FCM is FULLY CONFIGURED (V1 API)');
    console.log('   Ready to send push notifications!');
  } else if (configType === 'Legacy API') {
    console.log('✅ Firebase FCM is CONFIGURED (Legacy API)');
    console.log('   Ready to send push notifications!');
    console.log('   ⚠️  Consider migrating to V1 API for future-proofing');
  } else if (configType === 'V1 API' && !serviceAccountExists) {
    console.log('⚠️  Firebase FCM is PARTIALLY CONFIGURED');
    console.log('   → Download service account JSON from Firebase Console');
    console.log('   → Save as: firebase-service-account.json');
  }
} else {
  console.log('❌ Firebase FCM is NOT CONFIGURED');
  console.log('\n📝 Next Steps:');
  console.log('   1. Choose Option 1 (Legacy) or Option 2 (V1) from FIREBASE_SETUP_STEPS.md');
  console.log('   2. Get credentials from Firebase Console');
  console.log('   3. Add to .env.local');
  console.log('   4. Restart backend server');
}

console.log('\n📚 See FIREBASE_SETUP_STEPS.md for detailed instructions\n');

