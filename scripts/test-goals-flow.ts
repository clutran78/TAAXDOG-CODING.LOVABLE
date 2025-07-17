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
): Promise<any> {
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
      return data;
    } else {
      results.push({
        test: name,
        status: 'FAIL',
        message: `Expected ${expectedStatus}, got ${response.status}`,
        details: data,
      });
      return null;
    }
  } catch (error: any) {
    results.push({
      test: name,
      status: 'FAIL',
      message: error.message,
    });
    return null;
  }
}

async function runGoalTests() {
  console.log('🎯 Testing Goal Operations with PostgreSQL...\n');

  // Test 1: Create a new goal
  const newGoal = await testEndpoint(
    'Create new goal',
    'POST',
    '/api/goals',
    {
      title: 'Test Goal',
      description: 'This is a test goal',
      targetAmount: 1000,
      currentAmount: 0,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      category: 'savings',
    }
  );

  const goalId = newGoal?.id;

  if (goalId) {
    // Test 2: Get all goals
    await testEndpoint(
      'Get all goals',
      'GET',
      '/api/goals'
    );

    // Test 3: Get specific goal
    await testEndpoint(
      'Get specific goal',
      'GET',
      `/api/goals/${goalId}`
    );

    // Test 4: Update goal progress
    await testEndpoint(
      'Update goal progress',
      'PUT',
      `/api/goals/${goalId}/progress`,
      {
        currentAmount: 250,
      }
    );

    // Test 5: Update goal details
    await testEndpoint(
      'Update goal details',
      'PUT',
      `/api/goals/${goalId}`,
      {
        title: 'Updated Test Goal',
        targetAmount: 1500,
      }
    );

    // Test 6: Delete goal
    await testEndpoint(
      'Delete goal',
      'DELETE',
      `/api/goals/${goalId}`,
      null,
      204
    );
  }

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
runGoalTests().catch(console.error);