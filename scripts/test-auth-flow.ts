import fetch from 'node-fetch';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message?: string;
  details?: any;
}

const results: TestResult[] = [];

async function testEndpoint(
  name: string,
  method: string,
  path: string,
  body?: any,
  expectedStatus: number = 200
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => null);

    if (response.status === expectedStatus) {
      results.push({
        test: name,
        status: 'PASS',
        message: `Status: ${response.status}`,
        details: data,
      });
    } else {
      results.push({
        test: name,
        status: 'FAIL',
        message: `Expected ${expectedStatus}, got ${response.status}`,
        details: data,
      });
    }
  } catch (error: any) {
    results.push({
      test: name,
      status: 'FAIL',
      message: error.message,
    });
  }
}

async function runAuthTests() {
  console.log('🔐 Testing Authentication Flow with NextAuth...\n');

  // Test 1: Register a new user
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  await testEndpoint(
    'Register new user',
    'POST',
    '/api/auth/register',
    {
      email: testEmail,
      password: testPassword,
      name: 'Test User',
    }
  );

  // Test 2: Login with the registered user
  await testEndpoint(
    'Login with credentials',
    'POST',
    '/api/auth/simple-login',
    {
      email: testEmail,
      password: testPassword,
    }
  );

  // Test 3: Test forgot password
  await testEndpoint(
    'Forgot password',
    'POST',
    '/api/auth/forgot-password',
    {
      email: testEmail,
    }
  );

  // Test 4: Test invalid login
  await testEndpoint(
    'Invalid login attempt',
    'POST',
    '/api/auth/simple-login',
    {
      email: testEmail,
      password: 'WrongPassword',
    },
    401
  );

  // Test 5: Check NextAuth configuration
  await testEndpoint(
    'NextAuth providers',
    'GET',
    '/api/auth/providers'
  );

  // Print results
  console.log('\n📊 Test Results:\n');
  results.forEach((result) => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.message || 'OK'}`);
    if (result.details && process.env.VERBOSE) {
      console.log('   Details:', JSON.stringify(result.details, null, 2));
    }
  });

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log(`\n📈 Summary: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run the tests
runAuthTests().catch(console.error);