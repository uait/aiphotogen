#!/usr/bin/env node

const https = require('https');

const testAPI = () => {
  const postData = JSON.stringify({
    prompt: "Test prompt",
    mode: "chat"
  });

  const options = {
    hostname: 'us-central1-gemini-canvas-1ioef.cloudfunctions.net',
    port: 443,
    path: '/api/generate-image-v2',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Response body:', data);
    });
  });

  req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
  });

  req.write(postData);
  req.end();
};

console.log('Testing API directly...');
testAPI();