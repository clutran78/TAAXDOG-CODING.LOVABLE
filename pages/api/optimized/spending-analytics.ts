import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';
import { getSpendingAnalytics } from '../../../lib/services/queryOptimizer';
import { getCacheManager, CacheKeys, CacheTTL } from '../../../lib/services/cache/cacheManager';
import { ViewQueries } from '../../../lib/services/viewQueries';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

/**
 * Optimized spending analytics endpoint
 * Demonstrates use of materialized views and aggregated queries
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    // Get session
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return apiResponse.unauthorized(res, { error: 'Unauthorized' });
    }

    const userId = session.user.id;
    const cacheManager = await getCacheManager();
    const viewQueries = new ViewQueries(prisma);

    // Parse date range
    const period = (req.query.period as string) || 'month'; // month, quarter, year
    const customStartDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
    const customEndDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

    // Calculate date range based on period
    let startDate: Date;
    let endDate = new Date();

    if (customStartDate && customEndDate) {
      startDate = customStartDate;
      endDate = customEndDate;
    } else {
      switch (period) {
        case 'year':
          startDate = new Date(endDate.getFullYear(), 0, 1);
          break;
        case 'quarter':
          const quarter = Math.floor(endDate.getMonth() / 3);
          startDate = new Date(endDate.getFullYear(), quarter * 3, 1);
          break;
        case 'month':
        default:
          startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      }
    }

    // Create cache key
    const cacheKey = `${CacheKeys.monthlySpending(userId, startDate.getFullYear(), startDate.getMonth())}:${period}`;

    // Get analytics data with caching
    const analytics = await cacheManager.remember(
      cacheKey,
      CacheTTL.LONG, // Longer cache for analytics
      async () => {
        // Get all analytics data in parallel
        const [spendingData, monthlyTrends, categoryTrends, taxSummary, comparisons] =
          await Promise.all([
            // Get aggregated spending data
            getSpendingAnalytics(prisma, userId, startDate, endDate),

            // Get monthly trends from view
            viewQueries.getMonthlySpending(userId, startDate, endDate),

            // Get category trends for top categories
            Promise.all(
              ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills'].map((category) =>
                viewQueries.getCategoryTrends(userId, category, 6),
              ),
            ),

            // Get tax summary for current year
            viewQueries.getTaxCategorySummary(userId, endDate.getFullYear()),

            // Get comparison data (previous period)
            getComparisonData(startDate, endDate, userId),
          ]);

        // Calculate insights and predictions
        const insights = generateInsights(spendingData, monthlyTrends);
        const predictions = generatePredictions(monthlyTrends, categoryTrends);

        return {
          period: { startDate, endDate },
          summary: {
            totalSpending: spendingData.categorySpending.reduce(
              (sum, cat) => sum + (cat._sum.amount || 0),
              0,
            ),
            totalTransactions: spendingData.categorySpending.reduce(
              (sum, cat) => sum + cat._count,
              0,
            ),
            totalDeductible: spendingData.deductibleTotal._sum.amount || 0,
            deductibleCount: spendingData.deductibleTotal._count || 0,
          },
          categoryBreakdown: spendingData.categorySpending,
          monthlyTrends: spendingData.monthlyTrends,
          goalProgress: spendingData.goalProgress,
          taxSummary,
          categoryTrends: categoryTrends.reduce(
            (acc, trends, idx) => {
              acc[['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills'][idx]] = trends;
              return acc;
            },
            {} as Record<string, any>,
          ),
          comparisons,
          insights,
          predictions,
        };
      },
    );

    // Set appropriate cache headers
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    return apiResponse.success(res, {
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('Analytics error:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to generate analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Helper function to get comparison data
async function getComparisonData(startDate: Date, endDate: Date, userId: string) {
  const period = endDate.getTime() - startDate.getTime();
  const prevStartDate = new Date(startDate.getTime() - period);
  const prevEndDate = new Date(startDate.getTime() - 1);

  const [currentPeriod, previousPeriod] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        date: { gte: prevStartDate, lte: prevEndDate },
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const currentAmount = currentPeriod._sum.amount || 0;
  const previousAmount = previousPeriod._sum.amount || 0;
  const changeAmount = currentAmount - previousAmount;
  const changePercent = previousAmount > 0 ? (changeAmount / previousAmount) * 100 : 0;

  return {
    currentPeriod: {
      amount: currentAmount,
      count: currentPeriod._count,
    },
    previousPeriod: {
      amount: previousAmount,
      count: previousPeriod._count,
    },
    change: {
      amount: changeAmount,
      percent: changePercent,
      trend: changeAmount > 0 ? 'increase' : changeAmount < 0 ? 'decrease' : 'stable',
    },
  };
}

// Generate insights from spending data
function generateInsights(spendingData: any, monthlyTrends: any[]) {
  const insights = [];

  // Highest spending category
  if (spendingData.categorySpending.length > 0) {
    const topCategory = spendingData.categorySpending[0];
    insights.push({
      type: 'top_category',
      message: `Your highest spending category is ${topCategory.category} with $${topCategory._sum.amount?.toFixed(2)}`,
      severity: 'info',
    });
  }

  // Spending trend
  if (monthlyTrends.length >= 2) {
    const latest = monthlyTrends[0];
    const previous = monthlyTrends[1];
    const change = ((latest.totalAmount - previous.totalAmount) / previous.totalAmount) * 100;

    if (Math.abs(change) > 20) {
      insights.push({
        type: 'spending_trend',
        message: `Your spending ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}% this month`,
        severity: change > 0 ? 'warning' : 'success',
      });
    }
  }

  // Goal progress alerts
  const goalsAtRisk = spendingData.goalProgress.filter(
    (g: any) => g.progressPercentage < 50 && g.daysRemaining < 30,
  );

  if (goalsAtRisk.length > 0) {
    insights.push({
      type: 'goals_at_risk',
      message: `${goalsAtRisk.length} goal${goalsAtRisk.length > 1 ? 's are' : ' is'} at risk of not being met on time`,
      severity: 'warning',
    });
  }

  return insights;
}

// Generate spending predictions
function generatePredictions(monthlyTrends: any[], categoryTrends: any[]) {
  if (monthlyTrends.length < 3) {
    return { available: false, message: 'Not enough data for predictions' };
  }

  // Simple linear regression for next month prediction
  const amounts = monthlyTrends.map((t) => t.totalAmount).reverse();
  const n = amounts.length;
  const sumX = (n * (n + 1)) / 2;
  const sumY = amounts.reduce((a, b) => a + b, 0);
  const sumXY = amounts.reduce((sum, y, x) => sum + (x + 1) * y, 0);
  const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const nextMonthPrediction = slope * (n + 1) + intercept;

  return {
    available: true,
    nextMonth: {
      amount: Math.max(0, nextMonthPrediction),
      confidence: 0.7, // Simplified confidence score
    },
    trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
  };
}
