// Test script to send OTP via API
const http = require('http');

const data = JSON.stringify({
  phone: '9561923703',
  role: 'field_officer'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/send-otp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'x-source': 'mobile',
    'x-role': 'field_officer'
  }
};

console.log('Sending OTP request to:', `http://${options.hostname}:${options.port}${options.path}`);
console.log('Phone:', data);
console.log('');

const req = http.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Response Status:', res.statusCode);
    console.log('Response Headers:', res.headers);
    console.log('');
    console.log('Response Body:');
    try {
      const json = JSON.parse(responseData);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('Request Error:', error.message);
});

req.write(data);
req.end();

