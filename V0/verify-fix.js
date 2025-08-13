#!/usr/bin/env node

const https = require('https');
const http = require('http');

async function testApp() {
  console.log('🔍 Testing the fixed application...');
  
  // Test if server is responding
  const testUrl = 'http://localhost:3002';
  
  return new Promise((resolve, reject) => {
    const req = http.get(testUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('✅ Server responded with status:', res.statusCode);
        
        // Check for specific error patterns
        const checks = [
          {
            pattern: /TypeError.*Cannot read properties of undefined.*reading.*call/,
            name: 'Original webpack error',
            found: false
          },
          {
            pattern: /page\.tsx:5/,
            name: 'Reference to problematic line',
            found: false
          },
          {
            pattern: /ChunkLoadError/,
            name: 'Chunk loading errors',
            found: false
          },
          {
            pattern: /_app/,
            name: 'Next.js app structure',
            found: false
          },
          {
            pattern: /RunSmartApp/,
            name: 'Main component',
            found: false
          }
        ];
        
        checks.forEach(check => {
          check.found = check.pattern.test(data);
          const status = check.found ? '✅ Found' : '❌ Not found';
          console.log(`${status}: ${check.name}`);
        });
        
        // Check for error messages in HTML
        if (data.includes('error') || data.includes('Error')) {
          console.log('⚠️ Response contains error-related content');
        } else {
          console.log('✅ No error content detected in response');
        }
        
        // Check HTML structure
        if (data.includes('<html') && data.includes('</html>')) {
          console.log('✅ Valid HTML document structure');
        } else {
          console.log('❌ Invalid or incomplete HTML document');
        }
        
        resolve({
          statusCode: res.statusCode,
          hasErrors: checks.some(c => c.name.includes('error') && c.found),
          hasValidHTML: data.includes('<html') && data.includes('</html>'),
          dataLength: data.length
        });
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });
    
    req.setTimeout(10000, () => {
      console.error('❌ Request timeout');
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

testApp()
  .then(result => {
    console.log('\n📊 Test Results:');
    console.log('Status Code:', result.statusCode);
    console.log('Has Errors:', result.hasErrors);
    console.log('Valid HTML:', result.hasValidHTML);
    console.log('Response Size:', result.dataLength, 'bytes');
    
    if (result.statusCode === 200 && !result.hasErrors && result.hasValidHTML) {
      console.log('\n🎉 SUCCESS: Application appears to be working correctly!');
    } else {
      console.log('\n⚠️ WARNING: Application may still have issues');
    }
  })
  .catch(error => {
    console.error('\n💥 FAILED: Could not test application:', error.message);
  });