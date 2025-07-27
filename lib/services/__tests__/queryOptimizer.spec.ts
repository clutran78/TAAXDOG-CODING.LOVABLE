import { QueryOptimizer } from '../queryOptimizer';
import { PrismaClient } from '@prisma/client';
import { createMockContext, testDataFactory } from '@/tests/utils/db-helpers';

// Mock Redis for caching
jest.mock('@/lib/services/cache/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  },
}));

describe('QueryOptimizer', () => {
  let queryOptimizer: QueryOptimizer;
  let mockContext: any;
  const mockRedis = require('@/lib/services/cache/redis').redis;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = createMockContext();
    queryOptimizer = new QueryOptimizer(mockContext.prisma);
  });

  describe('optimizeUserDashboardQuery', () => {
    it('returns cached data when available', async () => {
      const cachedData = {
        user: testDataFactory.user(),
        transactions: [testDataFactory.transaction()],
        goals: [testDataFactory.goal()],
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedData));

      const result = await queryOptimizer.optimizeUserDashboardQuery('user-123');

      expect(result).toEqual(cachedData);
      expect(mockContext.prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('fetches and caches data when not cached', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const userData = testDataFactory.user({ id: 'user-123' });
      const transactions = [
        testDataFactory.transaction({ userId: 'user-123' }),
        testDataFactory.transaction({ userId: 'user-123' }),
      ];
      const goals = [testDataFactory.goal({ userId: 'user-123' })];

      mockContext.prisma.user.findUnique.mockResolvedValueOnce({
        ...userData,
        transactions,
        goals,
      });

      const result = await queryOptimizer.optimizeUserDashboardQuery('user-123');

      expect(result).toMatchObject({
        user: userData,
        transactions,
        goals,
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        'dashboard:user-123',
        JSON.stringify(result),
        'EX',
        300, // 5 minutes cache
      );
    });

    it('uses database indexes efficiently', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      await queryOptimizer.optimizeUserDashboardQuery('user-123');

      expect(mockContext.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        include: {
          transactions: {
            orderBy: { date: 'desc' },
            take: 10,
            select: {
              id: true,
              amount: true,
              description: true,
              category: true,
              date: true,
            },
          },
          goals: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              name: true,
              targetAmount: true,
              currentAmount: true,
              targetDate: true,
            },
          },
        },
      });
    });
  });

  describe('batchUserQueries', () => {
    it('batches multiple user queries efficiently', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      const users = userIds.map((id) => testDataFactory.user({ id }));

      mockContext.prisma.user.findMany.mockResolvedValueOnce(users);

      const result = await queryOptimizer.batchUserQueries(userIds);

      expect(result).toHaveLength(3);
      expect(mockContext.prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(mockContext.prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: userIds } },
      });
    });

    it('handles empty user list', async () => {
      const result = await queryOptimizer.batchUserQueries([]);
      expect(result).toEqual([]);
      expect(mockContext.prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('deduplicates user IDs', async () => {
      const userIds = ['user-1', 'user-1', 'user-2', 'user-2'];
      const uniqueUsers = [
        testDataFactory.user({ id: 'user-1' }),
        testDataFactory.user({ id: 'user-2' }),
      ];

      mockContext.prisma.user.findMany.mockResolvedValueOnce(uniqueUsers);

      const result = await queryOptimizer.batchUserQueries(userIds);

      expect(result).toHaveLength(2);
      expect(mockContext.prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['user-1', 'user-2'] } },
      });
    });
  });

  describe('optimizePaginatedQuery', () => {
    it('uses cursor-based pagination for large datasets', async () => {
      const transactions = Array.from({ length: 20 }, (_, i) =>
        testDataFactory.transaction({ id: `txn-${i}` }),
      );

      mockContext.prisma.transaction.findMany.mockResolvedValueOnce(transactions.slice(0, 10));

      const result = await queryOptimizer.optimizePaginatedQuery({
        model: 'transaction',
        pageSize: 10,
        cursor: null,
      });

      expect(result.data).toHaveLength(10);
      expect(result.nextCursor).toBe('txn-9');
      expect(mockContext.prisma.transaction.findMany).toHaveBeenCalledWith({
        take: 11, // One extra to determine if there's a next page
        orderBy: { id: 'asc' },
      });
    });

    it('continues from cursor position', async () => {
      const result = await queryOptimizer.optimizePaginatedQuery({
        model: 'transaction',
        pageSize: 10,
        cursor: 'txn-9',
      });

      expect(mockContext.prisma.transaction.findMany).toHaveBeenCalledWith({
        take: 11,
        skip: 1,
        cursor: { id: 'txn-9' },
        orderBy: { id: 'asc' },
      });
    });

    it('indicates when no more pages exist', async () => {
      const transactions = Array.from({ length: 5 }, (_, i) =>
        testDataFactory.transaction({ id: `txn-${i}` }),
      );

      mockContext.prisma.transaction.findMany.mockResolvedValueOnce(transactions);

      const result = await queryOptimizer.optimizePaginatedQuery({
        model: 'transaction',
        pageSize: 10,
        cursor: null,
      });

      expect(result.data).toHaveLength(5);
      expect(result.nextCursor).toBeNull();
      expect(result.hasMore).toBe(false);
    });
  });

  describe('aggregateTransactionStats', () => {
    it('uses database aggregation functions', async () => {
      const mockAggregateResult = {
        _sum: { amount: 5000 },
        _avg: { amount: 100 },
        _count: 50,
        _min: { amount: 10 },
        _max: { amount: 500 },
      };

      mockContext.prisma.transaction.aggregate.mockResolvedValueOnce(mockAggregateResult);

      const result = await queryOptimizer.aggregateTransactionStats(
        'user-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result).toEqual({
        total: 5000,
        average: 100,
        count: 50,
        min: 10,
        max: 500,
      });

      expect(mockContext.prisma.transaction.aggregate).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          date: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-01-31'),
          },
        },
        _sum: { amount: true },
        _avg: { amount: true },
        _count: true,
        _min: { amount: true },
        _max: { amount: true },
      });
    });

    it('caches aggregate results', async () => {
      const mockAggregateResult = {
        _sum: { amount: 5000 },
        _avg: { amount: 100 },
        _count: 50,
        _min: { amount: 10 },
        _max: { amount: 500 },
      };

      mockContext.prisma.transaction.aggregate.mockResolvedValueOnce(mockAggregateResult);

      await queryOptimizer.aggregateTransactionStats(
        'user-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('stats:user-123'),
        expect.any(String),
        'EX',
        3600, // 1 hour cache for stats
      );
    });
  });

  describe('invalidateUserCache', () => {
    it('removes all cached data for a user', async () => {
      mockRedis.keys.mockResolvedValueOnce([
        'dashboard:user-123',
        'stats:user-123:2024-01',
        'transactions:user-123',
      ]);

      await queryOptimizer.invalidateUserCache('user-123');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'dashboard:user-123',
        'stats:user-123:2024-01',
        'transactions:user-123',
      );
    });

    it('handles no cached data gracefully', async () => {
      mockRedis.keys.mockResolvedValueOnce([]);

      await queryOptimizer.invalidateUserCache('user-123');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('optimizeComplexJoin', () => {
    it('breaks down complex joins into separate queries', async () => {
      const user = testDataFactory.user({ id: 'user-123' });
      const goals = [testDataFactory.goal({ userId: 'user-123' })];
      const transactions = [testDataFactory.transaction({ userId: 'user-123' })];

      mockContext.prisma.user.findUnique.mockResolvedValueOnce(user);
      mockContext.prisma.goal.findMany.mockResolvedValueOnce(goals);
      mockContext.prisma.transaction.findMany.mockResolvedValueOnce(transactions);

      const result = await queryOptimizer.optimizeComplexJoin('user-123');

      expect(result).toEqual({
        user,
        goals,
        transactions,
      });

      // Verify parallel execution
      expect(mockContext.prisma.goal.findMany).toHaveBeenCalled();
      expect(mockContext.prisma.transaction.findMany).toHaveBeenCalled();
    });
  });

  describe('analyzeQueryPerformance', () => {
    it('tracks query execution time', async () => {
      const slowQuery = () => new Promise((resolve) => setTimeout(() => resolve([]), 150));

      mockContext.prisma.transaction.findMany.mockImplementation(slowQuery);

      const onSlowQuery = jest.fn();
      queryOptimizer.setSlowQueryHandler(onSlowQuery);

      await queryOptimizer.optimizePaginatedQuery({
        model: 'transaction',
        pageSize: 10,
      });

      expect(onSlowQuery).toHaveBeenCalledWith({
        query: expect.any(String),
        duration: expect.any(Number),
        threshold: 100,
      });
    });
  });

  describe('connection pooling', () => {
    it('reuses database connections efficiently', async () => {
      // Simulate multiple concurrent queries
      const queries = Array.from({ length: 10 }, (_, i) =>
        queryOptimizer.optimizeUserDashboardQuery(`user-${i}`),
      );

      await Promise.all(queries);

      // Verify connection pool metrics
      const metrics = queryOptimizer.getConnectionPoolMetrics();
      expect(metrics.totalConnections).toBeLessThanOrEqual(5); // Pool size limit
      expect(metrics.idleConnections).toBeGreaterThanOrEqual(0);
    });
  });
});
