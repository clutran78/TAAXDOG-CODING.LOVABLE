// Set environment to production for testing
process.env.NODE_ENV = 'production';

const fetch = require('node-fetch');

async function testProductionMode() {
  const baseUrl = 'http://localhost:3000';
  const timestamp = Date.now();
  const testEmail = `prodtest${timestamp}@example.com`;
  const testPassword = 'TestPassword123!';
  const testName = `Production Test User ${timestamp}`;

  console.log('🚀 Testing Production Mode Authentication\n');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Email Provider:', process.env.EMAIL_PROVIDER);
  console.log('SendGrid Key:', process.env.SENDGRID_API_KEY ? 'Set' : 'Not set');
  console.log('\nTest credentials:');
  console.log(`Email: ${testEmail}`);
  console.log(`Password: ${testPassword}`);
  console.log(`Name: ${testName}\n`);

  // Test 1: Check email provider status
  console.log('1. Checking Email Provider Status...');
  try {
    const statusResponse = await fetch(`${baseUrl}/api/auth/email-status`);
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('   Email Provider Status:', statusData);
    }
  } catch (error) {
    console.log('   Email status endpoint not available');
  }

  // Test 2: Registration
  console.log('\n2. Testing Registration...');
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
      console.log('   ✅ Registration successful!');
    } else {
      console.log('   ❌ Registration failed');
    }
  } catch (error) {
    console.error('   ❌ Registration error:', error.message);
  }

  // Test 3: Login
  console.log('\n3. Testing Login...');
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
      console.log('   ✅ Login successful!');
    } else if (loginData.requiresVerification) {
      console.log('   ⚠️  Email verification required (email provider is configured)');
    } else {
      console.log('   ❌ Login failed');
    }
  } catch (error) {
    console.error('   ❌ Login error:', error.message);
  }

  console.log('\n✅ Production mode test complete!');
}

// Run the test
testProductionMode().catch(console.error);
