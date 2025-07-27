import { ViewQueries } from '../viewQueries';
import { PrismaClient } from '@prisma/client';
import { createMockContext } from '@/tests/utils/db-helpers';

describe('ViewQueries', () => {
  let viewQueries: ViewQueries;
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = createMockContext();
    viewQueries = new ViewQueries(mockContext.prisma);
  });

  describe('getUserAnalytics', () => {
    it('fetches data from materialized view', async () => {
      const mockAnalytics = {
        userId: 'user-123',
        totalIncome: 50000,
        totalExpenses: 30000,
        netSavings: 20000,
        savingsRate: 40,
        avgMonthlyIncome: 4166.67,
        avgMonthlyExpenses: 2500,
        topExpenseCategory: 'HOUSING',
        transactionCount: 150,
        lastUpdated: new Date(),
      };

      mockContext.prisma.$queryRaw.mockResolvedValueOnce([mockAnalytics]);

      const result = await viewQueries.getUserAnalytics('user-123');

      expect(result).toEqual(mockAnalytics);
      expect(mockContext.prisma.$queryRaw).toHaveBeenCalledWith(expect.any(Array), 'user-123');
    });

    it('handles missing analytics data', async () => {
      mockContext.prisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await viewQueries.getUserAnalytics('user-123');

      expect(result).toBeNull();
    });

    it('refreshes stale view data', async () => {
      const staleAnalytics = {
        userId: 'user-123',
        lastUpdated: new Date(Date.now() - 7200000), // 2 hours ago
      };

      mockContext.prisma.$queryRaw
        .mockResolvedValueOnce([staleAnalytics])
        .mockResolvedValueOnce([{ success: true }])
        .mockResolvedValueOnce([{ ...staleAnalytics, lastUpdated: new Date() }]);

      const result = await viewQueries.getUserAnalytics('user-123', {
        maxAge: 3600000, // 1 hour
      });

      expect(mockContext.prisma.$queryRaw).toHaveBeenCalledTimes(3);
      expect(mockContext.prisma.$queryRaw).toHaveBeenCalledWith(expect.any(Array), 'user-123');
    });
  });

  describe('getMonthlyTrends', () => {
    it('returns monthly aggregated data', async () => {
      const mockTrends = [
        {
          month: '2024-01',
          income: 8500,
          expenses: 4200,
          savings: 4300,
          transactionCount: 45,
        },
        {
          month: '2024-02',
          income: 9000,
          expenses: 4000,
          savings: 5000,
          transactionCount: 42,
        },
      ];

      mockContext.prisma.$queryRaw.mockResolvedValueOnce(mockTrends);

      const result = await viewQueries.getMonthlyTrends('user-123', 2);

      expect(result).toEqual(mockTrends);
      expect(mockContext.prisma.$queryRaw).toHaveBeenCalledWith(expect.any(Array), 'user-123', 2);
    });

    it('calculates month-over-month changes', async () => {
      const mockTrends = [
        { month: '2024-01', income: 8000, expenses: 4000 },
        { month: '2024-02', income: 8500, expenses: 3800 },
      ];

      mockContext.prisma.$queryRaw.mockResolvedValueOnce(mockTrends);

      const result = await viewQueries.getMonthlyTrendsWithChanges('user-123', 2);

      expect(result[1]).toMatchObject({
        month: '2024-02',
        income: 8500,
        expenses: 3800,
        incomeChange: 6.25, // (8500-8000)/8000 * 100
        expensesChange: -5, // (3800-4000)/4000 * 100
      });
    });
  });

  describe('getCategoryBreakdown', () => {
    it('returns spending by category', async () => {
      const mockBreakdown = [
        { category: 'HOUSING', amount: 1500, percentage: 35.7 },
        { category: 'GROCERIES', amount: 800, percentage: 19.0 },
        { category: 'TRANSPORT', amount: 600, percentage: 14.3 },
        { category: 'UTILITIES', amount: 400, percentage: 9.5 },
        { category: 'OTHER', amount: 900, percentage: 21.5 },
      ];

      mockContext.prisma.$queryRaw.mockResolvedValueOnce(mockBreakdown);

      const result = await viewQueries.getCategoryBreakdown(
        'user-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result).toEqual(mockBreakdown);
      expect(result.reduce((sum, cat) => sum + cat.percentage, 0)).toBeCloseTo(100);
    });

    it('excludes income categories', async () => {
      await viewQueries.getCategoryBreakdown('user-123');

      const query = mockContext.prisma.$queryRaw.mock.calls[0][0];
      expect(query.join('')).toContain('WHERE category NOT IN');
      expect(query.join('')).toContain('INCOME');
    });
  });

  describe('getTaxDeductibleExpenses', () => {
    it('identifies tax deductible transactions', async () => {
      const mockDeductibles = [
        {
          category: 'WORK_EXPENSES',
          description: 'Office supplies',
          amount: 150,
          date: '2024-01-15',
          taxCategory: 'D5',
        },
        {
          category: 'DONATIONS',
          description: 'Red Cross donation',
          amount: 100,
          date: '2024-01-20',
          taxCategory: 'D9',
        },
      ];

      mockContext.prisma.$queryRaw.mockResolvedValueOnce(mockDeductibles);

      const result = await viewQueries.getTaxDeductibleExpenses(
        'user-123',
        '2023-07-01',
        '2024-06-30',
      );

      expect(result).toEqual(mockDeductibles);
      expect(mockContext.prisma.$queryRaw).toHaveBeenCalledWith(
        expect.any(Array),
        'user-123',
        '2023-07-01',
        '2024-06-30',
      );
    });

    it('calculates total deductible amount', async () => {
      const mockDeductibles = [
        { amount: 150, taxCategory: 'D5' },
        { amount: 100, taxCategory: 'D9' },
        { amount: 200, taxCategory: 'D10' },
      ];

      mockContext.prisma.$queryRaw.mockResolvedValueOnce(mockDeductibles);

      const result = await viewQueries.getTaxDeductibleSummary('user-123');

      expect(result.totalDeductible).toBe(450);
      expect(result.byCategory).toMatchObject({
        D5: 150,
        D9: 100,
        D10: 200,
      });
    });
  });

  describe('getGoalProgress', () => {
    it('calculates goal completion metrics', async () => {
      const mockGoalData = [
        {
          goalId: 'goal-1',
          name: 'Emergency Fund',
          targetAmount: 10000,
          currentAmount: 7500,
          targetDate: '2024-12-31',
          monthlyRequired: 250,
          onTrack: true,
        },
        {
          goalId: 'goal-2',
          name: 'Vacation',
          targetAmount: 5000,
          currentAmount: 2000,
          targetDate: '2024-06-30',
          monthlyRequired: 600,
          onTrack: false,
        },
      ];

      mockContext.prisma.$queryRaw.mockResolvedValueOnce(mockGoalData);

      const result = await viewQueries.getGoalProgress('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].progressPercentage).toBe(75);
      expect(result[1].progressPercentage).toBe(40);
    });
  });

  describe('refreshViews', () => {
    it('refreshes all materialized views', async () => {
      mockContext.prisma.$executeRaw.mockResolvedValue(1);

      await viewQueries.refreshAllViews();

      expect(mockContext.prisma.$executeRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('REFRESH MATERIALIZED VIEW')]),
      );
    });

    it('refreshes views for specific user', async () => {
      mockContext.prisma.$executeRaw.mockResolvedValue(1);

      await viewQueries.refreshUserViews('user-123');

      expect(mockContext.prisma.$executeRaw).toHaveBeenCalledWith(expect.any(Array), 'user-123');
    });

    it('handles refresh failures gracefully', async () => {
      mockContext.prisma.$executeRaw.mockRejectedValueOnce(new Error('View refresh failed'));

      await expect(viewQueries.refreshAllViews()).rejects.toThrow('View refresh failed');
    });
  });

  describe('performance optimization', () => {
    it('uses indexed columns in queries', async () => {
      await viewQueries.getUserAnalytics('user-123');

      const query = mockContext.prisma.$queryRaw.mock.calls[0][0];
      expect(query.join('')).toContain('WHERE user_id = $1');
    });

    it('limits result sets appropriately', async () => {
      await viewQueries.getMonthlyTrends('user-123', 12);

      const query = mockContext.prisma.$queryRaw.mock.calls[0][0];
      expect(query.join('')).toContain('LIMIT');
    });

    it('uses query hints for optimization', async () => {
      await viewQueries.getCategoryBreakdown('user-123');

      const query = mockContext.prisma.$queryRaw.mock.calls[0][0];
      // Check for optimization hints in complex queries
      expect(query.join('')).toMatch(/GROUP BY|ORDER BY/);
    });
  });

  describe('data validation', () => {
    it('validates date ranges', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      await expect(
        viewQueries.getCategoryBreakdown('user-123', futureDate, new Date()),
      ).rejects.toThrow('Invalid date range');
    });

    it('sanitizes user input', async () => {
      const maliciousUserId = "user'; DROP TABLE users; --";

      await viewQueries.getUserAnalytics(maliciousUserId);

      // Verify parameterized query was used
      expect(mockContext.prisma.$queryRaw).toHaveBeenCalledWith(expect.any(Array), maliciousUserId);
    });
  });
});
