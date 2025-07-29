import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { withAuth } from '@/lib/auth/middleware';
import { apiResponse } from '@/lib/api/response';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  message?: string;
  duration?: number;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return apiResponse.forbidden(res, 'This endpoint is only available in development');
  }

  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, ['POST']);
  }

  const tests: TestResult[] = [];
  
  try {
    // Test 1: Database connectivity
    const connectStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1 as connected`;
      tests.push({
        name: 'Database Connectivity',
        status: 'success',
        message: 'Connected successfully',
        duration: Date.now() - connectStart,
      });
    } catch (error) {
      tests.push({
        name: 'Database Connectivity',
        status: 'failed',
        message: 'Connection failed',
        duration: Date.now() - connectStart,
      });
    }

    // Test 2: Table existence
    const tableStart = Date.now();
    try {
      const userCount = await prisma.user.count();
      tests.push({
        name: 'Table Existence',
        status: 'success',
        message: `Found User table with ${userCount} records`,
        duration: Date.now() - tableStart,
      });
    } catch (error) {
      tests.push({
        name: 'Table Existence',
        status: 'failed',
        message: 'Tables not found',
        duration: Date.now() - tableStart,
      });
    }

    // Test 3: CRUD operations
    const crudStart = Date.now();
    const testEmail = `test-${crypto.randomUUID()}@example.com`;
    let testUserId: string | null = null;

    try {
      // Create
      const user = await prisma.user.create({
        data: {
          email: testEmail,
          name: 'Test User',
          password: 'hashed_password',
          role: 'USER',
        },
      });
      testUserId = user.id;

      // Read
      const foundUser = await prisma.user.findUnique({
        where: { id: testUserId },
      });

      // Update
      await prisma.user.update({
        where: { id: testUserId },
        data: { name: 'Updated Test User' },
      });

      // Delete
      await prisma.user.delete({
        where: { id: testUserId },
      });

      tests.push({
        name: 'CRUD Operations',
        status: 'success',
        message: 'All CRUD operations successful',
        duration: Date.now() - crudStart,
      });
    } catch (error) {
      // Cleanup if needed
      if (testUserId) {
        await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      }
      
      tests.push({
        name: 'CRUD Operations',
        status: 'failed',
        message: 'CRUD operations failed',
        duration: Date.now() - crudStart,
      });
    }

    // Test 4: Data isolation
    const isolationStart = Date.now();
    const user1Email = `user1-${crypto.randomUUID()}@example.com`;
    const user2Email = `user2-${crypto.randomUUID()}@example.com`;
    let user1Id: string | null = null;
    let user2Id: string | null = null;

    try {
      // Create two users
      const user1 = await prisma.user.create({
        data: {
          email: user1Email,
          name: 'User 1',
          password: 'password1',
          role: 'USER',
        },
      });
      user1Id = user1.id;

      const user2 = await prisma.user.create({
        data: {
          email: user2Email,
          name: 'User 2',
          password: 'password2',
          role: 'USER',
        },
      });
      user2Id = user2.id;

      // Create transactions for each
      await prisma.transaction.create({
        data: {
          userId: user1Id,
          amount: 100,
          description: 'User 1 Transaction',
          date: new Date(),
          type: 'EXPENSE',
          category: 'D1',
        },
      });

      await prisma.transaction.create({
        data: {
          userId: user2Id,
          amount: 200,
          description: 'User 2 Transaction',
          date: new Date(),
          type: 'EXPENSE',
          category: 'D2',
        },
      });

      // Verify isolation
      const user1Txns = await prisma.transaction.findMany({
        where: { userId: user1Id },
      });

      const user2Txns = await prisma.transaction.findMany({
        where: { userId: user2Id },
      });

      if (user1Txns.length === 1 && user2Txns.length === 1) {
        tests.push({
          name: 'Data Isolation',
          status: 'success',
          message: 'User data properly isolated',
          duration: Date.now() - isolationStart,
        });
      } else {
        throw new Error('Data isolation check failed');
      }

      // Cleanup
      await prisma.transaction.deleteMany({ where: { userId: user1Id } });
      await prisma.transaction.deleteMany({ where: { userId: user2Id } });
      await prisma.user.delete({ where: { id: user1Id } });
      await prisma.user.delete({ where: { id: user2Id } });
    } catch (error) {
      // Cleanup on error
      if (user1Id) {
        await prisma.transaction.deleteMany({ where: { userId: user1Id } }).catch(() => {});
        await prisma.user.delete({ where: { id: user1Id } }).catch(() => {});
      }
      if (user2Id) {
        await prisma.transaction.deleteMany({ where: { userId: user2Id } }).catch(() => {});
        await prisma.user.delete({ where: { id: user2Id } }).catch(() => {});
      }

      tests.push({
        name: 'Data Isolation',
        status: 'failed',
        message: 'Data isolation test failed',
        duration: Date.now() - isolationStart,
      });
    }

    // Test 5: Performance check
    const perfStart = Date.now();
    try {
      const start = Date.now();
      await prisma.user.findMany({
        take: 100,
        include: {
          transactions: {
            take: 10,
          },
        },
      });
      const queryTime = Date.now() - start;

      tests.push({
        name: 'Query Performance',
        status: queryTime < 1000 ? 'success' : 'failed',
        message: `Query completed in ${queryTime}ms`,
        duration: queryTime,
      });
    } catch (error) {
      tests.push({
        name: 'Query Performance',
        status: 'failed',
        message: 'Performance test failed',
        duration: Date.now() - perfStart,
      });
    }

    return apiResponse.success(res, { tests });
  } catch (error) {
    return apiResponse.error(res, error instanceof Error ? error : new Error('Database test failed'));
  } finally {
    await prisma.$disconnect();
  }
}

// Protect with auth in development
export default withAuth(handler, {
  allowedRoles: ['ADMIN', 'USER'], // Allow any authenticated user in dev
});