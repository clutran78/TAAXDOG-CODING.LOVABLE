import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { financialInsightsService } from '../../../lib/ai/services/financial-insights';
import prisma from '../../../lib/prisma';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return apiResponse.unauthorized(res, { error: 'Unauthorized' });
    }

    const { timeframe = 'month', categories, businessId } = req.body;

    // Fetch historical transaction data
    const endDate = new Date();
    const startDate = new Date();

    // Get 3 months of historical data for predictions
    startDate.setMonth(startDate.getMonth() - 3);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        businessId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        category: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Group transactions by category and month
    const categoryData: Record<string, any[]> = {};

    transactions.forEach((transaction) => {
      const categoryName = transaction.category?.name || 'Uncategorized';
      if (!categoryData[categoryName]) {
        categoryData[categoryName] = [];
      }

      categoryData[categoryName].push({
        date: transaction.date,
        amount: transaction.amount,
        type: transaction.type,
      });
    });

    // Generate predictions using AI
    const predictions = await financialInsightsService.generateInsights(
      session.user.id,
      businessId,
      timeframe,
    );

    // Filter for budget predictions
    const budgetPredictions = predictions.filter((insight) => insight.type === 'budget_alert');

    // Get budget limits
    const budgets = await prisma.budget.findMany({
      where: {
        userId: session.user.id,
        businessId,
        isActive: true,
      },
      include: {
        category: true,
      },
    });

    // Combine predictions with budget limits
    const enhancedPredictions = budgetPredictions.map((prediction) => {
      const budget = budgets.find((b) => prediction.title.includes(b.category?.name || ''));

      return {
        ...prediction,
        budgetLimit: budget?.amount,
        isOverBudget:
          budget && prediction.impact?.amount ? prediction.impact.amount > budget.amount : false,
      };
    });

    apiResponse.success(res, {
      predictions: enhancedPredictions,
      historicalData: categoryData,
      budgets: budgets.map((b) => ({
        category: b.category?.name,
        limit: b.amount,
        period: b.period,
      })),
      metadata: {
        timeframe,
        dataRange: {
          start: startDate,
          end: endDate,
        },
      },
    });
  } catch (error) {
    logger.error('Budget prediction error:', error);
    apiResponse.internalError(res, {
      error: 'Budget prediction failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
