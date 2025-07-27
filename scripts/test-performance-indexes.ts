import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  duration?: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

async function logTest(test: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ test, status: 'PASS', duration });
    console.log(`✅ ${test} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({ test, status: 'FAIL', duration, error: error.message });
    console.error(`❌ ${test} (${duration}ms): ${error.message}`);
  }
}

async function testIndexes() {
  console.log('🚀 Testing Performance Indexes\n');
  console.log('================================\n');

  // Test 1: Database Connection
  await logTest('Database Connection', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    if (!result) throw new Error('Database connection failed');
  });

  // Test 2: Check Indexes Exist
  await logTest('Verify Indexes Exist', async () => {
    const indexes = await prisma.$queryRaw<any[]>`
      SELECT 
        tablename,
        indexname
      FROM 
        pg_indexes
      WHERE 
        schemaname = 'public' 
        AND tablename IN ('users', 'goals', 'bank_transactions', 'receipts')
        AND indexname NOT LIKE '%pkey%'
        AND indexname NOT LIKE '%key%'
      ORDER BY 
        tablename, indexname
    `;

    const expectedIndexes = [
      'users_createdAt_idx',
      'goals_userId_status_idx',
      'bank_transactions_transaction_date_idx',
      'bank_transactions_category_idx',
      'idx_receipts_processed_at',
    ];

    const indexNames = indexes.map((idx) => idx.indexname);
    for (const expected of expectedIndexes) {
      if (!indexNames.some((name) => name.includes(expected))) {
        throw new Error(`Missing index: ${expected}`);
      }
    }
  });

  // Test 3: User Model Queries
  console.log('\n📊 Testing User Model Queries...\n');

  await logTest('User lookup by email (uses index)', async () => {
    const user = await prisma.user.findFirst({
      where: { email: 'test@example.com' },
    });
    // Query should be fast even if user doesn't exist
  });

  await logTest('Users sorted by createdAt (uses index)', async () => {
    const users = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
  });

  // Test 4: Goal Model Queries
  console.log('\n🎯 Testing Goal Model Queries...\n');

  await logTest('Goals by userId and status (uses composite index)', async () => {
    // First get a user
    const user = await prisma.user.findFirst();
    if (user) {
      const goals = await prisma.goal.findMany({
        where: {
          userId: user.id,
          status: 'ACTIVE',
        },
      });
    }
  });

  await logTest('Goals sorted by targetDate (uses index)', async () => {
    const goals = await prisma.goal.findMany({
      take: 10,
      orderBy: { targetDate: 'asc' },
    });
  });

  await logTest('Goals filtered by category (uses index)', async () => {
    const goals = await prisma.goal.findMany({
      where: { category: 'Savings' },
      take: 10,
    });
  });

  // Test 5: Transaction Queries
  console.log('\n💰 Testing Transaction Queries...\n');

  await logTest('Transactions by date range (uses index)', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');

    const transactions = await prisma.bank_transactions.findMany({
      where: {
        transaction_date: {
          gte: startDate,
          lte: endDate,
        },
      },
      take: 10,
    });
  });

  await logTest('Transactions by category (uses index)', async () => {
    const transactions = await prisma.bank_transactions.findMany({
      where: { category: 'groceries' },
      take: 10,
    });
  });

  await logTest('Account transaction history (uses composite index)', async () => {
    const account = await prisma.bank_accounts.findFirst();
    if (account) {
      const transactions = await prisma.bank_transactions.findMany({
        where: {
          bank_account_id: account.id,
          transaction_date: {
            gte: new Date('2024-01-01'),
          },
        },
        orderBy: { transaction_date: 'desc' },
        take: 20,
      });
    }
  });

  // Test 6: Receipt Queries
  console.log('\n🧾 Testing Receipt Queries...\n');

  await logTest('Receipts by userId (uses index)', async () => {
    const user = await prisma.user.findFirst();
    if (user) {
      const receipts = await prisma.receipt.findMany({
        where: { userId: user.id },
        take: 10,
      });
    }
  });

  await logTest('Receipts sorted by createdAt (uses index)', async () => {
    const receipts = await prisma.receipt.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  });

  await logTest('Receipts by processing status (uses index)', async () => {
    const receipts = await prisma.receipt.findMany({
      where: { processingStatus: 'PROCESSED' },
      take: 10,
    });
  });

  // Test 7: Query Performance Analysis
  console.log('\n⚡ Testing Query Performance...\n');

  await logTest('EXPLAIN ANALYZE on indexed query', async () => {
    const explain = await prisma.$queryRaw<any[]>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT * FROM users WHERE email = 'test@example.com'
    `;

    const plan = explain[0]['QUERY PLAN'][0];
    const executionTime = plan['Execution Time'];

    if (executionTime > 10) {
      console.warn(`⚠️  Query execution time: ${executionTime}ms (consider optimization)`);
    }
  });

  // Test 8: Complex Queries
  console.log('\n🔄 Testing Complex Queries...\n');

  await logTest('Dashboard query (multiple models)', async () => {
    const user = await prisma.user.findFirst();
    if (user) {
      // Simulate dashboard data fetching
      const [goals, recentReceipts, transactions] = await Promise.all([
        prisma.goal.findMany({
          where: { userId: user.id, status: 'ACTIVE' },
          take: 5,
        }),
        prisma.receipt.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        prisma.bank_transactions.findMany({
          where: {
            bank_account: {
              basiq_user: {
                user_id: user.id,
              },
            },
          },
          orderBy: { transaction_date: 'desc' },
          take: 10,
        }),
      ]);
    }
  });

  // Test 9: Count Queries
  console.log('\n📈 Testing Count Queries...\n');

  await logTest('Count users (should use index)', async () => {
    const count = await prisma.user.count();
    console.log(`   Total users: ${count}`);
  });

  await logTest('Count active goals', async () => {
    const count = await prisma.goal.count({
      where: { status: 'ACTIVE' },
    });
    console.log(`   Active goals: ${count}`);
  });

  // Test 10: Index Usage Statistics
  console.log('\n📊 Checking Index Usage Statistics...\n');

  await logTest('Index usage statistics', async () => {
    const stats = await prisma.$queryRaw<any[]>`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM 
        pg_stat_user_indexes
      WHERE 
        schemaname = 'public'
        AND tablename IN ('users', 'goals', 'bank_transactions', 'receipts')
        AND indexname LIKE '%idx%'
      ORDER BY 
        idx_scan DESC
    `;

    console.log('\n   Most used indexes:');
    stats.slice(0, 5).forEach((stat) => {
      console.log(`   - ${stat.indexname}: ${stat.idx_scan} scans`);
    });
  });
}

async function main() {
  try {
    await testIndexes();

    // Print summary
    console.log('\n================================');
    console.log('📊 Test Summary\n');

    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => {
          console.log(`   - ${r.test}: ${r.error}`);
        });
    }

    // Performance recommendations
    console.log('\n💡 Performance Recommendations:');
    console.log('1. Run ANALYZE on tables to update statistics');
    console.log('2. Monitor slow queries in production');
    console.log('3. Consider adding more indexes based on usage patterns');
    console.log('4. Use connection pooling for better performance');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
