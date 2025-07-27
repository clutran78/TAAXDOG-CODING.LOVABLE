import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { authMiddleware, AuthenticatedRequest } from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { getClientIp } from 'request-ip';
import { subDays, subHours, startOfDay, endOfDay } from 'date-fns';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

// Query validation schema
const AdminDashboardQuerySchema = z.object({
  timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  includeDetails: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

/**
 * Admin Dashboard API endpoint
 * Provides comprehensive system overview for administrators
 * Uses authentication middleware with ADMIN role requirement
 */
async function adminDashboardHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return apiResponse.methodNotAllowed(res, {
      error: 'Method not allowed',
      message: `Method ${req.method} is not allowed`,
    });
  }

  const userId = req.userId;
  const clientIp = getClientIp(req) || 'unknown';

  try {
    // Validate query parameters
    const validationResult = AdminDashboardQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      return apiResponse.error(res, {
        error: 'Validation error',
        message: 'Invalid query parameters',
        errors: validationResult.error.flatten(),
      });
    }

    const { timeRange, includeDetails } = validationResult.data;

    // Calculate time boundaries
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '1h':
        startDate = subHours(now, 1);
        break;
      case '24h':
        startDate = subDays(now, 1);
        break;
      case '7d':
        startDate = subDays(now, 7);
        break;
      case '30d':
        startDate = subDays(now, 30);
        break;
      default:
        startDate = subDays(now, 1);
    }

    // Log admin dashboard access
    await prisma.auditLog
      .create({
        data: {
          event: 'ADMIN_DASHBOARD_ACCESS',
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            timeRange,
            includeDetails,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    // Fetch comprehensive system metrics in parallel
    const [
      userMetrics,
      systemMetrics,
      securityMetrics,
      financialMetrics,
      performanceMetrics,
      recentActivity,
    ] = await Promise.all([
      // User metrics
      getUserMetrics(startDate),
      // System metrics
      getSystemMetrics(startDate),
      // Security metrics
      getSecurityMetrics(startDate),
      // Financial metrics
      getFinancialMetrics(startDate),
      // Performance metrics
      getPerformanceMetrics(startDate),
      // Recent admin activity
      includeDetails ? getRecentAdminActivity() : Promise.resolve([]),
    ]);

    // Generate alerts based on metrics
    const alerts = generateAlerts({
      userMetrics,
      systemMetrics,
      securityMetrics,
      financialMetrics,
      performanceMetrics,
    });

    // Calculate system health score
    const healthScore = calculateHealthScore({
      userMetrics,
      systemMetrics,
      securityMetrics,
      performanceMetrics,
    });

    // Set security headers
    res.setHeader('Cache-Control', 'private, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return apiResponse.success(res, {
      success: true,
      data: {
        overview: {
          healthScore,
          status: healthScore >= 90 ? 'healthy' : healthScore >= 70 ? 'warning' : 'critical',
          lastUpdated: now.toISOString(),
          timeRange,
        },
        metrics: {
          users: userMetrics,
          system: systemMetrics,
          security: securityMetrics,
          financial: financialMetrics,
          performance: performanceMetrics,
        },
        alerts,
        recentActivity: includeDetails ? recentActivity : undefined,
      },
      _security: {
        dataScope: 'admin-only',
        accessedBy: userId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Admin dashboard error:', error);

    // Log error
    await prisma.auditLog
      .create({
        data: {
          event: 'ADMIN_DASHBOARD_ERROR',
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    return apiResponse.internalError(res, {
      error: 'Dashboard data fetch failed',
      message: 'Unable to retrieve dashboard data. Please try again.',
    });
  }
}

// Helper functions for fetching metrics

async function getUserMetrics(startDate: Date) {
  const [totalUsers, newUsers, activeUsers, usersByRole, usersByStatus] = await Promise.all([
    // Total users
    prisma.user.count({ where: { deletedAt: null } }),
    // New users in period
    prisma.user.count({
      where: {
        createdAt: { gte: startDate },
        deletedAt: null,
      },
    }),
    // Active users (logged in during period)
    prisma.auditLog
      .findMany({
        where: {
          event: { in: ['LOGIN_SUCCESS', 'AUTH_SUCCESS'] },
          createdAt: { gte: startDate },
        },
        distinct: ['userId'],
        select: { userId: true },
      })
      .then((logs) => logs.length),
    // Users by role
    prisma.user.groupBy({
      by: ['role'],
      where: { deletedAt: null },
      _count: true,
    }),
    // Users by status
    prisma.user.groupBy({
      by: ['emailVerified', 'suspended', 'twoFactorEnabled'],
      where: { deletedAt: null },
      _count: true,
    }),
  ]);

  return {
    total: totalUsers,
    new: newUsers,
    active: activeUsers,
    byRole: usersByRole.reduce(
      (acc, item) => {
        acc[item.role] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    ),
    verified: usersByStatus
      .filter((s) => s.emailVerified !== null)
      .reduce((sum, s) => sum + s._count, 0),
    suspended: usersByStatus.filter((s) => s.suspended).reduce((sum, s) => sum + s._count, 0),
    with2FA: usersByStatus.filter((s) => s.twoFactorEnabled).reduce((sum, s) => sum + s._count, 0),
  };
}

async function getSystemMetrics(startDate: Date) {
  const [totalTransactions, totalGoals, totalReceipts, bankConnections, aiUsage] =
    await Promise.all([
      // Total transactions
      prisma.transaction.count({
        where: {
          createdAt: { gte: startDate },
          deletedAt: null,
        },
      }),
      // Active goals
      prisma.goal.count({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      }),
      // Processed receipts
      prisma.receipt.count({
        where: {
          processingStatus: { in: ['PROCESSED', 'MATCHED'] },
          createdAt: { gte: startDate },
          deletedAt: null,
        },
      }),
      // Active bank connections
      prisma.bankAccount.count({
        where: {
          status: { in: ['ACTIVE', 'CONNECTED'] },
          deletedAt: null,
        },
      }),
      // AI usage
      prisma.auditLog.count({
        where: {
          event: { startsWith: 'AI_' },
          createdAt: { gte: startDate },
          success: true,
        },
      }),
    ]);

  // Calculate storage usage (simplified)
  const storageMetrics = await prisma.receipt.aggregate({
    where: { deletedAt: null },
    _count: true,
    _avg: {
      fileSize: true,
    },
  });

  return {
    transactions: totalTransactions,
    goals: totalGoals,
    receipts: totalReceipts,
    bankConnections,
    aiRequests: aiUsage,
    storageUsedMB: Math.round(
      (storageMetrics._count * (storageMetrics._avg.fileSize || 500000)) / 1024 / 1024,
    ),
  };
}

async function getSecurityMetrics(startDate: Date) {
  const [failedLogins, suspiciousActivities, blockedRequests, securityEvents] = await Promise.all([
    // Failed login attempts
    prisma.auditLog.count({
      where: {
        event: { in: ['LOGIN_FAILED', 'AUTH_FAILED'] },
        createdAt: { gte: startDate },
      },
    }),
    // Suspicious activities
    prisma.auditLog.count({
      where: {
        event: { contains: 'SUSPICIOUS' },
        createdAt: { gte: startDate },
      },
    }),
    // Rate limit blocks
    prisma.auditLog.count({
      where: {
        event: { in: ['RATE_LIMIT_EXCEEDED', 'ACCESS_DENIED'] },
        createdAt: { gte: startDate },
      },
    }),
    // All security events
    prisma.auditLog.findMany({
      where: {
        OR: [
          { event: { contains: 'SECURITY' } },
          { event: { contains: 'FAILED' } },
          { event: { contains: 'DENIED' } },
          { event: { contains: 'BLOCKED' } },
        ],
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        event: true,
        userId: true,
        ipAddress: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  // Check for potential vulnerabilities
  const vulnerabilities = await checkVulnerabilities();

  return {
    failedLogins,
    suspiciousActivities,
    blockedRequests,
    recentEvents: securityEvents.length,
    vulnerabilities,
    score: calculateSecurityScore({
      failedLogins,
      suspiciousActivities,
      blockedRequests,
      vulnerabilities,
    }),
  };
}

async function getFinancialMetrics(startDate: Date) {
  const [revenue, activeSubscriptions, trialUsers, churnedUsers] = await Promise.all([
    // Revenue (simplified - would integrate with Stripe in production)
    prisma.transaction.aggregate({
      where: {
        type: 'INCOME',
        category: 'SUBSCRIPTION',
        date: { gte: startDate },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
    // Active subscriptions
    prisma.user.count({
      where: {
        subscriptionStatus: 'ACTIVE',
        deletedAt: null,
      },
    }),
    // Trial users
    prisma.user.count({
      where: {
        subscriptionStatus: 'TRIAL',
        deletedAt: null,
      },
    }),
    // Churned users in period
    prisma.user.count({
      where: {
        subscriptionStatus: 'CANCELLED',
        updatedAt: { gte: startDate },
        deletedAt: null,
      },
    }),
  ]);

  // Calculate MRR (Monthly Recurring Revenue)
  const mrr = activeSubscriptions * 18.99; // Simplified - would calculate based on actual plans

  return {
    revenue: revenue._sum.amount || 0,
    mrr,
    activeSubscriptions,
    trialUsers,
    churnedUsers,
    churnRate:
      activeSubscriptions > 0
        ? Math.round((churnedUsers / activeSubscriptions) * 100 * 100) / 100
        : 0,
  };
}

async function getPerformanceMetrics(startDate: Date) {
  // Get API response times from monitoring data
  const apiMetrics = await prisma.auditLog.findMany({
    where: {
      event: { startsWith: 'API_' },
      createdAt: { gte: startDate },
      metadata: { path: ['duration'], not: null },
    },
    select: {
      metadata: true,
    },
    take: 1000,
  });

  const durations = apiMetrics
    .map((m) => (m.metadata as any)?.duration)
    .filter((d) => typeof d === 'number');

  const avgResponseTime =
    durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  const p95ResponseTime =
    durations.length > 0 ? durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] : 0;

  // Database metrics
  const dbMetrics = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM pg_stat_activity WHERE state = 'active'
  `;

  return {
    avgResponseTimeMs: avgResponseTime,
    p95ResponseTimeMs: p95ResponseTime,
    activeDbConnections: Number(dbMetrics[0]?.count || 0),
    uptime: process.uptime(),
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  };
}

async function getRecentAdminActivity() {
  return prisma.auditLog.findMany({
    where: {
      OR: [{ event: { startsWith: 'ADMIN_' } }, { userId: { in: await getAdminUserIds() } }],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      event: true,
      userId: true,
      ipAddress: true,
      metadata: true,
      createdAt: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
}

async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'SUPPORT'] },
      deletedAt: null,
    },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

async function checkVulnerabilities() {
  const vulnerabilities = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  // Check for users without 2FA
  const privilegedUsersWithout2FA = await prisma.user.count({
    where: {
      role: { in: ['ADMIN', 'ACCOUNTANT', 'SUPPORT'] },
      twoFactorEnabled: false,
      deletedAt: null,
    },
  });

  if (privilegedUsersWithout2FA > 0) {
    vulnerabilities.high += 1;
  }

  // Check for old sessions
  const oldSessions = await prisma.session.count({
    where: {
      createdAt: { lt: subDays(new Date(), 30) },
      expires: { gt: new Date() },
    },
  });

  if (oldSessions > 10) {
    vulnerabilities.medium += 1;
  }

  // Check for weak passwords (simplified - would check password strength)
  const weakPasswordUsers = await prisma.user.count({
    where: {
      passwordResetRequired: true,
      deletedAt: null,
    },
  });

  if (weakPasswordUsers > 0) {
    vulnerabilities.high += 1;
  }

  return vulnerabilities;
}

function calculateSecurityScore(metrics: {
  failedLogins: number;
  suspiciousActivities: number;
  blockedRequests: number;
  vulnerabilities: { critical: number; high: number; medium: number; low: number };
}): number {
  let score = 100;

  // Deduct for vulnerabilities
  score -= metrics.vulnerabilities.critical * 25;
  score -= metrics.vulnerabilities.high * 15;
  score -= metrics.vulnerabilities.medium * 5;
  score -= metrics.vulnerabilities.low * 2;

  // Deduct for security events
  score -= Math.min(metrics.failedLogins * 0.5, 10);
  score -= Math.min(metrics.suspiciousActivities * 2, 20);
  score -= Math.min(metrics.blockedRequests * 0.2, 5);

  return Math.max(0, Math.round(score));
}

function calculateHealthScore(metrics: {
  userMetrics: any;
  systemMetrics: any;
  securityMetrics: any;
  performanceMetrics: any;
}): number {
  let score = 100;

  // Security impacts
  score = Math.min(score, metrics.securityMetrics.score);

  // Performance impacts
  if (metrics.performanceMetrics.avgResponseTimeMs > 1000) {
    score -= 10;
  }
  if (metrics.performanceMetrics.p95ResponseTimeMs > 2000) {
    score -= 15;
  }

  // System health impacts
  if (metrics.systemMetrics.bankConnections === 0) {
    score -= 5; // No bank connections might indicate issues
  }

  // User activity impacts
  const activeUserRatio = metrics.userMetrics.active / metrics.userMetrics.total;
  if (activeUserRatio < 0.1) {
    score -= 10; // Low user engagement
  }

  return Math.max(0, Math.round(score));
}

function generateAlerts(metrics: any): Array<{
  level: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
}> {
  const alerts = [];
  const now = new Date().toISOString();

  // Security alerts
  if (metrics.securityMetrics.failedLogins > 50) {
    alerts.push({
      level: 'critical' as const,
      title: 'High Failed Login Attempts',
      message: `${metrics.securityMetrics.failedLogins} failed login attempts detected`,
      timestamp: now,
    });
  }

  if (metrics.securityMetrics.vulnerabilities.critical > 0) {
    alerts.push({
      level: 'critical' as const,
      title: 'Critical Security Vulnerabilities',
      message: `${metrics.securityMetrics.vulnerabilities.critical} critical vulnerabilities require immediate attention`,
      timestamp: now,
    });
  }

  // Performance alerts
  if (metrics.performanceMetrics.avgResponseTimeMs > 1500) {
    alerts.push({
      level: 'warning' as const,
      title: 'Slow API Response Times',
      message: `Average response time is ${metrics.performanceMetrics.avgResponseTimeMs}ms`,
      timestamp: now,
    });
  }

  // Financial alerts
  if (metrics.financialMetrics.churnRate > 10) {
    alerts.push({
      level: 'warning' as const,
      title: 'High Churn Rate',
      message: `Customer churn rate is ${metrics.financialMetrics.churnRate}%`,
      timestamp: now,
    });
  }

  // System alerts
  if (metrics.systemMetrics.storageUsedMB > 5000) {
    alerts.push({
      level: 'info' as const,
      title: 'Storage Usage High',
      message: `Using ${metrics.systemMetrics.storageUsedMB}MB of storage`,
      timestamp: now,
    });
  }

  return alerts;
}

// Export with authentication middleware requiring ADMIN role
export default withSessionRateLimit(
  authMiddleware.authenticated(adminDashboardHandler, {
    allowedRoles: ['ADMIN'],
  }),
  {
    window: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute for admin dashboard
  },
);
