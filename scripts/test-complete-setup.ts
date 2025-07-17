import { prisma } from '../lib/prisma';
import { checkDatabaseHealth } from '../lib/prisma-optimized';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message?: string;
  details?: any;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<boolean>): Promise<void> {
  try {
    const success = await testFn();
    results.push({
      test: name,
      status: success ? 'PASS' : 'FAIL',
      message: success ? 'OK' : 'Test failed'
    });
  } catch (error: any) {
    results.push({
      test: name,
      status: 'FAIL',
      message: error.message
    });
  }
}

async function runCompleteTests() {
  console.log('🔍 Running Complete Setup Tests...\n');

  // Test 1: Database Connection
  await runTest('Database Connection', async () => {
    const health = await checkDatabaseHealth();
    console.log('Database health:', health);
    return health.status === 'healthy';
  });

  // Test 2: Prisma Client
  await runTest('Prisma Client Query', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    return Array.isArray(result) && result.length > 0;
  });

  // Test 3: User Table Access
  await runTest('User Table Access', async () => {
    const count = await prisma.user.count();
    console.log(`Found ${count} users in database`);
    return typeof count === 'number';
  });

  // Test 4: Goal Table Access
  await runTest('Goal Table Access', async () => {
    const count = await prisma.goal.count();
    console.log(`Found ${count} goals in database`);
    return typeof count === 'number';
  });

  // Test 5: Create Test User
  const testEmail = `test-${Date.now()}@example.com`;
  let testUserId: string | null = null;
  
  await runTest('Create Test User', async () => {
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'Test User',
        password: 'hashed_password_here',
      }
    });
    testUserId = user.id;
    console.log('Created test user:', user.id);
    return !!user.id;
  });

  // Test 6: Create Test Goal
  if (testUserId) {
    await runTest('Create Test Goal', async () => {
      const goal = await prisma.goal.create({
        data: {
          title: 'Test Goal',
          targetAmount: 1000,
          currentAmount: 0,
          targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          userId: testUserId!,
          category: 'savings',
          status: 'ACTIVE'
        }
      });
      console.log('Created test goal:', goal.id);
      return !!goal.id;
    });
  }

  // Test 7: Clean up test data
  if (testUserId) {
    await runTest('Clean Up Test Data', async () => {
      await prisma.goal.deleteMany({
        where: { userId: testUserId! }
      });
      await prisma.user.delete({
        where: { id: testUserId! }
      });
      return true;
    });
  }

  // Print results
  console.log('\n📊 Test Results:\n');
  results.forEach((result) => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.message || 'OK'}`);
  });

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log(`\n📈 Summary: ${passed} passed, ${failed} failed`);
  
  // Disconnect from database
  await prisma.$disconnect();
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run the tests
runCompleteTests().catch(console.error);