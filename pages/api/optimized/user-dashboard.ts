import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { authMiddleware, AuthenticatedRequest } from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { getCacheManager, CacheTTL, CacheKeys } from '../../../lib/services/cache/cacheManager';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

/**
 * User dashboard endpoint with simplified database queries
 * Returns real user data including goals, transactions, and insights
 */
async function dashboardHandler(
  req: AuthenticatedRequest,
  res: NextApiResponse
) {
  // Add security headers
  addSecurityHeaders(res);
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return apiResponse.methodNotAllowed(res, { 
      error: 'Method not allowed',
      message: 'Only GET requests are allowed' 
    });
  }

  try {
    const userId = req.userId;
    const userRole = req.userRole;

    // Validate userId exists
    if (!userId) {
      return apiResponse.unauthorized(res, {
        error: 'Authentication Error',
        message: 'User ID not found in authenticated request'
      });
    }

    const cacheManager = await getCacheManager();
    const cacheKey = `dashboard:${userId}:summary`;
    
    // Try to get cached dashboard data
    const cachedDashboard = await cacheManager.remember(
      cacheKey,
      CacheTTL.MEDIUM, // 5 minutes cache for dashboard
      async () => {
        // Execute all queries in parallel for better performance
        // All queries are strictly filtered by the authenticated user's ID
        const [
          user,
          transactions,
          goals,
          categories,
          totalBalance
        ] = await Promise.all([
      // Get user profile with counts - strictly filtered by userId
      prisma.user.findUnique({
        where: { 
          id: userId,
          // Ensure user is not deleted or suspended
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          role: true,
          _count: {
            select: {
              transactions: true,
              goals: true,
              budgets: true,
              bankAccounts: true,
            }
          }
        }
      }),
      
      // Get recent transactions (last 3 months) - strictly filtered by userId
      prisma.transaction.findMany({
        where: {
          userId: userId, // Ensure only authenticated user's transactions
          date: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 3))
          },
          // Additional security: ensure transaction belongs to user's bank accounts
          bankAccount: {
            userId: userId
          }
        },
        orderBy: { date: 'desc' },
        take: 100,
        select: {
          id: true,
          amount: true,
          description: true,
          date: true,
          category: true,
          type: true,
          bankAccountId: true,
          // Verify bank account ownership
          bankAccount: {
            select: {
              userId: true,
              id: true
            }
          }
        }
      }).then(txns => 
        // Double-check: filter out any transactions not belonging to user
        txns.filter(t => t.bankAccount?.userId === userId)
          .map(({ bankAccount, ...t }) => t)
      ),
      
      // Get active goals - strictly filtered by userId
      prisma.goal.findMany({
        where: { 
          userId: userId, // Ensure only authenticated user's goals
          status: 'ACTIVE',
          // Additional security checks
          deletedAt: null
        },
        select: {
          id: true,
          name: true,
          targetAmount: true,
          currentAmount: true,
          deadline: true,
          category: true,
          createdAt: true,
          updatedAt: true,
          userId: true, // Include for verification
        }
      }).then(goals => 
        // Double-check: ensure all goals belong to authenticated user
        goals.filter(g => g.userId === userId)
          .map(({ userId, ...g }) => g)
      ),
      
      // Get spending by category for the last month - strictly filtered by userId
      prisma.transaction.groupBy({
        by: ['category'],
        where: {
          userId: userId, // Ensure only authenticated user's transactions
          type: 'EXPENSE',
          date: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1))
          },
          // Additional security: ensure transaction belongs to user's bank accounts
          bankAccount: {
            userId: userId
          }
        },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      }),
      
      // Get total balance across all accounts - strictly filtered by userId
      prisma.bankAccount.aggregate({
        where: { 
          userId: userId, // Ensure only authenticated user's accounts
          // Additional security checks
          deletedAt: null,
          status: {
            in: ['ACTIVE', 'CONNECTED'] // Only active accounts
          }
        },
        _sum: {
          balance: true
        }
      })
    ]);

    // Ensure user exists and data is isolated
    if (!user) {
      return apiResponse.notFound(res, { 
        error: 'User not found',
        message: 'User profile not found' 
      });
    }

    // Additional security check: verify user ID matches
    if (user.id !== userId) {
      console.error('Security violation: User ID mismatch', { 
        expected: userId, 
        received: user.id 
      });
      return apiResponse.forbidden(res, {
        error: 'Access Denied',
        message: 'You are not authorized to access this data'
      });
    }

    // Verify user role matches (prevent privilege escalation)
    if (user.role !== userRole && userRole !== 'ADMIN') {
      console.error('Security violation: Role mismatch', { 
        expected: userRole, 
        received: user.role 
      });
      return apiResponse.forbidden(res, {
        error: 'Access Denied',
        message: 'Role verification failed'
      });
    }

    // Calculate monthly spending trends
    const monthlySpending = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((acc, transaction) => {
        const monthKey = new Date(transaction.date).toISOString().slice(0, 7);
        if (!acc[monthKey]) {
          acc[monthKey] = 0;
        }
        acc[monthKey] += transaction.amount;
        return acc;
      }, {} as Record<string, number>);

    // Calculate goal progress
    const goalsWithProgress = goals.map(goal => {
      const progress = goal.targetAmount > 0 
        ? (goal.currentAmount / goal.targetAmount) * 100 
        : 0;
      const daysRemaining = goal.deadline 
        ? Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;
      
      return {
        ...goal,
        progressPercentage: Math.min(100, Math.round(progress * 100) / 100),
        daysRemaining,
        onTrack: daysRemaining && progress >= ((Date.now() - new Date(goal.createdAt).getTime()) / (new Date(goal.deadline).getTime() - new Date(goal.createdAt).getTime()) * 100)
      };
    });

    // Calculate insights
    const totalExpenses = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const insights = {
      totalBalance: totalBalance._sum.balance || 0,
      monthlyAverageSpending: Object.values(monthlySpending).length > 0
        ? Object.values(monthlySpending).reduce((sum, amount) => sum + amount, 0) / Object.values(monthlySpending).length
        : 0,
      totalExpensesLast3Months: totalExpenses,
      totalIncomeLast3Months: totalIncome,
      netCashFlow: totalIncome - totalExpenses,
      goalsOnTrack: goalsWithProgress.filter(g => g.onTrack).length,
      totalActiveGoals: goals.length,
      transactionCount: transactions.length,
      topSpendingCategories: categories
        .sort((a, b) => (b._sum.amount || 0) - (a._sum.amount || 0))
        .slice(0, 5)
        .map(cat => ({
          category: cat.category,
          amount: cat._sum.amount || 0,
          count: cat._count.id
        }))
    };

    // Build response with real user data
    const dashboardData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        memberSince: user.createdAt,
        stats: {
          transactions: user._count.transactions,
          goals: user._count.goals,
          budgets: user._count.budgets,
          bankAccounts: user._count.bankAccounts,
        }
      },
      financialSummary: {
        totalBalance: insights.totalBalance,
        monthlyAverageSpending: insights.monthlyAverageSpending,
        netCashFlow: insights.netCashFlow,
        totalExpenses: totalExpenses,
        totalIncome: totalIncome,
      },
      recentTransactions: transactions.slice(0, 10).map(t => ({
        id: t.id,
        amount: t.amount,
        description: t.description,
        date: t.date,
        category: t.category,
        type: t.type,
      })),
      goals: goalsWithProgress,
      monthlySpending,
      topCategories: insights.topSpendingCategories,
      insights: {
        ...insights,
        savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
        averageTransactionAmount: transactions.length > 0 
          ? transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length 
          : 0,
      },
      lastUpdated: new Date(),
      // Security metadata for audit
      _security: {
        dataScope: 'user-only',
        userId: userId,
        filteredBy: 'authenticated-user',
        verifiedAt: new Date().toISOString()
      }
    };

    return dashboardData;
      }
    );

    // Set security headers for user-specific data
    res.setHeader('Cache-Control', 'private, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Return successful response
    return apiResponse.success(res, cachedDashboard);

  } catch (error) {
    // Log error with user context for debugging
    logger.error('Dashboard API error:', error, { userId });
    
    // Log potential security issues
    if (error instanceof Error && error.message.includes('permission')) {
      console.error('Security: Permission error in dashboard', { 
        userId, 
        error: error.message 
      });
    }
    
    // Return user-friendly error response
    return apiResponse.internalError(res, { 
      error: 'Failed to load dashboard',
      message: 'An error occurred while loading your dashboard. Please try again later.',
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    });
  }
}

// Export with authentication and rate limiting middleware
export default withSessionRateLimit(
  authMiddleware.authenticated(dashboardHandler),
  {
    window: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute (dashboard can be refreshed frequently)
  }
);