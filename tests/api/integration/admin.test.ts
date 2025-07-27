import { db } from '../helpers/database';
import { ApiTester, expectSuccess, expectError, expectPagination } from '../helpers/api';
import { createAuthenticatedRequest, createMockResponse, mockSession } from '../helpers/auth';
import { mockData } from '../fixtures/mockData';
import usersHandler from '../../../pages/api/admin/users';
import userDetailHandler from '../../../pages/api/admin/users/[id]';
import auditHandler from '../../../pages/api/admin/audit';
import performanceHandler from '../../../pages/api/admin/performance';
import { authMiddleware } from '../../../lib/middleware/auth';

describe('Admin API Tests', () => {
  let adminUser: any;
  let regularUser: any;
  let supportUser: any;
  const usersApi = new ApiTester(usersHandler);
  const auditApi = new ApiTester(auditHandler);
  const performanceApi = new ApiTester(performanceHandler);

  beforeEach(async () => {
    await db.cleanDatabase();

    // Create users with different roles
    adminUser = await db.createUser({
      ...mockData.users.admin,
      role: 'ADMIN',
    });

    regularUser = await db.createUser({
      ...mockData.users.regular,
      role: 'USER',
    });

    supportUser = await db.createUser({
      email: 'support@example.com',
      name: 'Support User',
      password: 'Test123!@#',
      role: 'SUPPORT',
    });

    // Create some audit logs
    await (global as any).prisma.auditLog.createMany({
      data: [
        {
          userId: regularUser.id,
          event: 'LOGIN',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          metadata: { success: true },
        },
        {
          userId: regularUser.id,
          event: 'TRANSACTION_UPDATE',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          metadata: { transactionId: 'tx-123' },
        },
        {
          userId: supportUser.id,
          event: 'USER_UPDATE',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          metadata: { targetUserId: regularUser.id },
        },
      ],
    });
  });

  describe('GET /api/admin/users', () => {
    it('should allow admin to get all users', async () => {
      const req = createAuthenticatedRequest('GET', null, null, null, adminUser);
      const res = createMockResponse();

      await authMiddleware.admin(usersHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.users).toHaveLength(3);
      // Should not include passwords
      response.data.data.users.forEach((user: any) => {
        expect(user.password).toBeUndefined();
      });
    });

    it('should support pagination', async () => {
      // Create more users
      for (let i = 0; i < 15; i++) {
        await db.createUser({
          email: `user${i}@example.com`,
          name: `User ${i}`,
          password: 'Test123!@#',
        });
      }

      const req = createAuthenticatedRequest(
        'GET',
        null,
        { limit: '10', page: '1' },
        null,
        adminUser,
      );
      const res = createMockResponse();

      await authMiddleware.admin(usersHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectPagination(response, ['users']);
      expect(response.data.data.users).toHaveLength(10);
      expect(response.data.data.pagination.total).toBe(18);
    });

    it('should filter by role', async () => {
      const req = createAuthenticatedRequest('GET', null, { role: 'USER' }, null, adminUser);
      const res = createMockResponse();

      await authMiddleware.admin(usersHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.users).toHaveLength(1);
      expect(response.data.data.users[0].role).toBe('USER');
    });

    it('should filter by status', async () => {
      // Suspend a user
      await (global as any).prisma.user.update({
        where: { id: regularUser.id },
        data: { suspended: true },
      });

      const req = createAuthenticatedRequest('GET', null, { status: 'suspended' }, null, adminUser);
      const res = createMockResponse();

      await authMiddleware.admin(usersHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.users).toHaveLength(1);
      expect(response.data.data.users[0].suspended).toBe(true);
    });

    it('should search by email or name', async () => {
      const req = createAuthenticatedRequest('GET', null, { search: 'support' }, null, adminUser);
      const res = createMockResponse();

      await authMiddleware.admin(usersHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.users).toHaveLength(1);
      expect(response.data.data.users[0].email).toBe('support@example.com');
    });

    it('should deny access to non-admin users', async () => {
      const req = createAuthenticatedRequest('GET', null, null, null, regularUser);
      const res = createMockResponse();

      await authMiddleware.admin(usersHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 403, 'Forbidden');
    });

    it('should allow support role with limited access', async () => {
      const req = createAuthenticatedRequest('GET', null, null, null, supportUser);
      const res = createMockResponse();

      await authMiddleware.support(usersHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      // Support should see limited user data
      response.data.data.users.forEach((user: any) => {
        expect(user.password).toBeUndefined();
        expect(user.resetToken).toBeUndefined();
      });
    });
  });

  describe('GET /api/admin/users/[id]', () => {
    it('should get user details', async () => {
      const req = createAuthenticatedRequest('GET', null, { id: regularUser.id }, null, adminUser);
      const res = createMockResponse();

      await authMiddleware.admin(userDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data).toMatchObject({
        id: regularUser.id,
        email: regularUser.email,
        name: regularUser.name,
        role: 'USER',
      });
      expect(response.data.data.password).toBeUndefined();
    });

    it('should include user statistics', async () => {
      // Create some data for the user
      const account = await db.createBankAccount(regularUser.id, mockData.bankAccounts.checking);
      await db.createTransactions(regularUser.id, account.id, 10);
      await db.createGoal(regularUser.id, mockData.goals.vacation);

      const req = createAuthenticatedRequest('GET', null, { id: regularUser.id }, null, adminUser);
      const res = createMockResponse();

      await authMiddleware.admin(userDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.statistics).toMatchObject({
        transactionCount: 10,
        goalCount: 1,
        bankAccountCount: 1,
        lastActivity: expect.any(String),
      });
    });
  });

  describe('PATCH /api/admin/users/[id]', () => {
    it('should update user role', async () => {
      const req = createAuthenticatedRequest(
        'PATCH',
        { role: 'ACCOUNTANT' },
        { id: regularUser.id },
        null,
        adminUser,
      );
      const res = createMockResponse();

      await authMiddleware.admin(userDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.role).toBe('ACCOUNTANT');

      // Verify in database
      const updated = await (global as any).prisma.user.findUnique({
        where: { id: regularUser.id },
      });
      expect(updated.role).toBe('ACCOUNTANT');
    });

    it('should suspend/unsuspend user', async () => {
      const req = createAuthenticatedRequest(
        'PATCH',
        { suspended: true },
        { id: regularUser.id },
        null,
        adminUser,
      );
      const res = createMockResponse();

      await authMiddleware.admin(userDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.suspended).toBe(true);
    });

    it('should prevent role escalation', async () => {
      // Support user trying to make someone admin
      const req = createAuthenticatedRequest(
        'PATCH',
        { role: 'ADMIN' },
        { id: regularUser.id },
        null,
        supportUser,
      );
      const res = createMockResponse();

      await authMiddleware.support(userDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 403, 'Cannot assign ADMIN role');
    });

    it('should audit user updates', async () => {
      const req = createAuthenticatedRequest(
        'PATCH',
        { role: 'ACCOUNTANT', suspended: false },
        { id: regularUser.id },
        null,
        adminUser,
      );
      const res = createMockResponse();

      await authMiddleware.admin(userDetailHandler)(req, res);

      expectSuccess({ status: res._getStatusCode(), data: res._getData() });

      // Check audit log
      const logs = await (global as any).prisma.auditLog.findMany({
        where: {
          userId: adminUser.id,
          event: 'USER_UPDATE',
        },
      });

      expect(logs.length).toBe(1);
      expect(logs[0].metadata).toMatchObject({
        targetUserId: regularUser.id,
        changes: {
          role: 'ACCOUNTANT',
          suspended: false,
        },
      });
    });
  });

  describe('DELETE /api/admin/users/[id]', () => {
    it('should soft delete user', async () => {
      const req = createAuthenticatedRequest(
        'DELETE',
        null,
        { id: regularUser.id },
        null,
        adminUser,
      );
      const res = createMockResponse();

      await authMiddleware.admin(userDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);

      // Verify soft delete
      const deleted = await (global as any).prisma.user.findUnique({
        where: { id: regularUser.id },
      });
      expect(deleted.deletedAt).toBeValidDate();
    });

    it('should prevent self-deletion', async () => {
      const req = createAuthenticatedRequest('DELETE', null, { id: adminUser.id }, null, adminUser);
      const res = createMockResponse();

      await authMiddleware.admin(userDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'Cannot delete yourself');
    });
  });

  describe('GET /api/admin/audit', () => {
    it('should get audit logs', async () => {
      const req = createAuthenticatedRequest('GET', null, null, null, adminUser);
      const res = createMockResponse();

      await authMiddleware.admin(auditHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.logs).toHaveLength(3);
      expect(response.data.data.logs[0]).toMatchObject({
        event: expect.any(String),
        userId: expect.any(String),
        ipAddress: expect.any(String),
        userAgent: expect.any(String),
        metadata: expect.any(Object),
      });
    });

    it('should filter by user', async () => {
      const req = createAuthenticatedRequest(
        'GET',
        null,
        { userId: regularUser.id },
        null,
        adminUser,
      );
      const res = createMockResponse();

      await authMiddleware.admin(auditHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.logs).toHaveLength(2);
      response.data.data.logs.forEach((log: any) => {
        expect(log.userId).toBe(regularUser.id);
      });
    });

    it('should filter by event type', async () => {
      const req = createAuthenticatedRequest('GET', null, { event: 'LOGIN' }, null, adminUser);
      const res = createMockResponse();

      await authMiddleware.admin(auditHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.logs).toHaveLength(1);
      expect(response.data.data.logs[0].event).toBe('LOGIN');
    });

    it('should filter by date range', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const req = createAuthenticatedRequest(
        'GET',
        null,
        {
          startDate: yesterday.toISOString(),
          endDate: tomorrow.toISOString(),
        },
        null,
        adminUser,
      );
      const res = createMockResponse();

      await authMiddleware.admin(auditHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.logs).toHaveLength(3);
    });
  });

  describe('GET /api/admin/performance', () => {
    it('should get performance metrics', async () => {
      const req = createAuthenticatedRequest('GET', null, null, null, adminUser);
      const res = createMockResponse();

      await authMiddleware.admin(performanceHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data).toMatchObject({
        database: {
          activeConnections: expect.any(Number),
          queryTime: expect.any(Number),
          poolSize: expect.any(Number),
        },
        application: {
          uptime: expect.any(Number),
          memoryUsage: expect.any(Object),
          cpuUsage: expect.any(Number),
        },
        requests: {
          total: expect.any(Number),
          errors: expect.any(Number),
          avgResponseTime: expect.any(Number),
        },
      });
    });

    it('should include AI service metrics', async () => {
      const req = createAuthenticatedRequest('GET', null, { includeAI: 'true' }, null, adminUser);
      const res = createMockResponse();

      await authMiddleware.admin(performanceHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.aiServices).toBeDefined();
      expect(response.data.data.aiServices).toMatchObject({
        totalRequests: expect.any(Number),
        tokenUsage: expect.any(Number),
        cacheHitRate: expect.any(Number),
        providerBreakdown: expect.any(Object),
      });
    });

    it('should require admin access', async () => {
      const req = createAuthenticatedRequest('GET', null, null, null, regularUser);
      const res = createMockResponse();

      await authMiddleware.admin(performanceHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 403, 'Forbidden');
    });
  });

  describe('Admin Security Tests', () => {
    it('should rate limit admin endpoints', async () => {
      // Make multiple requests
      for (let i = 0; i < 15; i++) {
        const req = createAuthenticatedRequest('GET', null, null, null, adminUser);
        const res = createMockResponse();

        await authMiddleware.admin(usersHandler)(req, res);

        const response = {
          status: res._getStatusCode(),
          data: res._getData(),
        };

        if (i < 10) {
          expectSuccess(response);
        } else {
          // Should be rate limited after 10 requests
          expectError(response, 429, 'Too many requests');
        }
      }
    });

    it('should validate input strictly', async () => {
      const req = createAuthenticatedRequest(
        'PATCH',
        { role: 'SUPER_ADMIN' }, // Invalid role
        { id: regularUser.id },
        null,
        adminUser,
      );
      const res = createMockResponse();

      await authMiddleware.admin(userDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'Invalid role');
    });
  });
});
