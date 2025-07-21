import { PrismaClient } from "@prisma/client";
import { cache } from 'react';

// Optimized query functions with proper relation loading to prevent N+1 queries

/**
 * Batch fetch goals with all related data in a single query
 */
export const getGoalsWithRelations = cache(async (
  prisma: PrismaClient,
  userId: string,
  includeTransactions = false
) => {
  return prisma.goal.findMany({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        }
      },
      transactions: includeTransactions ? {
        orderBy: { createdAt: 'desc' },
        take: 10, // Limit to recent transactions
        select: {
          id: true,
          amount: true,
          description: true,
          category: true,
          date: true,
          createdAt: true,
        }
      } : false,
    },
    orderBy: { createdAt: 'desc' },
  });
});

/**
 * Batch fetch user with all related data
 */
export const getUserWithFullProfile = cache(async (
  prisma: PrismaClient,
  userId: string
) => {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      accounts: true,
      goals: {
        where: { isActive: true },
        orderBy: { targetDate: 'asc' },
      },
      bankingConnections: {
        where: { isActive: true },
        select: {
          id: true,
          institutionName: true,
          lastSyncedAt: true,
          status: true,
        }
      },
      transactions: {
        orderBy: { date: 'desc' },
        take: 20, // Recent transactions only
        select: {
          id: true,
          amount: true,
          description: true,
          category: true,
          date: true,
          isDeductible: true,
        }
      },
      receipts: {
        orderBy: { createdAt: 'desc' },
        take: 10, // Recent receipts
        select: {
          id: true,
          merchant: true,
          amount: true,
          category: true,
          date: true,
          isDeductible: true,
        }
      },
      _count: {
        select: {
          goals: true,
          transactions: true,
          receipts: true,
          bankingConnections: true,
        }
      }
    }
  });
});

/**
 * Optimized transaction queries with related data
 */
export const getTransactionsWithRelations = cache(async (
  prisma: PrismaClient,
  userId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    category?: string;
    isDeductible?: boolean;
    limit?: number;
    offset?: number;
  }
) => {
  const where: any = { userId };
  
  if (options?.startDate || options?.endDate) {
    where.date = {};
    if (options.startDate) where.date.gte = options.startDate;
    if (options.endDate) where.date.lte = options.endDate;
  }
  
  if (options?.category) where.category = options.category;
  if (options?.isDeductible !== undefined) where.isDeductible = options.isDeductible;

  const [transactions, totalCount] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        bankingConnection: {
          select: {
            id: true,
            institutionName: true,
          }
        },
        goal: {
          select: {
            id: true,
            name: true,
            targetAmount: true,
            currentAmount: true,
          }
        },
        receipt: true,
      },
      orderBy: { date: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    prisma.transaction.count({ where })
  ]);

  return {
    transactions,
    totalCount,
    hasMore: (options?.offset || 0) + transactions.length < totalCount,
  };
});

/**
 * Batch update multiple goals efficiently
 */
export const batchUpdateGoals = async (
  prisma: PrismaClient,
  updates: Array<{
    id: string;
    currentAmount?: number;
    isActive?: boolean;
    achievedAt?: Date | null;
  }>
) => {
  // Use transaction to ensure atomicity
  return prisma.$transaction(
    updates.map(update => 
      prisma.goal.update({
        where: { id: update.id },
        data: {
          currentAmount: update.currentAmount,
          isActive: update.isActive,
          achievedAt: update.achievedAt,
          updatedAt: new Date(),
        },
      })
    )
  );
};

/**
 * Efficient aggregation queries
 */
export const getSpendingAnalytics = cache(async (
  prisma: PrismaClient,
  userId: string,
  startDate: Date,
  endDate: Date
) => {
  const [
    categorySpending,
    monthlyTrends,
    deductibleTotal,
    goalProgress
  ] = await Promise.all([
    // Category spending aggregation
    prisma.transaction.groupBy({
      by: ['category'],
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    }),
    
    // Monthly spending trends
    prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', date) as month,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count,
        AVG(amount) as avg_amount
      FROM "Transaction"
      WHERE "userId" = ${userId}
        AND date >= ${startDate}
        AND date <= ${endDate}
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY month DESC
    `,
    
    // Deductible totals
    prisma.transaction.aggregate({
      where: {
        userId,
        isDeductible: true,
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      _count: true,
    }),
    
    // Goal progress summary
    prisma.goal.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        name: true,
        targetAmount: true,
        currentAmount: true,
        targetDate: true,
        _count: {
          select: { transactions: true }
        }
      },
    }),
  ]);

  return {
    categorySpending,
    monthlyTrends,
    deductibleTotal,
    goalProgress: goalProgress.map(goal => ({
      ...goal,
      progressPercentage: (goal.currentAmount / goal.targetAmount) * 100,
      daysRemaining: goal.targetDate 
        ? Math.ceil((goal.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    })),
  };
});

/**
 * Preload related data for better performance
 */
export const preloadUserData = async (
  prisma: PrismaClient,
  userId: string
) => {
  // Warm up the cache with commonly accessed data
  await Promise.all([
    getUserWithFullProfile(prisma, userId),
    getGoalsWithRelations(prisma, userId, false),
    getTransactionsWithRelations(prisma, userId, { limit: 20 }),
  ]);
};