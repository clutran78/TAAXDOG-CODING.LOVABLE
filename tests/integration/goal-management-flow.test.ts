import { createMockApiContext, apiAssertions } from '@/tests/utils/api-mocks';
import { testDataFactory } from '@/tests/utils/db-helpers';

// Import API handlers
import createGoalHandler from '@/pages/api/goals/index';
import updateGoalHandler from '@/pages/api/goals/[id]';
import updateProgressHandler from '@/pages/api/goals/[id]/progress';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    goal: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    goalProgress: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    subaccount: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/insights/insightService', () => ({
  InsightService: jest.fn().mockImplementation(() => ({
    generateGoalInsights: jest.fn(),
  })),
}));

const mockPrisma = require('@/lib/prisma').prisma;
const { InsightService } = require('@/lib/services/insights/insightService');

describe('Goal Management Flow Integration Tests', () => {
  let mockInsightService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInsightService = new InsightService();
  });

  describe('Complete Goal Creation and Management Flow', () => {
    it('creates goal with subaccount and initial deposit', async () => {
      const userId = 'user-123';
      const goalData = {
        name: 'Emergency Fund',
        description: 'Build 6 months of expenses',
        targetAmount: 15000,
        targetDate: '2025-12-31',
        initialDeposit: 1000,
        monthlyContribution: 500,
      };

      // Create goal
      mockPrisma.goal.create.mockResolvedValueOnce({
        id: 'goal-1',
        userId,
        ...goalData,
        currentAmount: 1000,
        status: 'ACTIVE',
        createdAt: new Date(),
      });

      // Create associated subaccount
      mockPrisma.subaccount.create.mockResolvedValueOnce({
        id: 'subaccount-1',
        goalId: 'goal-1',
        userId,
        balance: 1000,
        accountNumber: 'SUB-001234',
        status: 'ACTIVE',
      });

      // Record initial transaction
      mockPrisma.transaction.create.mockResolvedValueOnce({
        id: 'txn-1',
        userId,
        subaccountId: 'subaccount-1',
        amount: 1000,
        type: 'TRANSFER_IN',
        description: 'Initial deposit for Emergency Fund',
      });

      const { req, res } = createMockApiContext('POST', goalData);
      req.user = { id: userId };

      await createGoalHandler(req, res);

      const data = apiAssertions.expectSuccess(res, 201);
      expect(data.goal).toMatchObject({
        id: 'goal-1',
        name: 'Emergency Fund',
        currentAmount: 1000,
        targetAmount: 15000,
      });

      // Verify all related entities were created
      expect(mockPrisma.goal.create).toHaveBeenCalled();
      expect(mockPrisma.subaccount.create).toHaveBeenCalled();
      expect(mockPrisma.transaction.create).toHaveBeenCalled();

      // Verify audit log
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'GOAL_CREATED',
          userId,
          metadata: expect.objectContaining({
            goalId: 'goal-1',
            targetAmount: 15000,
          }),
        },
      });
    });

    it('updates goal progress with contribution', async () => {
      const userId = 'user-123';
      const goalId = 'goal-1';
      const goal = testDataFactory.goal({
        id: goalId,
        userId,
        currentAmount: 5000,
        targetAmount: 15000,
      });

      mockPrisma.goal.findUnique.mockResolvedValueOnce(goal);

      const contribution = {
        amount: 500,
        note: 'Monthly contribution',
      };

      // Update goal amount
      mockPrisma.goal.update.mockResolvedValueOnce({
        ...goal,
        currentAmount: 5500,
      });

      // Record progress entry
      mockPrisma.goalProgress.create.mockResolvedValueOnce({
        id: 'progress-1',
        goalId,
        amount: 500,
        type: 'CONTRIBUTION',
        note: contribution.note,
        createdAt: new Date(),
      });

      // Update subaccount
      mockPrisma.subaccount.update.mockResolvedValueOnce({
        id: 'subaccount-1',
        balance: 5500,
      });

      const { req, res } = createMockApiContext('POST', contribution);
      req.user = { id: userId };
      req.query = { id: goalId };

      await updateProgressHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data.goal.currentAmount).toBe(5500);
      expect(data.progress).toMatchObject({
        amount: 500,
        type: 'CONTRIBUTION',
      });

      // Verify percentage calculation
      expect(data.goal.progressPercentage).toBe(36.67); // 5500/15000
    });

    it('handles automatic monthly contributions', async () => {
      const userId = 'user-123';
      const goals = [
        testDataFactory.goal({
          id: 'goal-1',
          userId,
          monthlyContribution: 500,
          currentAmount: 5000,
          isAutoContribute: true,
        }),
        testDataFactory.goal({
          id: 'goal-2',
          userId,
          monthlyContribution: 300,
          currentAmount: 2000,
          isAutoContribute: true,
        }),
      ];

      mockPrisma.goal.findMany.mockResolvedValueOnce(goals);

      // Mock automated contribution processing
      for (const goal of goals) {
        mockPrisma.goal.update.mockResolvedValueOnce({
          ...goal,
          currentAmount: goal.currentAmount + goal.monthlyContribution,
        });

        mockPrisma.goalProgress.create.mockResolvedValueOnce({
          goalId: goal.id,
          amount: goal.monthlyContribution,
          type: 'AUTO_CONTRIBUTION',
        });
      }

      // Simulate monthly cron job
      const { req, res } = createMockApiContext('POST', {
        action: 'processMonthlyContributions',
      });

      // This would typically be called by a cron job or scheduled task
      // await processMonthlyContributionsHandler(req, res);

      // Verify contributions were processed
      expect(mockPrisma.goal.findMany).toHaveBeenCalledWith({
        where: {
          isAutoContribute: true,
          status: 'ACTIVE',
        },
      });
    });
  });

  describe('Goal Achievement and Completion', () => {
    it('handles goal achievement', async () => {
      const userId = 'user-123';
      const goalId = 'goal-1';
      const goal = testDataFactory.goal({
        id: goalId,
        userId,
        currentAmount: 14500,
        targetAmount: 15000,
      });

      mockPrisma.goal.findUnique.mockResolvedValueOnce(goal);

      // Final contribution that achieves the goal
      const finalContribution = { amount: 500 };

      mockPrisma.goal.update.mockResolvedValueOnce({
        ...goal,
        currentAmount: 15000,
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      // Generate achievement insights
      mockInsightService.generateGoalInsights.mockResolvedValueOnce({
        achievement: {
          message: 'Congratulations! You achieved your Emergency Fund goal!',
          timeTaken: '8 months',
          avgMonthlyContribution: 1875,
        },
        nextSteps: [
          'Consider increasing your target to 12 months of expenses',
          'Start a new investment goal',
        ],
      });

      const { req, res } = createMockApiContext('POST', finalContribution);
      req.user = { id: userId };
      req.query = { id: goalId };

      await updateProgressHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data.goal.status).toBe('COMPLETED');
      expect(data.goal.currentAmount).toBe(15000);
      expect(data.achievement).toBeDefined();
      expect(data.insights).toBeDefined();

      // Verify celebration notification would be sent
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'GOAL_ACHIEVED',
          userId,
          metadata: {
            goalId,
            goalName: goal.name,
            targetAmount: 15000,
          },
        },
      });
    });

    it('allows withdrawal from completed goals', async () => {
      const userId = 'user-123';
      const goalId = 'goal-1';
      const completedGoal = testDataFactory.goal({
        id: goalId,
        userId,
        currentAmount: 15000,
        targetAmount: 15000,
        status: 'COMPLETED',
      });

      mockPrisma.goal.findUnique.mockResolvedValueOnce(completedGoal);

      const withdrawal = {
        amount: 5000,
        reason: 'Emergency medical expense',
      };

      mockPrisma.goal.update.mockResolvedValueOnce({
        ...completedGoal,
        currentAmount: 10000,
      });

      mockPrisma.goalProgress.create.mockResolvedValueOnce({
        id: 'progress-2',
        goalId,
        amount: -5000,
        type: 'WITHDRAWAL',
        note: withdrawal.reason,
      });

      const { req, res } = createMockApiContext('POST', {
        ...withdrawal,
        type: 'withdrawal',
      });
      req.user = { id: userId };
      req.query = { id: goalId };

      await updateProgressHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data.goal.currentAmount).toBe(10000);
      expect(data.progress.type).toBe('WITHDRAWAL');
    });
  });

  describe('Goal Analytics and Insights', () => {
    it('provides goal progress analytics', async () => {
      const userId = 'user-123';
      const goals = [
        testDataFactory.goal({
          id: 'goal-1',
          currentAmount: 7500,
          targetAmount: 10000,
          createdAt: new Date('2024-01-01'),
        }),
        testDataFactory.goal({
          id: 'goal-2',
          currentAmount: 3000,
          targetAmount: 5000,
          createdAt: new Date('2024-02-01'),
        }),
      ];

      mockPrisma.goal.findMany.mockResolvedValueOnce(goals);

      // Mock progress history
      const progressHistory = [
        { goalId: 'goal-1', amount: 1000, createdAt: new Date('2024-01-15') },
        { goalId: 'goal-1', amount: 1500, createdAt: new Date('2024-02-15') },
        { goalId: 'goal-2', amount: 500, createdAt: new Date('2024-02-15') },
      ];

      mockPrisma.goalProgress.findMany.mockResolvedValueOnce(progressHistory);

      const { req, res } = createMockApiContext('GET', null, {
        includeAnalytics: 'true',
      });
      req.user = { id: userId };

      await createGoalHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data.analytics).toMatchObject({
        totalGoals: 2,
        totalSaved: 10500,
        totalTarget: 15000,
        overallProgress: 70,
        averageMonthlyContribution: expect.any(Number),
        projectedCompletionDates: expect.any(Object),
      });
    });

    it('generates personalized goal recommendations', async () => {
      const userId = 'user-123';
      const userGoals = [testDataFactory.goal({ name: 'Emergency Fund', status: 'COMPLETED' })];

      mockPrisma.goal.findMany.mockResolvedValueOnce(userGoals);

      mockInsightService.generateGoalInsights.mockResolvedValueOnce({
        recommendations: [
          {
            type: 'RETIREMENT',
            title: 'Start Planning for Retirement',
            description:
              'Based on your completed emergency fund, consider starting a retirement savings goal',
            suggestedTarget: 50000,
            suggestedMonthly: 800,
          },
          {
            type: 'INVESTMENT',
            title: 'Begin Investment Portfolio',
            description: 'With your emergency fund secured, explore investment opportunities',
            suggestedTarget: 10000,
            suggestedMonthly: 400,
          },
        ],
      });

      const { req, res } = createMockApiContext('GET', null, {
        recommendations: 'true',
      });
      req.user = { id: userId };

      await createGoalHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data.recommendations).toHaveLength(2);
      expect(data.recommendations[0].type).toBe('RETIREMENT');
    });
  });

  describe('Goal Adjustments and Scenarios', () => {
    it('adjusts goal based on financial changes', async () => {
      const userId = 'user-123';
      const goalId = 'goal-1';
      const goal = testDataFactory.goal({
        id: goalId,
        userId,
        targetAmount: 20000,
        targetDate: new Date('2025-12-31'),
        monthlyContribution: 500,
      });

      mockPrisma.goal.findUnique.mockResolvedValueOnce(goal);

      // User's income decreased, need to adjust
      const adjustment = {
        newMonthlyContribution: 300,
        reason: 'Income reduction',
      };

      // Calculate new target date based on reduced contribution
      const newTargetDate = new Date('2026-08-31');

      mockPrisma.goal.update.mockResolvedValueOnce({
        ...goal,
        monthlyContribution: 300,
        targetDate: newTargetDate,
      });

      const { req, res } = createMockApiContext('PATCH', {
        ...adjustment,
        adjustTargetDate: true,
      });
      req.user = { id: userId };
      req.query = { id: goalId };

      await updateGoalHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data.goal.monthlyContribution).toBe(300);
      expect(new Date(data.goal.targetDate)).toEqual(newTargetDate);
      expect(data.adjustmentSummary).toMatchObject({
        previousMonthly: 500,
        newMonthly: 300,
        timeExtension: '8 months',
      });
    });

    it('pauses and resumes goals', async () => {
      const userId = 'user-123';
      const goalId = 'goal-1';
      const activeGoal = testDataFactory.goal({
        id: goalId,
        userId,
        status: 'ACTIVE',
      });

      mockPrisma.goal.findUnique.mockResolvedValueOnce(activeGoal);

      // Pause goal
      mockPrisma.goal.update.mockResolvedValueOnce({
        ...activeGoal,
        status: 'PAUSED',
        pausedAt: new Date(),
      });

      const { req: pauseReq, res: pauseRes } = createMockApiContext('PATCH', {
        action: 'pause',
        reason: 'Temporary financial hardship',
      });
      pauseReq.user = { id: userId };
      pauseReq.query = { id: goalId };

      await updateGoalHandler(pauseReq, pauseRes);

      const pauseData = apiAssertions.expectSuccess(pauseRes);
      expect(pauseData.goal.status).toBe('PAUSED');

      // Resume goal later
      mockPrisma.goal.findUnique.mockResolvedValueOnce({
        ...activeGoal,
        status: 'PAUSED',
      });

      mockPrisma.goal.update.mockResolvedValueOnce({
        ...activeGoal,
        status: 'ACTIVE',
        resumedAt: new Date(),
      });

      const { req: resumeReq, res: resumeRes } = createMockApiContext('PATCH', {
        action: 'resume',
      });
      resumeReq.user = { id: userId };
      resumeReq.query = { id: goalId };

      await updateGoalHandler(resumeReq, resumeRes);

      const resumeData = apiAssertions.expectSuccess(resumeRes);
      expect(resumeData.goal.status).toBe('ACTIVE');
    });
  });
});
