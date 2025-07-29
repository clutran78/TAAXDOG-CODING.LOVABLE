import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../../../lib/prisma';
import { logger } from '@/lib/logger';
import {
  authMiddleware,
  AuthenticatedRequest,
  buildUserScopedFilters,
} from '../../../lib/middleware/auth';
import { withSessionRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { getClientIP } from '../../../lib/auth/auth-utils';
import { getCacheManager, CacheTTL } from '../../../lib/services/cache/cacheManager';
import { apiResponse } from '@/lib/api/response';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import {
  withErrorHandler,
  AuthenticationError,
  ValidationError,
} from '../../../lib/errors/api-error-handler';
import { aiService } from '../../../lib/ai/service';
import { withCSRFProtection } from '../../../lib/auth/csrf-protection';
import { sessionManager } from '../../../lib/auth/session-manager';
import { AuthEvent, TransactionType } from '@prisma/client';

// Validation schemas
const insightTypes = ['all', 'spending', 'savings', 'tax', 'goals', 'cash_flow'] as const;
const periodTypes = ['week', 'month', 'quarter', 'year', 'custom'] as const;

const getInsightsSchema = z.object({
  type: z.enum(insightTypes).default('all'),
  refresh: z.enum(['true', 'false']).optional().default('false'),
  period: z.enum(periodTypes).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const generateInsightsSchema = z.object({
  type: z.enum(insightTypes),
  period: z.enum(periodTypes).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  options: z.object({
    includeReceipts: z.boolean().optional(),
    includeGoals: z.boolean().optional(),
    includePredictions: z.boolean().optional(),
    detailLevel: z.enum(['summary', 'detailed', 'comprehensive']).optional(),
  }).optional(),
});

// Performance monitoring
const insightMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  generationTime: [] as number[],
  errors: 0,
};

/**
 * AI insights API endpoint
 * Generates financial insights based on user's actual transaction data
 */
async function insightsHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = (req as any).requestId || crypto.randomUUID();
  const userId = req.userId;
  const userEmail = req.userEmail;
  const clientIp = getClientIP(req);
  const sessionId = req.session?.id;
  const startTime = Date.now();

  // Validate authentication
  if (!userId) {
    logger.error('Missing user ID in authenticated request', { requestId });
    throw new AuthenticationError('User authentication failed');
  }

  // Update session activity
  if (sessionId) {
    await sessionManager.updateSessionActivity(sessionId, req);
  }

  logger.info('AI insights API access', {
    userId,
    userEmail,
    method: req.method,
    clientIp,
    requestId,
    sessionId,
  });

  try {
    // Log access for audit
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.AI_ACCESS,
        userId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: {
          service: 'insights',
          method: req.method,
          requestId,
        },
      },
    });

    switch (req.method) {
      case 'GET':
        return await handleGetInsights(userId, req.query, res, req, requestId);

      case 'POST':
        return await handleGenerateInsights(userId, req.body, res, req, requestId);

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        throw new ValidationError(`Method ${req.method} is not allowed`);
    }
  } catch (error) {
    insightMetrics.errors++;
    
    logger.error('AI insights API error', {
      error,
      userId,
      method: req.method,
      duration: Date.now() - startTime,
      requestId,
    });

    // Log error for monitoring
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.AI_ERROR,
        userId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: false,
        metadata: {
          service: 'insights',
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId,
        },
      },
    }).catch(err => logger.error('Audit log error', { err }));

    throw error;
  }
}

/**
 * Get cached insights or generate new ones
 */
async function handleGetInsights(
  userId: string,
  query: any,
  res: NextApiResponse,
  req: AuthenticatedRequest,
  requestId: string,
) {
  const startTime = Date.now();
  const clientIp = getClientIP(req);
  const cacheManager = await getCacheManager();

  // Validate query parameters
  const validatedQuery = getInsightsSchema.parse(query);
  const { type, refresh, period, startDate, endDate } = validatedQuery;

  // Build cache key with all parameters
  const cacheKeyParts = [
    'ai:insights',
    userId,
    type,
    period || 'default',
    startDate || 'none',
    endDate || 'none',
  ];
  const cacheKey = cacheKeyParts.join(':');
  const forceRefresh = refresh === 'true';

  try {
    // Check user's AI usage quota
    const userQuota = await checkUserAIQuota(userId);
    if (!userQuota.canUse) {
      logger.warn('AI quota exceeded', { userId, quota: userQuota, requestId });
      return apiResponse.tooManyRequests(res, 'AI insights quota exceeded. Please try again later.');
    }

    // Use cache manager with performance tracking
    const cacheResult = await cacheManager.remember(
      cacheKey,
      forceRefresh ? 0 : CacheTTL.DAY, // 24 hours cache, 0 for force refresh
      async () => {
        insightMetrics.cacheMisses++;
        const genStart = Date.now();

        // Generate insights with AI service integration
        const insights = await generateInsights(userId, type, period, {
          startDate,
          endDate,
          requestId,
        });

        const genTime = Date.now() - genStart;
        insightMetrics.generationTime.push(genTime);

        // Log generation metrics
        logger.info('AI insights generated', {
          userId,
          type,
          generationTime: genTime,
          requestId,
        });

        // Update user quota
        await updateUserAIQuota(userId, 'insights');

        return insights;
      },
    );

    // Track cache performance
    if (!forceRefresh && cacheResult) {
      insightMetrics.cacheHits++;
    }

    // Calculate response metrics
    const processingTime = Date.now() - startTime;
    const wasCache = !forceRefresh && processingTime < 100; // Likely from cache if < 100ms

    // Return optimized response
    return apiResponse.success(res, {
      insights: cacheResult,
      metadata: {
        type,
        period: period || 'quarter',
        cached: wasCache,
        processingTime,
        generatedAt: new Date().toISOString(),
        quotaRemaining: userQuota.remaining,
      },
    });

  } catch (error) {
    logger.error('Error getting insights', {
      error,
      userId,
      type,
      duration: Date.now() - startTime,
      requestId,
    });

    throw error;
  }
}

/**
 * Generate specific insights based on request
 */
async function handleGenerateInsights(
  userId: string,
  body: any,
  res: NextApiResponse,
  req?: AuthenticatedRequest,
) {
  const clientIp = req ? getClientIp(req as NextApiRequest) || 'unknown' : 'unknown';
  const cacheManager = await getCacheManager();

  try {
    const { type, period, options } = body;

    if (!type) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Insight type is required',
      });
    }

    // Validate insight type
    const validTypes = ['all', 'spending', 'savings', 'tax', 'goals', 'cash_flow'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid type',
        message: `Invalid insight type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Generate unique cache key including period and options
    const cacheKey = `ai:insights:${userId}:${type}:${period || 'default'}:${JSON.stringify(options || {})}`;

    // Generate and cache insights
    const insights = await cacheManager.remember(
      cacheKey,
      CacheTTL.DAY, // 24 hours cache
      async () => {
        const data = await generateInsights(userId, type, period, options);

        // Log insights generation
        await prisma.auditLog
          .create({
            data: {
              event: 'AI_INSIGHTS_GENERATED_MANUAL',
              userId,
              ipAddress: clientIp,
              userAgent: req?.headers?.['user-agent'] || '',
              success: true,
              metadata: {
                insightType: type,
                period: period || 'default',
                timestamp: new Date().toISOString(),
              },
            },
          })
          .catch((err) => logger.error('Audit log error:', err));

        return data;
      },
    );

    // Set security headers
    res.setHeader('Cache-Control', 'private, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.status(200).json({
      success: true,
      data: insights,
      generatedAt: new Date(),
      _security: {
        dataScope: 'user-only',
        userId: userId,
        generatedFor: type,
      },
    });
  } catch (error) {
    logger.error('Error generating insights:', error, { userId });

    // Log error
    await prisma.auditLog
      .create({
        data: {
          event: 'AI_INSIGHTS_GENERATE_ERROR',
          userId,
          ipAddress: clientIp,
          userAgent: req?.headers?.['user-agent'] || '',
          success: false,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            insightType: body.type,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    return res.status(500).json({
      error: 'Failed to generate insights',
      message: 'Unable to generate insights. Please try again.',
    });
  }
}

/**
 * Generate insights based on user's financial data
 */
async function generateInsights(userId: string, type: string, period?: string, options?: any) {
  // Determine date range
  const now = new Date();
  const startDate =
    period === 'month'
      ? new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      : period === 'quarter'
        ? new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        : period === 'year'
          ? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
          : new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); // Default to 3 months

  // Fetch user's financial data with strict filtering
  const [user, transactions, goals, bankAccounts] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: userId,
        deletedAt: null, // Ensure user is not deleted
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    }),
    prisma.transaction
      .findMany({
        where: {
          userId: userId, // Strict user filtering
          date: { 
            gte: startDate,
            lte: endDate,
          },
          // Additional security: ensure transactions belong to user's bank accounts
          bankAccount: {
            userId: userId,
            deletedAt: null,
          },
        },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          amount: true,
          type: true,
          category: true,
          date: true,
          description: true,
          isBusinessExpense: true,
          taxCategory: true,
          userId: true, // Include for verification
        },
      })
      .then((txns) =>
        // Double-check: ensure all transactions belong to user
        txns.filter((t) => t.userId === userId).map(({ userId: _, ...t }) => t),
      ),
    prisma.goal
      .findMany({
        where: {
          userId: userId, // Strict user filtering
          status: 'ACTIVE',
          deletedAt: null, // Exclude soft-deleted goals
        },
        select: {
          id: true,
          name: true,
          targetAmount: true,
          currentAmount: true,
          deadline: true,
          category: true,
          userId: true, // Include for verification
        },
      })
      .then((goals) =>
        // Double-check: ensure all goals belong to user
        goals.filter((g) => g.userId === userId).map(({ userId: _, ...g }) => g),
      ),
    prisma.bankAccount
      .findMany({
        where: {
          userId: userId, // Strict user filtering
          deletedAt: null,
          status: {
            in: ['ACTIVE', 'CONNECTED'],
          },
        },
        select: {
          id: true,
          accountName: true,
          balance: true,
          accountType: true,
          userId: true, // Include for verification
        },
      })
      .then((accounts) =>
        // Double-check: ensure all accounts belong to user
        accounts.filter((a) => a.userId === userId).map(({ userId: _, ...a }) => a),
      ),
  ]);

  // Security check: ensure user exists and matches
  if (!user || user.id !== userId) {
    throw new Error('User verification failed');
  }

  // Generate insights based on type
  switch (type) {
    case 'cash_flow':
      return generateCashFlowInsights(transactions, bankAccounts);

    case 'spending':
      return generateExpenseInsights(transactions);

    case 'savings':
      return generateSavingsInsights(transactions, goals, bankAccounts);

    case 'tax':
      return generateTaxInsights(transactions);

    case 'goals':
      return generateGoalInsights(goals, transactions, bankAccounts);

    case 'all':
      const [cashFlow, spending, savings, tax, goalInsights] = await Promise.all([
        generateCashFlowInsights(transactions, bankAccounts),
        generateExpenseInsights(transactions),
        generateSavingsInsights(transactions, goals, bankAccounts),
        generateTaxInsights(transactions),
        generateGoalInsights(goals, transactions, bankAccounts),
      ]);

      return {
        cashFlow,
        spending,
        savings,
        tax,
        goals: goalInsights,
        summary: generateSummaryInsights({
          transactions,
          goals,
          bankAccounts,
          cashFlow,
          expenses: spending,
        }),
        _metadata: {
          userId: userId,
          generatedAt: new Date().toISOString(),
          dataScope: 'user-only',
        },
      };

    default:
      throw new Error(`Invalid insight type: ${type}`);
  }
}

/**
 * Generate cash flow insights
 */
function generateCashFlowInsights(transactions: any[], bankAccounts: any[]) {
  const income = transactions.filter((t) => t.type === 'INCOME');
  const expenses = transactions.filter((t) => t.type === 'EXPENSE');

  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const netCashFlow = totalIncome - totalExpenses;
  const totalBalance = bankAccounts.reduce((sum, a) => sum + a.balance, 0);

  // Calculate monthly trends
  const monthlyData = transactions.reduce(
    (acc, t) => {
      const month = new Date(t.date).toISOString().slice(0, 7);
      if (!acc[month]) acc[month] = { income: 0, expenses: 0 };

      if (t.type === 'INCOME') {
        acc[month].income += t.amount;
      } else {
        acc[month].expenses += Math.abs(t.amount);
      }

      return acc;
    },
    {} as Record<string, { income: number; expenses: number }>,
  );

  const insights = [];

  // Cash flow status
  if (netCashFlow > 0) {
    insights.push({
      type: 'positive',
      title: 'Positive Cash Flow',
      message: `You're earning $${netCashFlow.toFixed(2)} more than you're spending. Great job!`,
      importance: 'high',
    });
  } else {
    insights.push({
      type: 'warning',
      title: 'Negative Cash Flow',
      message: `You're spending $${Math.abs(netCashFlow).toFixed(2)} more than you're earning. Consider reducing expenses.`,
      importance: 'high',
    });
  }

  // Monthly trend
  const months = Object.keys(monthlyData).sort();
  if (months.length >= 2) {
    const lastMonth = monthlyData[months[months.length - 1]];
    const previousMonth = monthlyData[months[months.length - 2]];
    const expenseChange =
      ((lastMonth.expenses - previousMonth.expenses) / previousMonth.expenses) * 100;

    if (Math.abs(expenseChange) > 10) {
      insights.push({
        type: expenseChange > 0 ? 'warning' : 'positive',
        title: 'Spending Trend',
        message: `Your expenses ${expenseChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(expenseChange).toFixed(1)}% compared to last month.`,
        importance: 'medium',
      });
    }
  }

  return {
    totalIncome,
    totalExpenses,
    netCashFlow,
    totalBalance,
    savingsRate: totalIncome > 0 ? (netCashFlow / totalIncome) * 100 : 0,
    monthlyTrends: Object.entries(monthlyData).map(([month, data]) => ({
      month,
      income: data.income,
      expenses: data.expenses,
      netFlow: data.income - data.expenses,
    })),
    insights,
  };
}

/**
 * Generate expense insights
 */
function generateExpenseInsights(transactions: any[]) {
  const expenses = transactions.filter((t) => t.type === 'EXPENSE');

  // Category breakdown
  const categorySpending = expenses.reduce(
    (acc, t) => {
      const category = t.category || 'Uncategorized';
      if (!acc[category]) acc[category] = { amount: 0, count: 0 };
      acc[category].amount += Math.abs(t.amount);
      acc[category].count += 1;
      return acc;
    },
    {} as Record<string, { amount: number; count: number }>,
  );

  const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const categories = Object.entries(categorySpending)
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
      percentage: (data.amount / totalExpenses) * 100,
    }))
    .sort((a, b) => b.amount - a.amount);

  const insights = [];

  // Top spending category
  if (categories.length > 0) {
    const topCategory = categories[0];
    insights.push({
      type: 'info',
      title: 'Top Spending Category',
      message: `${topCategory.category} accounts for ${topCategory.percentage.toFixed(1)}% of your expenses ($${topCategory.amount.toFixed(2)}).`,
      importance: 'medium',
    });
  }

  // Unusual spending patterns
  const avgTransaction = totalExpenses / expenses.length;
  const largeTransactions = expenses.filter((t) => Math.abs(t.amount) > avgTransaction * 3);

  if (largeTransactions.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Large Transactions',
      message: `You have ${largeTransactions.length} transaction(s) that are significantly above your average spending.`,
      importance: 'medium',
    });
  }

  // Recurring expenses
  const recurringPatterns = findRecurringExpenses(expenses);
  if (recurringPatterns.length > 0) {
    const totalRecurring = recurringPatterns.reduce((sum, p) => sum + p.amount, 0);
    insights.push({
      type: 'info',
      title: 'Recurring Expenses',
      message: `You have ${recurringPatterns.length} recurring expenses totaling $${totalRecurring.toFixed(2)} per month.`,
      importance: 'low',
    });
  }

  return {
    totalExpenses,
    averageTransaction: avgTransaction,
    categories,
    largeTransactions: largeTransactions.slice(0, 5).map((t) => ({
      description: t.description,
      amount: Math.abs(t.amount),
      date: t.date,
    })),
    recurringExpenses: recurringPatterns,
    insights,
  };
}

/**
 * Generate savings insights
 */
function generateSavingsInsights(transactions: any[], goals: any[], bankAccounts: any[]) {
  const income = transactions.filter((t) => t.type === 'INCOME');
  const expenses = transactions.filter((t) => t.type === 'EXPENSE');

  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  const insights = [];

  // Savings rate analysis
  if (savingsRate >= 20) {
    insights.push({
      type: 'positive',
      title: 'Excellent Savings Rate',
      message: `You're saving ${savingsRate.toFixed(1)}% of your income. Keep up the great work!`,
      importance: 'high',
    });
  } else if (savingsRate >= 10) {
    insights.push({
      type: 'info',
      title: 'Good Savings Rate',
      message: `You're saving ${savingsRate.toFixed(1)}% of your income. Consider increasing it to 20% for better financial security.`,
      importance: 'medium',
    });
  } else if (savingsRate >= 0) {
    insights.push({
      type: 'warning',
      title: 'Low Savings Rate',
      message: `You're only saving ${savingsRate.toFixed(1)}% of your income. Aim for at least 10-20%.`,
      importance: 'high',
    });
  } else {
    insights.push({
      type: 'error',
      title: 'Negative Savings',
      message: `You're spending more than you earn. Review your expenses to find areas to cut back.`,
      importance: 'critical',
    });
  }

  // Emergency fund check
  const totalBalance = bankAccounts.reduce((sum, a) => sum + a.balance, 0);
  const monthlyExpenses = totalExpenses / 3; // Assuming 3 months of data
  const emergencyFundMonths = totalBalance / monthlyExpenses;

  if (emergencyFundMonths < 3) {
    insights.push({
      type: 'warning',
      title: 'Emergency Fund',
      message: `Your savings can cover ${emergencyFundMonths.toFixed(1)} months of expenses. Aim for at least 3-6 months.`,
      importance: 'high',
    });
  }

  return {
    netSavings,
    savingsRate,
    totalBalance,
    monthlyExpenses,
    emergencyFundMonths,
    savingsGoals: goals
      .filter((g) => g.category === 'SAVINGS')
      .map((g) => ({
        name: g.name,
        progress: (g.currentAmount / g.targetAmount) * 100,
        remaining: g.targetAmount - g.currentAmount,
      })),
    insights,
  };
}

/**
 * Generate tax insights
 */
function generateTaxInsights(transactions: any[]) {
  const businessExpenses = transactions.filter((t) => t.isBusinessExpense && t.type === 'EXPENSE');
  const totalDeductible = businessExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const gstClaimable = totalDeductible / 11; // GST is 1/11th of GST-inclusive amount

  // Group by tax category
  const taxCategories = businessExpenses.reduce(
    (acc, t) => {
      const category = t.taxCategory || 'UNCATEGORIZED';
      if (!acc[category]) acc[category] = { amount: 0, count: 0 };
      acc[category].amount += Math.abs(t.amount);
      acc[category].count += 1;
      return acc;
    },
    {} as Record<string, { amount: number; count: number }>,
  );

  const insights = [];

  // Tax deduction opportunities
  if (totalDeductible > 0) {
    insights.push({
      type: 'positive',
      title: 'Tax Deductions',
      message: `You have $${totalDeductible.toFixed(2)} in potential tax deductions, including $${gstClaimable.toFixed(2)} in GST credits.`,
      importance: 'high',
    });
  }

  // Missing receipts warning
  const transactionsWithoutReceipts = businessExpenses.filter((t) => !t.receiptId).length;
  if (transactionsWithoutReceipts > 0) {
    insights.push({
      type: 'warning',
      title: 'Missing Receipts',
      message: `${transactionsWithoutReceipts} business expense(s) are missing receipts. Upload receipts to support your deductions.`,
      importance: 'medium',
    });
  }

  return {
    totalDeductible,
    gstClaimable,
    categories: Object.entries(taxCategories).map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
    })),
    quarterlyEstimate: (totalDeductible * 4) / 3, // Estimate based on 3 months of data
    insights,
  };
}

/**
 * Generate goal insights
 */
function generateGoalInsights(goals: any[], transactions: any[], bankAccounts: any[]) {
  const activeGoals = goals.filter((g) => g.status === 'ACTIVE');
  const totalBalance = bankAccounts.reduce((sum, a) => sum + a.balance, 0);

  const insights = [];

  // Goal progress analysis
  const goalsWithProgress = activeGoals.map((goal) => {
    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    const daysRemaining = goal.deadline
      ? Math.max(
          0,
          Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        )
      : null;

    const monthsRemaining = daysRemaining ? daysRemaining / 30 : null;
    const requiredMonthlySaving =
      monthsRemaining && monthsRemaining > 0
        ? (goal.targetAmount - goal.currentAmount) / monthsRemaining
        : null;

    return {
      ...goal,
      progress,
      daysRemaining,
      monthsRemaining,
      requiredMonthlySaving,
    };
  });

  // Goals at risk
  const goalsAtRisk = goalsWithProgress.filter((g) => {
    if (!g.daysRemaining) return false;
    const expectedProgress =
      ((Date.now() - new Date(g.createdAt).getTime()) /
        (new Date(g.deadline).getTime() - new Date(g.createdAt).getTime())) *
      100;
    return g.progress < expectedProgress * 0.8; // 20% behind schedule
  });

  if (goalsAtRisk.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Goals at Risk',
      message: `${goalsAtRisk.length} goal(s) are behind schedule. Consider increasing your savings rate.`,
      importance: 'high',
    });
  }

  // Achievable goals
  const achievableGoals = goalsWithProgress.filter(
    (g) => totalBalance >= g.targetAmount - g.currentAmount,
  );

  if (achievableGoals.length > 0) {
    insights.push({
      type: 'positive',
      title: 'Goals Within Reach',
      message: `You have enough savings to complete ${achievableGoals.length} goal(s) right now!`,
      importance: 'medium',
    });
  }

  return {
    activeGoals: goalsWithProgress.length,
    totalTargetAmount: goalsWithProgress.reduce((sum, g) => sum + g.targetAmount, 0),
    totalProgress: goalsWithProgress.reduce((sum, g) => sum + g.currentAmount, 0),
    goalsAtRisk: goalsAtRisk.map((g) => ({
      name: g.name,
      progress: g.progress,
      daysRemaining: g.daysRemaining,
      amountNeeded: g.targetAmount - g.currentAmount,
    })),
    insights,
  };
}

/**
 * Generate summary insights
 */
function generateSummaryInsights(data: any) {
  const insights = [];
  const score = calculateFinancialHealthScore(data);

  if (score >= 80) {
    insights.push({
      type: 'positive',
      title: 'Excellent Financial Health',
      message: `Your financial health score is ${score}/100. You're doing great!`,
      importance: 'high',
    });
  } else if (score >= 60) {
    insights.push({
      type: 'info',
      title: 'Good Financial Health',
      message: `Your financial health score is ${score}/100. There's room for improvement.`,
      importance: 'medium',
    });
  } else {
    insights.push({
      type: 'warning',
      title: 'Financial Health Needs Attention',
      message: `Your financial health score is ${score}/100. Let's work on improving it.`,
      importance: 'high',
    });
  }

  return {
    financialHealthScore: score,
    insights,
    recommendations: generateRecommendations(data),
  };
}

/**
 * Calculate financial health score (0-100)
 */
function calculateFinancialHealthScore(data: any): number {
  let score = 0;

  // Cash flow (30 points)
  if (data.cashFlow.netCashFlow > 0) score += 20;
  if (data.cashFlow.savingsRate > 20) score += 10;
  else if (data.cashFlow.savingsRate > 10) score += 5;

  // Emergency fund (20 points)
  const emergencyMonths = data.cashFlow.totalBalance / (data.expenses.totalExpenses / 3);
  if (emergencyMonths >= 6) score += 20;
  else if (emergencyMonths >= 3) score += 10;
  else if (emergencyMonths >= 1) score += 5;

  // Goal progress (20 points)
  if (data.goals.length > 0) {
    const avgProgress =
      data.goals.reduce((sum: number, g: any) => sum + g.progress, 0) / data.goals.length;
    score += Math.min(20, avgProgress * 0.2);
  }

  // Expense management (20 points)
  const expenseToIncomeRatio = data.expenses.totalExpenses / data.cashFlow.totalIncome;
  if (expenseToIncomeRatio < 0.7) score += 20;
  else if (expenseToIncomeRatio < 0.8) score += 10;
  else if (expenseToIncomeRatio < 0.9) score += 5;

  // Financial diversity (10 points)
  if (data.bankAccounts.length > 1) score += 5;
  if (data.goals.length > 0) score += 5;

  return Math.round(score);
}

/**
 * Generate personalized recommendations
 */
function generateRecommendations(data: any): string[] {
  const recommendations = [];

  // Savings recommendations
  if (data.cashFlow.savingsRate < 10) {
    recommendations.push('Increase your savings rate to at least 10% of income');
  }

  // Emergency fund
  const emergencyMonths = data.cashFlow.totalBalance / (data.expenses.totalExpenses / 3);
  if (emergencyMonths < 3) {
    recommendations.push('Build an emergency fund covering 3-6 months of expenses');
  }

  // Expense reduction
  if (data.expenses.categories.length > 0) {
    const topCategory = data.expenses.categories[0];
    if (topCategory.percentage > 30) {
      recommendations.push(
        `Review ${topCategory.category} expenses - they account for ${topCategory.percentage.toFixed(1)}% of spending`,
      );
    }
  }

  // Goal acceleration
  const behindGoals = data.goals.filter((g: any) => g.progress < 50 && g.daysRemaining < 180);
  if (behindGoals.length > 0) {
    recommendations.push(`Increase contributions to reach ${behindGoals.length} goal(s) on time`);
  }

  return recommendations.slice(0, 5); // Top 5 recommendations
}

/**
 * Find recurring expense patterns
 */
function findRecurringExpenses(expenses: any[]): any[] {
  const patterns: Record<string, any[]> = {};

  // Group by similar descriptions
  expenses.forEach((expense) => {
    const key = expense.description?.toLowerCase().replace(/[0-9]/g, '').trim() || 'unknown';
    if (!patterns[key]) patterns[key] = [];
    patterns[key].push(expense);
  });

  // Find patterns that occur regularly
  const recurring = [];
  for (const [description, transactions] of Object.entries(patterns)) {
    if (transactions.length >= 2) {
      // Check if transactions occur roughly monthly
      const dates = transactions.map((t) => new Date(t.date).getTime()).sort();
      const intervals = [];

      for (let i = 1; i < dates.length; i++) {
        intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24)); // Days between
      }

      const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;

      // If average interval is between 25-35 days, consider it monthly
      if (avgInterval >= 25 && avgInterval <= 35) {
        const avgAmount =
          transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactions.length;
        recurring.push({
          description: transactions[0].description,
          amount: avgAmount,
          frequency: 'monthly',
          count: transactions.length,
        });
      }
    }
  }

  return recurring;
}

// Export with authentication and rate limiting middleware
export default withSessionRateLimit(authMiddleware.authenticated(insightsHandler), {
  window: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute (AI insights are expensive)
});
