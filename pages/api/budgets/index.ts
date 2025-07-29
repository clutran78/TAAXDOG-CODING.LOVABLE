import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { z } from 'zod';
import { AuthEvent, BudgetStatus, BudgetPeriod } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { logger } from '@/lib/logger';
import {
  authMiddleware,
  AuthenticatedRequest,
  buildUserScopedFilters,
  validateResourceOwnership,
} from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
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
  NotFoundError,
  BadRequestError,
} from '../../../lib/errors/api-error-handler';
import { withCSRFProtection } from '../../../lib/auth/csrf-protection';
import { sessionManager } from '../../../lib/auth/session-manager';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, addMonths } from 'date-fns';

// Budget categories aligned with transaction categories
const BUDGET_CATEGORIES = [
  'INCOME',
  'HOUSING',
  'TRANSPORTATION',
  'FOOD',
  'UTILITIES',
  'INSURANCE',
  'HEALTHCARE',
  'SAVINGS',
  'PERSONAL',
  'ENTERTAINMENT',
  'EDUCATION',
  'SHOPPING',
  'OTHER',
] as const;

// Validation schemas
const budgetSchemas = {
  list: {
    query: z.object({
      status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
      period: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
      category: z.enum(BUDGET_CATEGORIES).optional(),
      page: z.string().regex(/^\d+$/).transform(Number).default('1'),
      limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
      includeAnalytics: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    }),
  },
  create: {
    body: z.object({
      name: z.string().min(1).max(100).trim(),
      description: z.string().max(500).optional(),
      period: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
      startDate: z.string().datetime(),
      endDate: z.string().datetime().optional(),
      categories: z.array(z.object({
        category: z.enum(BUDGET_CATEGORIES),
        amount: z.number().min(0).max(1000000000),
        notes: z.string().max(200).optional(),
      })).min(1).max(20),
      totalAmount: z.number().min(0).max(1000000000).optional(),
      status: z.enum(['ACTIVE', 'DRAFT']).optional(),
      alerts: z.object({
        enabled: z.boolean().default(true),
        thresholds: z.object({
          warning: z.number().min(0).max(100).default(80),
          critical: z.number().min(0).max(100).default(90),
        }).optional(),
      }).optional(),
    }).refine((data) => {
      // Validate date range
      if (data.endDate && new Date(data.endDate) <= new Date(data.startDate)) {
        return false;
      }
      return true;
    }, {
      message: "End date must be after start date",
      path: ["endDate"],
    }),
  },
};

// Budget analytics interface
interface BudgetAnalytics {
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  percentageUsed: number;
  daysRemaining: number;
  projectedOverspend: number;
  categoriesOverBudget: string[];
  savingsRate: number;
  topSpendingCategories: Array<{
    category: string;
    budgeted: number;
    spent: number;
    percentage: number;
  }>;
}

/**
 * Budget management API endpoint
 * Handles CRUD operations for budgets with full user isolation
 */
async function budgetHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = crypto.randomUUID();
  const userId = req.userId;
  const userEmail = req.userEmail;
  const clientIp = getClientIP(req);
  const sessionId = req.session?.id;

  // Validate authentication
  if (!userId) {
    logger.error('Missing user ID in authenticated request', { requestId });
    throw new AuthenticationError('User authentication failed');
  }

  // Update session activity
  if (sessionId) {
    await sessionManager.updateSessionActivity(sessionId, req);
  }

  logger.info('Budget API access', {
    userId,
    userEmail,
    method: req.method,
    clientIp,
    requestId,
    sessionId,
  });

  try {
    switch (req.method) {
      case 'GET':
        return await handleGetBudgets(userId, req.query, res, req, requestId);

      case 'POST':
        return await handleCreateBudget(userId, req.body, res, req, requestId);

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        throw new ValidationError(`Method ${req.method} is not allowed`);
    }
  } catch (error) {
    logger.error('Budget API error', {
      error,
      userId,
      method: req.method,
      requestId,
    });

    // Log error for monitoring
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.API_ERROR,
        userId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: false,
        metadata: {
          endpoint: '/api/budgets',
          method: req.method,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId,
        },
      },
    }).catch(err => logger.error('Audit log error', { err }));

    throw error;
  }
}

/**
 * Get user's budgets with optional filtering
 */
async function handleGetBudgets(
  userId: string,
  query: any,
  res: NextApiResponse,
  req: AuthenticatedRequest,
  requestId: string,
) {
  const startTime = Date.now();
  const cacheManager = await getCacheManager();

  try {
    // Query is already validated by middleware
    const {
      status,
      period,
      category,
      page = 1,
      limit = 20,
      includeAnalytics = false,
    } = query;

    // Build cache key
    const cacheKey = `budgets:${userId}:${JSON.stringify(query)}`;
    
    // Try cache first for non-analytics requests
    if (!includeAnalytics) {
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        logger.debug('Returning cached budgets', { userId, requestId });
        return apiResponse.success(res, cached);
      }
    }

    // Build query filters
    const where: any = {
      userId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }
    if (period) {
      where.period = period;
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    const take = Math.min(Number(limit), 100);

    // Use transaction for consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get total count
      const total = await tx.budget.count({ where });

      // Get budgets
      const budgets = await tx.budget.findMany({
        where,
        orderBy: [
          { status: 'asc' }, // Active first
          { startDate: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take,
        include: {
          categories: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              amount: 'desc',
            },
          },
          _count: {
            select: {
              transactions: true,
            },
          },
        },
      });

      // Get analytics if requested
      let analyticsData: Record<string, BudgetAnalytics> = {};
      if (includeAnalytics) {
        for (const budget of budgets) {
          analyticsData[budget.id] = await calculateBudgetAnalytics(budget, userId);
        }
      }

      return { budgets, total, analyticsData };
    });

    // Format response
    const formattedBudgets = result.budgets.map(budget => {
      const totalBudgeted = budget.categories.reduce((sum, cat) => sum + cat.amount, 0);
      const now = new Date();
      const startDate = new Date(budget.startDate);
      const endDate = budget.endDate ? new Date(budget.endDate) : getEndDateForPeriod(startDate, budget.period);
      
      const isActive = budget.status === 'ACTIVE' && 
                      now >= startDate && 
                      now <= endDate;

      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysElapsed = totalDays - daysRemaining;
      const progressPercentage = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;

      return {
        id: budget.id,
        name: budget.name,
        description: budget.description,
        period: budget.period,
        startDate: budget.startDate,
        endDate: budget.endDate || endDate,
        status: budget.status,
        isActive,
        totalBudgeted,
        categories: budget.categories.map(cat => ({
          id: cat.id,
          category: cat.category,
          amount: cat.amount,
          notes: cat.notes,
        })),
        daysRemaining,
        progressPercentage: Math.round(progressPercentage * 100) / 100,
        transactionCount: (budget as any)._count?.transactions || 0,
        alerts: budget.alerts || { enabled: true, thresholds: { warning: 80, critical: 90 } },
        analytics: includeAnalytics ? result.analyticsData[budget.id] : undefined,
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt,
      };
    });

    // Build response
    const response = {
      budgets: formattedBudgets,
      pagination: {
        page: Number(page),
        limit: take,
        total: result.total,
        pages: Math.ceil(result.total / take),
        hasMore: skip + take < result.total,
      },
      summary: {
        totalBudgets: result.total,
        activeBudgets: formattedBudgets.filter(b => b.isActive).length,
        totalBudgeted: formattedBudgets
          .filter(b => b.isActive)
          .reduce((sum, b) => sum + b.totalBudgeted, 0),
      },
    };

    // Cache the response (short TTL for budgets)
    if (!includeAnalytics) {
      await cacheManager.set(cacheKey, response, CacheTTL.MINUTE * 5);
    }

    logger.info('Budgets retrieved successfully', {
      userId,
      count: result.budgets.length,
      total: result.total,
      processingTime: Date.now() - startTime,
      requestId,
    });

    return apiResponse.success(res, response);

  } catch (error) {
    logger.error('Error retrieving budgets', {
      error,
      userId,
      duration: Date.now() - startTime,
      requestId,
    });

    throw error;
  }
}

/**
 * Create a new budget
 */
async function handleCreateBudget(
  userId: string,
  body: any,
  res: NextApiResponse,
  req: AuthenticatedRequest,
  requestId: string,
) {
  const startTime = Date.now();
  const clientIp = getClientIP(req);
  const cacheManager = await getCacheManager();

  try {
    // Body is already validated by middleware
    const { 
      name, 
      description, 
      period, 
      startDate, 
      endDate,
      categories,
      status = 'ACTIVE',
      alerts = { enabled: true, thresholds: { warning: 80, critical: 90 } },
    } = body;

    // Additional validation
    const budgetStartDate = new Date(startDate);
    const budgetEndDate = endDate ? new Date(endDate) : getEndDateForPeriod(budgetStartDate, period);

    // Check for overlapping active budgets
    const overlappingBudget = await prisma.budget.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        deletedAt: null,
        OR: [
          {
            AND: [
              { startDate: { lte: budgetStartDate } },
              { 
                OR: [
                  { endDate: { gte: budgetStartDate } },
                  { endDate: null },
                ],
              },
            ],
          },
          {
            AND: [
              { startDate: { lte: budgetEndDate } },
              {
                OR: [
                  { endDate: { gte: budgetEndDate } },
                  { endDate: null },
                ],
              },
            ],
          },
        ],
      },
    });

    if (overlappingBudget) {
      throw new BadRequestError('An active budget already exists for this period');
    }

    // Check budget limit
    const activeBudgetCount = await prisma.budget.count({
      where: {
        userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    if (activeBudgetCount >= 10) {
      throw new BadRequestError('Maximum number of active budgets (10) reached');
    }

    // Calculate total budgeted amount
    const totalBudgeted = categories.reduce((sum: number, cat: any) => sum + cat.amount, 0);

    // Use transaction for budget creation
    const budget = await prisma.$transaction(async (tx) => {
      // Create the budget
      const newBudget = await tx.budget.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          name: name.trim(),
          description: description?.trim() || null,
          period,
          startDate: budgetStartDate,
          endDate: endDate ? budgetEndDate : null,
          status,
          totalAmount: totalBudgeted,
          alerts: alerts as any,
          categories: {
            create: categories.map((cat: any) => ({
              id: crypto.randomUUID(),
              category: cat.category,
              amount: cat.amount,
              notes: cat.notes?.trim() || null,
            })),
          },
        },
        include: {
          categories: true,
        },
      });

      // Create budget alert settings if enabled
      if (alerts.enabled) {
        await tx.budgetAlert.create({
          data: {
            id: crypto.randomUUID(),
            budgetId: newBudget.id,
            userId,
            warningThreshold: alerts.thresholds.warning,
            criticalThreshold: alerts.thresholds.critical,
            lastCheckedAt: new Date(),
          },
        });
      }

      // Log budget creation
      await tx.auditLog.create({
        data: {
          event: AuthEvent.DATA_CREATE,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            resource: 'budget',
            budgetId: newBudget.id,
            budgetName: newBudget.name,
            period: newBudget.period,
            totalAmount: totalBudgeted,
            categoriesCount: categories.length,
          },
        },
      });

      return newBudget;
    });

    // Clear budgets cache for this user
    const cachePattern = `budgets:${userId}:*`;
    await cacheManager.deletePattern(cachePattern);

    // Format response
    const response = {
      ...budget,
      totalBudgeted,
      daysRemaining: Math.ceil((budgetEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      isActive: budget.status === 'ACTIVE' && new Date() >= budgetStartDate && new Date() <= budgetEndDate,
    };

    logger.info('Budget created successfully', {
      userId,
      budgetId: budget.id,
      period: budget.period,
      totalAmount: totalBudgeted,
      processingTime: Date.now() - startTime,
      requestId,
    });

    return apiResponse.created(res, response, `/api/budgets/${budget.id}`);

  } catch (error) {
    logger.error('Error creating budget', {
      error,
      userId,
      duration: Date.now() - startTime,
      requestId,
    });

    // Log error in audit log
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.DATA_CREATE,
        userId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: false,
        metadata: {
          resource: 'budget',
          error: error instanceof Error ? error.message : 'Unknown error',
          requestData: { name: body.name, period: body.period },
        },
      },
    }).catch(err => logger.error('Audit log error', { err }));

    throw error;
  }
}

/**
 * Calculate budget analytics
 */
async function calculateBudgetAnalytics(budget: any, userId: string): Promise<BudgetAnalytics> {
  const now = new Date();
  const startDate = new Date(budget.startDate);
  const endDate = budget.endDate ? new Date(budget.endDate) : getEndDateForPeriod(startDate, budget.period);

  // Get transactions for the budget period
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      deletedAt: null,
    },
    select: {
      amount: true,
      type: true,
      category: true,
    },
  });

  // Calculate spending by category
  const spendingByCategory: Record<string, number> = {};
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const transaction of transactions) {
    if (transaction.type === 'CREDIT') {
      totalIncome += transaction.amount;
    } else {
      totalExpenses += Math.abs(transaction.amount);
      const category = transaction.category || 'OTHER';
      spendingByCategory[category] = (spendingByCategory[category] || 0) + Math.abs(transaction.amount);
    }
  }

  // Calculate analytics
  const totalBudgeted = budget.categories.reduce((sum: number, cat: any) => sum + cat.amount, 0);
  const totalSpent = totalExpenses;
  const totalRemaining = Math.max(0, totalBudgeted - totalSpent);
  const percentageUsed = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = totalDays - daysRemaining;

  // Project overspend based on current rate
  const dailySpendRate = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
  const projectedTotalSpend = dailySpendRate * totalDays;
  const projectedOverspend = Math.max(0, projectedTotalSpend - totalBudgeted);

  // Find categories over budget
  const categoriesOverBudget: string[] = [];
  const topSpendingCategories: any[] = [];

  for (const budgetCategory of budget.categories) {
    const spent = spendingByCategory[budgetCategory.category] || 0;
    const percentage = budgetCategory.amount > 0 ? (spent / budgetCategory.amount) * 100 : 0;
    
    if (percentage > 100) {
      categoriesOverBudget.push(budgetCategory.category);
    }

    topSpendingCategories.push({
      category: budgetCategory.category,
      budgeted: budgetCategory.amount,
      spent,
      percentage: Math.round(percentage * 100) / 100,
    });
  }

  // Sort by spending percentage
  topSpendingCategories.sort((a, b) => b.percentage - a.percentage);

  // Calculate savings rate
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  return {
    totalBudgeted,
    totalSpent,
    totalRemaining,
    percentageUsed: Math.round(percentageUsed * 100) / 100,
    daysRemaining,
    projectedOverspend: Math.round(projectedOverspend * 100) / 100,
    categoriesOverBudget,
    savingsRate: Math.round(savingsRate * 100) / 100,
    topSpendingCategories: topSpendingCategories.slice(0, 5),
  };
}

/**
 * Get end date for budget period
 */
function getEndDateForPeriod(startDate: Date, period: string): Date {
  switch (period) {
    case 'WEEKLY':
      return endOfWeek(startDate);
    case 'FORTNIGHTLY':
      return endOfWeek(new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000));
    case 'MONTHLY':
      return endOfMonth(startDate);
    case 'QUARTERLY':
      return endOfMonth(addMonths(startDate, 2));
    case 'YEARLY':
      return endOfYear(startDate);
    default:
      return endOfMonth(startDate);
  }
}

// Export with comprehensive middleware stack
export default composeMiddleware(
  validateMethod(['GET', 'POST']),
  withValidation({
    query: (req: NextApiRequest) => {
      if (req.method === 'GET') return budgetSchemas.list.query;
      return z.object({});
    },
    body: (req: NextApiRequest) => {
      if (req.method === 'POST') return budgetSchemas.create.body;
      return z.object({});
    },
  }),
  authMiddleware.authenticated,
  withCSRFProtection,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
  }),
)(withErrorHandler(budgetHandler));