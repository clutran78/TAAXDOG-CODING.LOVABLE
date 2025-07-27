#!/usr/bin/env ts-node

import { prisma } from '../lib/prisma';
import { logger } from '../lib/utils/logger';
import { performance } from 'perf_hooks';

interface QueryTest {
  name: string;
  query: () => Promise<any>;
  expectedTime: number; // milliseconds
}

/**
 * Database Query Performance Testing
 */

async function measureQuery(
  name: string,
  query: () => Promise<any>,
): Promise<{ name: string; duration: number; result: any }> {
  const start = performance.now();
  let result;
  let error;

  try {
    result = await query();
  } catch (e) {
    error = e;
  }

  const duration = performance.now() - start;

  if (error) {
    throw error;
  }

  return { name, duration, result };
}

async function runPerformanceTests() {
  console.log('🚀 Database Query Performance Testing\n');

  // Create test data
  console.log('Setting up test data...');
  const testUser = await prisma.user.upsert({
    where: { email: 'perf-test@example.com' },
    update: {},
    create: {
      email: 'perf-test@example.com',
      password: 'hashed-password',
      name: 'Performance Test User',
    },
  });

  console.log(`Test user ID: ${testUser.id}\n`);

  const tests: QueryTest[] = [
    // 1. User queries
    {
      name: 'Simple user lookup by ID',
      query: () => prisma.user.findUnique({ where: { id: testUser.id } }),
      expectedTime: 50,
    },
    {
      name: 'User lookup with relations',
      query: () =>
        prisma.user.findUnique({
          where: { id: testUser.id },
          include: {
            transactions: { take: 10 },
            goals: true,
            budgets: true,
          },
        }),
      expectedTime: 100,
    },

    // 2. Transaction queries
    {
      name: 'Recent transactions (limit 50)',
      query: () =>
        prisma.transaction.findMany({
          where: { userId: testUser.id },
          orderBy: { date: 'desc' },
          take: 50,
        }),
      expectedTime: 100,
    },
    {
      name: 'Transactions with pagination',
      query: () =>
        prisma.transaction.findMany({
          where: { userId: testUser.id },
          orderBy: { date: 'desc' },
          skip: 0,
          take: 20,
          include: { category: true },
        }),
      expectedTime: 150,
    },
    {
      name: 'Transaction aggregation (monthly spending)',
      query: () =>
        prisma.transaction.groupBy({
          by: ['categoryId'],
          where: {
            userId: testUser.id,
            date: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            },
          },
          _sum: { amount: true },
          _count: true,
        }),
      expectedTime: 200,
    },

    // 3. Complex queries
    {
      name: 'User dashboard data (optimized)',
      query: async () => {
        const [user, recentTransactions, goals, budgets] = await Promise.all([
          prisma.user.findUnique({ where: { id: testUser.id } }),
          prisma.transaction.findMany({
            where: { userId: testUser.id },
            orderBy: { date: 'desc' },
            take: 10,
          }),
          prisma.goal.findMany({ where: { userId: testUser.id } }),
          prisma.budget.findMany({ where: { userId: testUser.id } }),
        ]);
        return { user, recentTransactions, goals, budgets };
      },
      expectedTime: 300,
    },

    // 4. Count queries
    {
      name: 'Count total transactions',
      query: () => prisma.transaction.count({ where: { userId: testUser.id } }),
      expectedTime: 50,
    },
    {
      name: 'Count with filter',
      query: () =>
        prisma.transaction.count({
          where: {
            userId: testUser.id,
            amount: { gte: 100 },
            date: { gte: new Date(new Date().setMonth(new Date().getMonth() - 3)) },
          },
        }),
      expectedTime: 100,
    },

    // 5. Search queries
    {
      name: 'Transaction search by description',
      query: () =>
        prisma.transaction.findMany({
          where: {
            userId: testUser.id,
            description: { contains: 'coffee', mode: 'insensitive' },
          },
          take: 20,
        }),
      expectedTime: 150,
    },

    // 6. Raw SQL queries (parameterized)
    {
      name: 'Raw SQL - Monthly spending summary',
      query: () => prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', date) as month,
          SUM(amount) as total,
          COUNT(*) as transaction_count
        FROM "Transaction"
        WHERE "userId" = ${testUser.id}
          AND date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', date)
        ORDER BY month DESC
      `,
      expectedTime: 200,
    },
  ];

  const results: any[] = [];
  let passed = 0;
  let failed = 0;

  console.log('Running performance tests...\n');
  console.log('Test Name                                          | Duration | Status | Expected');
  console.log('---------------------------------------------------|----------|--------|----------');

  for (const test of tests) {
    try {
      const result = await measureQuery(test.name, test.query);
      const status = result.duration <= test.expectedTime ? '✅ PASS' : '⚠️  SLOW';
      const statusColor = result.duration <= test.expectedTime ? '\x1b[32m' : '\x1b[33m';

      console.log(
        `${test.name.padEnd(50)} | ${result.duration.toFixed(2).padStart(6)}ms | ${statusColor}${status}\x1b[0m | <${test.expectedTime}ms`,
      );

      if (result.duration <= test.expectedTime) {
        passed++;
      } else {
        failed++;
      }

      results.push({
        ...result,
        expected: test.expectedTime,
        passed: result.duration <= test.expectedTime,
      });

      // Log to monitoring
      logger.info('Query performance test', {
        test: test.name,
        duration: result.duration,
        expected: test.expectedTime,
        passed: result.duration <= test.expectedTime,
      });
    } catch (error) {
      console.log(
        `${test.name.padEnd(50)} | ${' ERROR'.padStart(6)} | \x1b[31m❌ FAIL\x1b[0m | <${test.expectedTime}ms`,
      );
      console.error(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(90));
  console.log(`Summary: ${passed} passed, ${failed} failed/slow`);

  // Analyze results
  console.log('\n📊 Performance Analysis:');

  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const slowQueries = results.filter((r) => !r.passed);

  console.log(`  Average query time: ${avgDuration.toFixed(2)}ms`);
  console.log(
    `  Fastest query: ${results.sort((a, b) => a.duration - b.duration)[0].name} (${results[0].duration.toFixed(2)}ms)`,
  );
  console.log(
    `  Slowest query: ${results.sort((a, b) => b.duration - a.duration)[0].name} (${results[results.length - 1].duration.toFixed(2)}ms)`,
  );

  if (slowQueries.length > 0) {
    console.log('\n⚠️  Slow queries that need optimization:');
    slowQueries.forEach((q) => {
      console.log(`  - ${q.name}: ${q.duration.toFixed(2)}ms (expected <${q.expected}ms)`);
    });
  }

  // Test concurrent queries
  console.log('\n🔄 Testing concurrent query performance...');
  const concurrentStart = performance.now();

  await Promise.all([
    prisma.user.findMany({ take: 10 }),
    prisma.transaction.findMany({ take: 50 }),
    prisma.goal.findMany({ take: 20 }),
    prisma.budget.findMany({ take: 20 }),
  ]);

  const concurrentDuration = performance.now() - concurrentStart;
  console.log(`  4 concurrent queries completed in ${concurrentDuration.toFixed(2)}ms`);

  // Test connection pooling
  console.log('\n🔗 Testing connection pooling...');
  const poolTestStart = performance.now();
  const poolPromises = [];

  for (let i = 0; i < 20; i++) {
    poolPromises.push(prisma.user.count());
  }

  await Promise.all(poolPromises);
  const poolDuration = performance.now() - poolTestStart;
  console.log(`  20 parallel queries completed in ${poolDuration.toFixed(2)}ms`);
  console.log(`  Average per query: ${(poolDuration / 20).toFixed(2)}ms`);

  // Cleanup test data
  console.log('\nCleaning up test data...');
  await prisma.transaction.deleteMany({ where: { userId: testUser.id } });
  await prisma.goal.deleteMany({ where: { userId: testUser.id } });
  await prisma.budget.deleteMany({ where: { userId: testUser.id } });
  await prisma.user.delete({ where: { id: testUser.id } });

  return {
    passed,
    failed,
    avgDuration,
    results,
  };
}

// Run tests
runPerformanceTests()
  .then((summary) => {
    console.log('\n✅ Performance testing completed');
    if (summary.failed > 0) {
      console.log(`⚠️  ${summary.failed} queries performed slower than expected`);
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Performance testing failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
