// Test PostgreSQL Authentication Flow
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api/auth';
const TEST_EMAIL = 'test_user_' + Date.now() + '@example.com';
const TEST_PASSWORD = 'TestPass123!';

async function testAuthFlow() {
  console.log('🔵 Testing PostgreSQL Authentication Flow\n');
  
  // 1. Test Signup
  console.log('1️⃣ Testing Signup...');
  try {
    const signupRes = await fetch(`${API_BASE}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      })
    });
    
    const signupData = await signupRes.json();
    console.log('Signup Response:', {
      status: signupRes.status,
      data: signupData
    });
    
    if (!signupRes.ok) {
      console.error('❌ Signup failed:', signupData);
      return;
    }
    console.log('✅ Signup successful!\n');
  } catch (error) {
    console.error('❌ Signup error:', error.message);
    return;
  }
  
  // 2. Test Login
  console.log('2️⃣ Testing Login...');
  try {
    const loginRes = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      })
    });
    
    const loginData = await loginRes.json();
    console.log('Login Response:', {
      status: loginRes.status,
      data: loginData
    });
    
    if (!loginRes.ok) {
      console.error('❌ Login failed:', loginData);
      return;
    }
    
    const token = loginData.token;
    console.log('✅ Login successful!');
    console.log('🔑 Token received:', token ? 'Yes' : 'No');
    console.log('\n');
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return;
  }
  
  // 3. Test Forgot Password
  console.log('3️⃣ Testing Forgot Password...');
  try {
    const forgotRes = await fetch(`${API_BASE}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL
      })
    });
    
    const forgotData = await forgotRes.json();
    console.log('Forgot Password Response:', {
      status: forgotRes.status,
      data: forgotData
    });
    
    if (!forgotRes.ok) {
      console.error('❌ Forgot password failed:', forgotData);
      return;
    }
    console.log('✅ Forgot password request successful!\n');
  } catch (error) {
    console.error('❌ Forgot password error:', error.message);
    return;
  }
  
  console.log('🎉 All authentication tests completed successfully!');
  console.log('📝 Test user created:', TEST_EMAIL);
}

// Run the test
testAuthFlow().catch(console.error);