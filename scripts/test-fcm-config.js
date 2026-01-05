#!/usr/bin/env node

/**
 * Test FCM Configuration
 * 
 * This script tests if the FCM server key is valid by making a test request.
 * Run: node scripts/test-fcm-config.js
 */

require('dotenv').config({ path: '.env.local' });

const fcmServerKey = process.env.FCM_SERVER_KEY;

if (!fcmServerKey) {
  console.log('❌ FCM_SERVER_KEY not found in .env.local');
  process.exit(1);
}

console.log('🔍 Testing FCM Server Key...\n');
console.log(`Server Key: ${fcmServerKey.substring(0, 20)}...${fcmServerKey.substring(fcmServerKey.length - 10)}\n`);

// Test with a dummy token (this will fail but we can check the error response)
const testToken = 'test_token_12345';

fetch('https://fcm.googleapis.com/fcm/send', {
  method: 'POST',
  headers: {
    'Authorization': `key=${fcmServerKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: testToken,
    notification: {
      title: 'Test',
      body: 'Test notification',
    },
  }),
})
  .then(async (response) => {
    const contentType = response.headers.get('content-type') || '';
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${contentType}\n`);

    if (contentType.includes('application/json')) {
      const result = await response.json();
      console.log('Response:', JSON.stringify(result, null, 2));
      
      if (response.status === 401) {
        console.log('\n❌ ERROR: Server key is INVALID or UNAUTHORIZED');
        console.log('   → Check that the server key is correct in Firebase Console');
        console.log('   → Go to: Firebase Console → Project Settings → Cloud Messaging');
      } else if (response.status === 400) {
        console.log('\n✅ Server key is VALID (400 is expected for invalid token)');
        console.log('   → The server key works, but the test token is invalid (this is normal)');
      } else {
        console.log(`\n⚠️  Unexpected status: ${response.status}`);
      }
    } else {
      const text = await response.text();
      console.log('Response (non-JSON):', text.substring(0, 200));
      console.log('\n❌ ERROR: Server returned non-JSON response');
      console.log('   → This usually means the server key is invalid');
      console.log('   → Check that the server key is correct in Firebase Console');
    }
  })
  .catch((error) => {
    console.error('❌ Network Error:', error.message);
    process.exit(1);
  });

