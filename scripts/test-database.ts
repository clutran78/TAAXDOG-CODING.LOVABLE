#!/usr/bin/env ts-node

/**
 * Database Testing Script
 * Tests database connectivity, user data isolation, and CRUD operations
 * 
 * Usage: npm run test-db or ts-node scripts/test-database.ts
 */

import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import chalk from 'chalk';
import { z } from 'zod';

// Initialize Prisma client
const prisma = new PrismaClient({
  log: process.env.DEBUG ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Test results interface
interface TestResult {
  name: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  duration: number;
  error?: string;
  details?: Record<string, unknown>;
}

// Test suite class
class DatabaseTestSuite {
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor(private prisma: PrismaClient) {}

  // Helper to run a test
  private async runTest(
    name: string,
    testFn: () => Promise<void>,
    cleanup?: () => Promise<void>
  ): Promise<TestResult> {
    const start = performance.now();
    const result: TestResult = {
      name,
      status: 'PASSED',
      duration: 0,
    };

    try {
      await testFn();
      console.log(chalk.green('✓'), chalk.gray(name));
    } catch (error) {
      result.status = 'FAILED';
      result.error = error instanceof Error ? error.message : String(error);
      console.log(chalk.red('✗'), chalk.gray(name));
      console.log(chalk.red(`  Error: ${result.error}`));
    } finally {
      result.duration = performance.now() - start;
      
      // Run cleanup if provided
      if (cleanup) {
        try {
          await cleanup();
        } catch (cleanupError) {
          console.log(chalk.yellow(`  Cleanup failed: ${cleanupError}`));
        }
      }
    }

    this.results.push(result);
    return result;
  }

  // Test database connectivity
  async testConnectivity(): Promise<TestResult> {
    return this.runTest('Database Connectivity', async () => {
      const result = await this.prisma.$queryRaw`SELECT 1 as connected`;
      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new Error('Failed to execute test query');
      }
    });
  }

  // Test database version and configuration
  async testDatabaseInfo(): Promise<TestResult> {
    return this.runTest('Database Information', async () => {
      const version = await this.prisma.$queryRaw`SELECT version()`;
      const timezone = await this.prisma.$queryRaw`SHOW timezone`;
      const encoding = await this.prisma.$queryRaw`SHOW server_encoding`;
      
      console.log(chalk.gray(`  Version: ${JSON.stringify(version)}`));
      console.log(chalk.gray(`  Timezone: ${JSON.stringify(timezone)}`));
      console.log(chalk.gray(`  Encoding: ${JSON.stringify(encoding)}`));
    });
  }

  // Test table existence
  async testTableExistence(): Promise<TestResult> {
    return this.runTest('Table Existence', async () => {
      const tables = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
      `;

      const expectedTables = [
        'User',
        'Account',
        'Session',
        'VerificationToken',
        'PasswordResetToken',
        'Subscription',
        'Transaction',
        'TaxReturn',
        'Receipt',
        'BankConnection',
        'AIInsight',
        'AuditLog',
        '_prisma_migrations',
      ];

      const tableNames = tables.map(t => t.tablename);
      const missingTables = expectedTables.filter(t => !tableNames.includes(t));

      if (missingTables.length > 0) {
        throw new Error(`Missing tables: ${missingTables.join(', ')}`);
      }

      console.log(chalk.gray(`  Found ${tableNames.length} tables`));
    });
  }

  // Test user CRUD operations
  async testUserCRUD(): Promise<TestResult> {
    const testEmail = `test-${crypto.randomUUID()}@example.com`;
    let userId: string | null = null;

    return this.runTest(
      'User CRUD Operations',
      async () => {
        // CREATE
        const user = await this.prisma.user.create({
          data: {
            email: testEmail,
            name: 'Test User',
            password: 'hashed_password_123',
            role: 'USER',
          },
        });
        userId = user.id;
        console.log(chalk.gray(`  Created user: ${user.id}`));

        // READ
        const foundUser = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        if (!foundUser || foundUser.email !== testEmail) {
          throw new Error('Failed to read created user');
        }

        // UPDATE
        const updatedUser = await this.prisma.user.update({
          where: { id: userId },
          data: { name: 'Updated Test User' },
        });
        if (updatedUser.name !== 'Updated Test User') {
          throw new Error('Failed to update user');
        }

        // DELETE
        await this.prisma.user.delete({
          where: { id: userId },
        });
        userId = null;

        // Verify deletion
        const deletedUser = await this.prisma.user.findUnique({
          where: { id: user.id },
        });
        if (deletedUser) {
          throw new Error('Failed to delete user');
        }
      },
      async () => {
        // Cleanup in case of failure
        if (userId) {
          await this.prisma.user.delete({ where: { id: userId } }).catch(() => {});
        }
      }
    );
  }

  // Test user data isolation
  async testUserDataIsolation(): Promise<TestResult> {
    const user1Email = `user1-${crypto.randomUUID()}@example.com`;
    const user2Email = `user2-${crypto.randomUUID()}@example.com`;
    let user1Id: string | null = null;
    let user2Id: string | null = null;

    return this.runTest(
      'User Data Isolation',
      async () => {
        // Create two users
        const user1 = await this.prisma.user.create({
          data: {
            email: user1Email,
            name: 'User 1',
            password: 'password1',
            role: 'USER',
          },
        });
        user1Id = user1.id;

        const user2 = await this.prisma.user.create({
          data: {
            email: user2Email,
            name: 'User 2',
            password: 'password2',
            role: 'USER',
          },
        });
        user2Id = user2.id;

        // Create transactions for each user
        const tx1 = await this.prisma.transaction.create({
          data: {
            userId: user1Id,
            amount: 100.0,
            description: 'User 1 Transaction',
            date: new Date(),
            type: 'EXPENSE',
            category: 'D1',
          },
        });

        const tx2 = await this.prisma.transaction.create({
          data: {
            userId: user2Id,
            amount: 200.0,
            description: 'User 2 Transaction',
            date: new Date(),
            type: 'EXPENSE',
            category: 'D2',
          },
        });

        // Test isolation - User 1 should only see their transactions
        const user1Transactions = await this.prisma.transaction.findMany({
          where: { userId: user1Id },
        });

        if (user1Transactions.length !== 1) {
          throw new Error(`Expected 1 transaction for user1, got ${user1Transactions.length}`);
        }

        if (user1Transactions[0].amount !== 100.0) {
          throw new Error('User 1 retrieved wrong transaction data');
        }

        // Test isolation - User 2 should only see their transactions
        const user2Transactions = await this.prisma.transaction.findMany({
          where: { userId: user2Id },
        });

        if (user2Transactions.length !== 1) {
          throw new Error(`Expected 1 transaction for user2, got ${user2Transactions.length}`);
        }

        if (user2Transactions[0].amount !== 200.0) {
          throw new Error('User 2 retrieved wrong transaction data');
        }

        console.log(chalk.gray('  Data isolation verified successfully'));
      },
      async () => {
        // Cleanup
        if (user1Id) {
          await this.prisma.transaction.deleteMany({ where: { userId: user1Id } }).catch(() => {});
          await this.prisma.user.delete({ where: { id: user1Id } }).catch(() => {});
        }
        if (user2Id) {
          await this.prisma.transaction.deleteMany({ where: { userId: user2Id } }).catch(() => {});
          await this.prisma.user.delete({ where: { id: user2Id } }).catch(() => {});
        }
      }
    );
  }

  // Test transaction operations
  async testTransactionOperations(): Promise<TestResult> {
    const userEmail = `tx-test-${crypto.randomUUID()}@example.com`;
    let userId: string | null = null;

    return this.runTest(
      'Transaction Operations',
      async () => {
        // Create test user
        const user = await this.prisma.user.create({
          data: {
            email: userEmail,
            name: 'Transaction Test User',
            password: 'password',
            role: 'USER',
          },
        });
        userId = user.id;

        // Test batch insert
        const transactions = await this.prisma.transaction.createMany({
          data: [
            {
              userId,
              amount: 50.0,
              description: 'Coffee',
              date: new Date(),
              type: 'EXPENSE',
              category: 'D1',
              gst: 5.0,
            },
            {
              userId,
              amount: 1000.0,
              description: 'Salary',
              date: new Date(),
              type: 'INCOME',
              category: 'INCOME',
            },
            {
              userId,
              amount: 200.0,
              description: 'Office Supplies',
              date: new Date(),
              type: 'EXPENSE',
              category: 'D10',
              gst: 20.0,
            },
          ],
        });

        if (transactions.count !== 3) {
          throw new Error(`Expected 3 transactions created, got ${transactions.count}`);
        }

        // Test aggregation
        const summary = await this.prisma.transaction.aggregate({
          where: { userId },
          _sum: { amount: true, gst: true },
          _count: true,
          _avg: { amount: true },
        });

        if (summary._count !== 3) {
          throw new Error('Aggregation count mismatch');
        }

        if (summary._sum.amount !== 1250.0) {
          throw new Error(`Expected sum of 1250, got ${summary._sum.amount}`);
        }

        // Test filtering
        const expenses = await this.prisma.transaction.findMany({
          where: {
            userId,
            type: 'EXPENSE',
          },
          orderBy: { amount: 'desc' },
        });

        if (expenses.length !== 2) {
          throw new Error(`Expected 2 expenses, got ${expenses.length}`);
        }

        if (expenses[0].amount !== 200.0) {
          throw new Error('Order by not working correctly');
        }

        console.log(chalk.gray('  Transaction operations completed successfully'));
      },
      async () => {
        if (userId) {
          await this.prisma.transaction.deleteMany({ where: { userId } }).catch(() => {});
          await this.prisma.user.delete({ where: { id: userId } }).catch(() => {});
        }
      }
    );
  }

  // Test relationships
  async testRelationships(): Promise<TestResult> {
    const userEmail = `rel-test-${crypto.randomUUID()}@example.com`;
    let userId: string | null = null;

    return this.runTest(
      'Relationship Tests',
      async () => {
        // Create user with related data
        const user = await this.prisma.user.create({
          data: {
            email: userEmail,
            name: 'Relationship Test User',
            password: 'password',
            role: 'USER',
            subscription: {
              create: {
                planId: 'TAAX_SMART',
                status: 'ACTIVE',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                stripeCustomerId: `cus_${crypto.randomUUID()}`,
                stripeSubscriptionId: `sub_${crypto.randomUUID()}`,
              },
            },
            transactions: {
              create: [
                {
                  amount: 100.0,
                  description: 'Test Transaction 1',
                  date: new Date(),
                  type: 'EXPENSE',
                  category: 'D1',
                },
                {
                  amount: 200.0,
                  description: 'Test Transaction 2',
                  date: new Date(),
                  type: 'EXPENSE',
                  category: 'D2',
                },
              ],
            },
          },
          include: {
            subscription: true,
            transactions: true,
          },
        });
        userId = user.id;

        if (!user.subscription) {
          throw new Error('Subscription not created');
        }

        if (user.transactions.length !== 2) {
          throw new Error(`Expected 2 transactions, got ${user.transactions.length}`);
        }

        // Test cascade operations
        const transactionCount = await this.prisma.transaction.count({
          where: { userId },
        });

        if (transactionCount !== 2) {
          throw new Error('Transaction count mismatch');
        }

        console.log(chalk.gray('  Relationships verified successfully'));
      },
      async () => {
        if (userId) {
          await this.prisma.subscription.deleteMany({ where: { userId } }).catch(() => {});
          await this.prisma.transaction.deleteMany({ where: { userId } }).catch(() => {});
          await this.prisma.user.delete({ where: { id: userId } }).catch(() => {});
        }
      }
    );
  }

  // Test concurrent operations
  async testConcurrentOperations(): Promise<TestResult> {
    const baseEmail = `concurrent-${crypto.randomUUID()}`;
    const userIds: string[] = [];

    return this.runTest(
      'Concurrent Operations',
      async () => {
        // Create multiple users concurrently
        const createPromises = Array.from({ length: 5 }, (_, i) =>
          this.prisma.user.create({
            data: {
              email: `${baseEmail}-${i}@example.com`,
              name: `Concurrent User ${i}`,
              password: 'password',
              role: 'USER',
            },
          })
        );

        const users = await Promise.all(createPromises);
        userIds.push(...users.map(u => u.id));

        if (users.length !== 5) {
          throw new Error('Failed to create users concurrently');
        }

        // Perform concurrent updates
        const updatePromises = users.map((user, i) =>
          this.prisma.user.update({
            where: { id: user.id },
            data: { name: `Updated User ${i}` },
          })
        );

        const updatedUsers = await Promise.all(updatePromises);

        // Verify updates
        const allUpdated = updatedUsers.every((user, i) => 
          user.name === `Updated User ${i}`
        );

        if (!allUpdated) {
          throw new Error('Concurrent updates failed');
        }

        console.log(chalk.gray('  Concurrent operations completed successfully'));
      },
      async () => {
        // Cleanup all created users
        if (userIds.length > 0) {
          await this.prisma.user.deleteMany({
            where: { id: { in: userIds } },
          }).catch(() => {});
        }
      }
    );
  }

  // Test database constraints
  async testConstraints(): Promise<TestResult> {
    return this.runTest('Database Constraints', async () => {
      const testEmail = `constraint-${crypto.randomUUID()}@example.com`;
      let userId: string | null = null;

      try {
        // Create initial user
        const user = await this.prisma.user.create({
          data: {
            email: testEmail,
            name: 'Constraint Test',
            password: 'password',
            role: 'USER',
          },
        });
        userId = user.id;

        // Test unique constraint
        let uniqueViolation = false;
        try {
          await this.prisma.user.create({
            data: {
              email: testEmail, // Duplicate email
              name: 'Duplicate User',
              password: 'password',
              role: 'USER',
            },
          });
        } catch (error) {
          uniqueViolation = true;
        }

        if (!uniqueViolation) {
          throw new Error('Unique constraint not enforced on email');
        }

        // Test foreign key constraint
        let fkViolation = false;
        try {
          await this.prisma.transaction.create({
            data: {
              userId: 'non-existent-user-id',
              amount: 100.0,
              description: 'Test',
              date: new Date(),
              type: 'EXPENSE',
              category: 'D1',
            },
          });
        } catch (error) {
          fkViolation = true;
        }

        if (!fkViolation) {
          throw new Error('Foreign key constraint not enforced');
        }

        console.log(chalk.gray('  Constraints verified successfully'));
      } finally {
        if (userId) {
          await this.prisma.user.delete({ where: { id: userId } }).catch(() => {});
        }
      }
    });
  }

  // Test performance benchmarks
  async testPerformance(): Promise<TestResult> {
    const userEmail = `perf-${crypto.randomUUID()}@example.com`;
    let userId: string | null = null;

    return this.runTest(
      'Performance Benchmarks',
      async () => {
        // Create test user
        const user = await this.prisma.user.create({
          data: {
            email: userEmail,
            name: 'Performance Test User',
            password: 'password',
            role: 'USER',
          },
        });
        userId = user.id;

        // Benchmark: Insert 100 transactions
        const insertStart = performance.now();
        await this.prisma.transaction.createMany({
          data: Array.from({ length: 100 }, (_, i) => ({
            userId,
            amount: Math.random() * 1000,
            description: `Transaction ${i}`,
            date: new Date(),
            type: i % 2 === 0 ? 'EXPENSE' : 'INCOME' as const,
            category: `D${(i % 15) + 1}`,
          })),
        });
        const insertDuration = performance.now() - insertStart;

        // Benchmark: Query with filters
        const queryStart = performance.now();
        const results = await this.prisma.transaction.findMany({
          where: {
            userId,
            type: 'EXPENSE',
            amount: { gte: 500 },
          },
          orderBy: { date: 'desc' },
          take: 10,
        });
        const queryDuration = performance.now() - queryStart;

        // Benchmark: Aggregation
        const aggStart = performance.now();
        const aggregation = await this.prisma.transaction.groupBy({
          by: ['category'],
          where: { userId },
          _sum: { amount: true },
          _count: true,
        });
        const aggDuration = performance.now() - aggStart;

        console.log(chalk.gray(`  Insert 100 records: ${insertDuration.toFixed(2)}ms`));
        console.log(chalk.gray(`  Query with filters: ${queryDuration.toFixed(2)}ms`));
        console.log(chalk.gray(`  Aggregation query: ${aggDuration.toFixed(2)}ms`));

        // Performance thresholds
        if (insertDuration > 5000) {
          console.log(chalk.yellow('  Warning: Insert performance is slow'));
        }
        if (queryDuration > 1000) {
          console.log(chalk.yellow('  Warning: Query performance is slow'));
        }
        if (aggDuration > 2000) {
          console.log(chalk.yellow('  Warning: Aggregation performance is slow'));
        }
      },
      async () => {
        if (userId) {
          await this.prisma.transaction.deleteMany({ where: { userId } }).catch(() => {});
          await this.prisma.user.delete({ where: { id: userId } }).catch(() => {});
        }
      }
    );
  }

  // Run all tests
  async runAll(): Promise<void> {
    console.log(chalk.blue('\n🔍 Starting Database Tests...\n'));
    this.startTime = performance.now();

    // Run tests in sequence
    await this.testConnectivity();
    await this.testDatabaseInfo();
    await this.testTableExistence();
    await this.testUserCRUD();
    await this.testUserDataIsolation();
    await this.testTransactionOperations();
    await this.testRelationships();
    await this.testConcurrentOperations();
    await this.testConstraints();
    await this.testPerformance();

    // Print summary
    this.printSummary();
  }

  // Print test summary
  private printSummary(): void {
    const totalDuration = performance.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'PASSED').length;
    const failed = this.results.filter(r => r.status === 'FAILED').length;
    const skipped = this.results.filter(r => r.status === 'SKIPPED').length;

    console.log(chalk.blue('\n📊 Test Summary\n'));
    console.log(`Total Tests: ${this.results.length}`);
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${failed}`));
    console.log(chalk.yellow(`Skipped: ${skipped}`));
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

    if (failed > 0) {
      console.log(chalk.red('\n❌ Failed Tests:'));
      this.results
        .filter(r => r.status === 'FAILED')
        .forEach(r => {
          console.log(chalk.red(`  - ${r.name}: ${r.error}`));
        });
    }

    const exitCode = failed > 0 ? 1 : 0;
    process.exit(exitCode);
  }
}

// Main execution
async function main() {
  const testSuite = new DatabaseTestSuite(prisma);

  try {
    await testSuite.runAll();
  } catch (error) {
    console.error(chalk.red('\n💥 Fatal error during testing:'), error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Unhandled error:'), error);
    process.exit(1);
  });
}

export { DatabaseTestSuite, main };