import { db } from '../helpers/database';
import { ApiTester, expectSuccess, expectError, testDataIsolation } from '../helpers/api';
import { createAuthenticatedRequest, createMockResponse, mockSession } from '../helpers/auth';
import { mockData } from '../fixtures/mockData';
import goalsHandler from '../../../pages/api/goals/index';
import goalDetailHandler from '../../../pages/api/goals/[id]';
import { authMiddleware } from '../../../lib/middleware/auth';

describe('Goals API Tests', () => {
  let testUser: any;
  let otherUser: any;
  let testGoal: any;
  const goalsApi = new ApiTester(goalsHandler);

  beforeEach(async () => {
    await db.cleanDatabase();

    // Create test users
    testUser = await db.createUser(mockData.users.regular);
    otherUser = await db.createUser({
      ...mockData.users.regular,
      email: 'other@example.com',
      id: 'other-user-id',
    });

    // Create test goal
    testGoal = await db.createGoal(testUser.id, mockData.goals.vacation);

    // Create goal for other user (for isolation testing)
    await db.createGoal(otherUser.id, mockData.goals.emergency);
  });

  describe('GET /api/goals', () => {
    it('should get user goals', async () => {
      const req = createAuthenticatedRequest('GET', null, null, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(goalsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.goals).toHaveLength(1);
      expect(response.data.data.goals[0]).toMatchObject({
        id: testGoal.id,
        name: testGoal.name,
        targetAmount: testGoal.targetAmount,
        currentAmount: testGoal.currentAmount,
        userId: testUser.id,
      });
    });

    it('should calculate goal progress', async () => {
      const req = createAuthenticatedRequest('GET', null, null, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(goalsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      const goal = response.data.data.goals[0];
      const expectedProgress = (goal.currentAmount / goal.targetAmount) * 100;
      expect(goal.progressPercentage).toBeCloseTo(expectedProgress, 2);
    });

    it('should filter by status', async () => {
      // Create completed goal
      await db.createGoal(testUser.id, {
        ...mockData.goals.business,
        status: 'COMPLETED',
      });

      const req = createAuthenticatedRequest('GET', null, { status: 'ACTIVE' }, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(goalsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.goals).toHaveLength(1);
      expect(response.data.data.goals[0].status).toBe('ACTIVE');
    });

    it('should isolate user data', async () => {
      const req = createAuthenticatedRequest('GET', null, null, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(goalsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      // Should only see own goal
      expect(response.data.data.goals).toHaveLength(1);
      expect(response.data.data.goals[0].userId).toBe(testUser.id);
    });
  });

  describe('POST /api/goals', () => {
    it('should create a new goal', async () => {
      const newGoal = {
        name: 'New Car Fund',
        description: 'Saving for a new car',
        targetAmount: 30000,
        deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        category: 'Vehicle',
        priority: 'HIGH',
      };

      const req = createAuthenticatedRequest('POST', newGoal, null, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(goalsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response, 201);
      expect(response.data.data).toMatchObject({
        name: newGoal.name,
        description: newGoal.description,
        targetAmount: newGoal.targetAmount,
        currentAmount: 0,
        status: 'ACTIVE',
        priority: newGoal.priority,
        userId: testUser.id,
      });
      expect(response.data.data.id).toBeUUID();
    });

    it('should validate required fields', async () => {
      const req = createAuthenticatedRequest(
        'POST',
        { name: 'Missing Fields' }, // Missing required fields
        null,
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(goalsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'Validation error');
    });

    it('should validate target amount', async () => {
      const req = createAuthenticatedRequest(
        'POST',
        {
          name: 'Invalid Amount',
          targetAmount: -1000, // Negative amount
          deadline: new Date().toISOString(),
        },
        null,
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(goalsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'must be positive');
    });

    it('should validate deadline is in future', async () => {
      const req = createAuthenticatedRequest(
        'POST',
        {
          name: 'Past Deadline',
          targetAmount: 1000,
          deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        },
        null,
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(goalsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'future');
    });
  });

  describe('GET /api/goals/[id]', () => {
    it('should get goal details', async () => {
      const req = createAuthenticatedRequest('GET', null, { id: testGoal.id }, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(goalDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data).toMatchObject({
        id: testGoal.id,
        name: testGoal.name,
        targetAmount: testGoal.targetAmount,
        currentAmount: testGoal.currentAmount,
      });
    });

    it('should prevent access to other user goals', async () => {
      // Get other user's goal
      const otherGoal = await (global as any).prisma.goal.findFirst({
        where: { userId: otherUser.id },
      });

      const req = createAuthenticatedRequest('GET', null, { id: otherGoal.id }, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(goalDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 404, 'not found');
    });
  });

  describe('PATCH /api/goals/[id]', () => {
    it('should update goal progress', async () => {
      const updateData = {
        currentAmount: 5000,
      };

      const req = createAuthenticatedRequest(
        'PATCH',
        updateData,
        { id: testGoal.id },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(goalDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.currentAmount).toBe(5000);

      // Verify in database
      const updated = await (global as any).prisma.goal.findUnique({
        where: { id: testGoal.id },
      });
      expect(updated.currentAmount).toBe(5000);
    });

    it('should complete goal when target reached', async () => {
      const req = createAuthenticatedRequest(
        'PATCH',
        { currentAmount: testGoal.targetAmount },
        { id: testGoal.id },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(goalDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.status).toBe('COMPLETED');
      expect(response.data.data.completedAt).toBeValidDate();
    });

    it('should validate current amount', async () => {
      const req = createAuthenticatedRequest(
        'PATCH',
        { currentAmount: -100 }, // Negative amount
        { id: testGoal.id },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(goalDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'must be positive');
    });

    it('should log goal updates', async () => {
      const req = createAuthenticatedRequest(
        'PATCH',
        { currentAmount: 3000 },
        { id: testGoal.id },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(goalDetailHandler)(req, res);

      expectSuccess({ status: res._getStatusCode(), data: res._getData() });

      // Check audit log
      const logs = await (global as any).prisma.auditLog.findMany({
        where: {
          userId: testUser.id,
          event: 'GOAL_UPDATE',
        },
      });

      expect(logs.length).toBe(1);
      expect(logs[0].metadata).toMatchObject({
        goalId: testGoal.id,
        changes: {
          currentAmount: 3000,
        },
      });
    });
  });

  describe('DELETE /api/goals/[id]', () => {
    it('should soft delete goal', async () => {
      const req = createAuthenticatedRequest('DELETE', null, { id: testGoal.id }, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(goalDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);

      // Verify soft delete in database
      const deleted = await (global as any).prisma.goal.findUnique({
        where: { id: testGoal.id },
      });
      expect(deleted.deletedAt).toBeValidDate();

      // Should not appear in regular queries
      const goals = await (global as any).prisma.goal.findMany({
        where: { userId: testUser.id, deletedAt: null },
      });
      expect(goals).toHaveLength(0);
    });

    it('should prevent deleting other user goals', async () => {
      const otherGoal = await (global as any).prisma.goal.findFirst({
        where: { userId: otherUser.id },
      });

      const req = createAuthenticatedRequest('DELETE', null, { id: otherGoal.id }, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(goalDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 404, 'not found');
    });
  });
});
