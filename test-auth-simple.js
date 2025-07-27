const fetch = require('node-fetch');

async function testAuth() {
  const baseUrl = 'http://localhost:3000';
  const timestamp = Date.now();
  const testEmail = `test${timestamp}@example.com`;
  const testPassword = 'TestPassword123!';
  const testName = `Test User ${timestamp}`;

  console.log('🧪 Testing Authentication System\n');
  console.log('Test credentials:');
  console.log(`Email: ${testEmail}`);
  console.log(`Password: ${testPassword}`);
  console.log(`Name: ${testName}\n`);

  // Test 1: Registration
  console.log('1. Testing Registration...');
  try {
    const registerResponse = await fetch(`${baseUrl}/api/auth/simple-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
      }),
    });

    const registerData = await registerResponse.json();
    console.log(`   Status: ${registerResponse.status}`);
    console.log(`   Response:`, registerData);

    if (registerResponse.ok) {
      console.log('   ✅ Registration successful!\n');
    } else {
      console.log('   ❌ Registration failed\n');
    }
  } catch (error) {
    console.error('   ❌ Registration error:', error.message, '\n');
  }

  // Test 2: Login
  console.log('2. Testing Login...');
  try {
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const loginData = await loginResponse.json();
    console.log(`   Status: ${loginResponse.status}`);
    console.log(`   Response:`, loginData);

    if (loginResponse.ok) {
      console.log('   ✅ Login successful!\n');
    } else {
      console.log('   ❌ Login failed\n');
    }
  } catch (error) {
    console.error('   ❌ Login error:', error.message, '\n');
  }

  // Test 3: Forgot Password
  console.log('3. Testing Forgot Password...');
  try {
    const forgotResponse = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
      }),
    });

    const forgotData = await forgotResponse.json();
    console.log(`   Status: ${forgotResponse.status}`);
    console.log(`   Response:`, forgotData);

    if (forgotResponse.ok) {
      console.log('   ✅ Forgot password request successful!\n');
    } else {
      console.log('   ❌ Forgot password failed\n');
    }
  } catch (error) {
    console.error('   ❌ Forgot password error:', error.message, '\n');
  }

  console.log('✅ Test complete!');
}

// Run the test
testAuth().catch(console.error);
