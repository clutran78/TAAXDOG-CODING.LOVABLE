import fetch from 'node-fetch';

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

async function testEndpoint(
  endpoint: string,
  method: string = 'GET',
  options: any = {}
): Promise<void> {
  const start = Date.now();
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const duration = Date.now() - start;
    const success = response.ok;

    results.push({
      endpoint,
      method,
      status: response.status,
      success,
      duration,
    });

    if (success) {
      console.log(`✅ ${method} ${endpoint} - ${response.status} (${duration}ms)`);
    } else {
      const text = await response.text();
      console.error(`❌ ${method} ${endpoint} - ${response.status} (${duration}ms)`);
      if (text) console.error(`   Response: ${text.substring(0, 100)}...`);
    }
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({
      endpoint,
      method,
      status: 0,
      success: false,
      duration,
      error: error.message,
    });
    console.error(`❌ ${method} ${endpoint} - ERROR (${duration}ms): ${error.message}`);
  }
}

async function runTests() {
  console.log(`🚀 Testing API Endpoints at ${BASE_URL}\n`);
  console.log('================================\n');

  // Test Health Endpoints
  console.log('🏥 Testing Health Endpoints...\n');
  await testEndpoint('/api/health');
  await testEndpoint('/api/health/liveness');
  await testEndpoint('/api/health/readiness');

  // Test Auth Endpoints (unauthenticated)
  console.log('\n🔐 Testing Auth Endpoints...\n');
  await testEndpoint('/api/auth/sessions');
  
  // Test registration with invalid data (should fail with 400)
  await testEndpoint('/api/auth/register', 'POST', {
    body: { email: 'invalid-email' },
  });

  // Test Public Endpoints
  console.log('\n📖 Testing Public Endpoints...\n');
  await testEndpoint('/api/stripe/create-checkout-session', 'POST', {
    body: { priceId: 'test' }, // Should fail without proper auth
  });

  // Test Goal Endpoints (should require auth)
  console.log('\n🎯 Testing Goal Endpoints...\n');
  await testEndpoint('/api/goals');
  
  // Test Receipt Endpoints (should require auth)
  console.log('\n🧾 Testing Receipt Endpoints...\n');
  await testEndpoint('/api/receipts');

  // Test AI Endpoints (should require auth)
  console.log('\n🤖 Testing AI Endpoints...\n');
  await testEndpoint('/api/ai/insights');

  // Print Summary
  console.log('\n================================');
  console.log('📊 API Test Summary\n');

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration = Math.round(totalDuration / results.length);

  console.log(`Total Endpoints Tested: ${results.length}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Average Response Time: ${avgDuration}ms`);

  // Group results by status code
  const statusCodes = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  console.log('\n📈 Response Status Codes:');
  Object.entries(statusCodes)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([status, count]) => {
      console.log(`   ${status}: ${count} requests`);
    });

  // Show slowest endpoints
  const slowest = results
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5);

  console.log('\n🐌 Slowest Endpoints:');
  slowest.forEach((r) => {
    console.log(`   ${r.method} ${r.endpoint}: ${r.duration}ms`);
  });

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Add node-fetch import check
async function checkDependencies() {
  try {
    await import('node-fetch');
  } catch (error) {
    console.error('❌ node-fetch is not installed. Installing...');
    const { execSync } = require('child_process');
    execSync('npm install --save-dev @types/node-fetch@2', { stdio: 'inherit' });
    console.log('✅ Dependencies installed. Please run the script again.');
    process.exit(0);
  }
}

// Run tests
(async () => {
  await checkDependencies();
  await runTests();
})();