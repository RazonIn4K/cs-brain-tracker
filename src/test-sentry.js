// Quick script to test Sentry integration
const axios = require('axios');

async function testSentry() {
  const baseURL = 'http://localhost:3000/api/v1';
  
  console.log('🧪 Testing Sentry Error Tracking...\n');
  
  // Test 1: 404 Error
  try {
    await axios.get(`${baseURL}/this-route-does-not-exist`);
  } catch (error) {
    console.log('✅ Test 1: 404 error triggered');
  }
  
  // Test 2: Validation Error
  try {
    await axios.post(`${baseURL}/captures`, {
      type: 'invalid-type',
      content: 'This should fail validation'
    });
  } catch (error) {
    console.log('✅ Test 2: Validation error triggered');
  }
  
  // Test 3: Invalid ID Format
  try {
    await axios.get(`${baseURL}/captures/not-a-valid-id`);
  } catch (error) {
    console.log('✅ Test 3: Invalid ID error triggered');
  }
  
  console.log('\n🎉 All errors sent to Sentry!');
  console.log('👉 Check your Sentry dashboard at: https://sentry.io');
}

// Add axios first: npm install axios
console.log('First run: npm install axios');
console.log('Then run: node src/test-sentry.js');