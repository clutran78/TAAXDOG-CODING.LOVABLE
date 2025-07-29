import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { z } from 'zod';
import { AuthEvent, TransactionType, TransactionStatus } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { logger } from '@/lib/logger';
import {
  authMiddleware,
  AuthenticatedRequest,
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
  BadRequestError,
} from '../../../lib/errors/api-error-handler';
import { sessionManager } from '../../../lib/auth/session-manager';
import { auditLogger, AuditCategory } from '../../../lib/audit/audit-logger';
import { startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Prisma } from '@prisma/client';

// Transaction categories
const TRANSACTION_CATEGORIES = [
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

// Tax categories (ATO compliant)
const TAX_CATEGORIES = [
  'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 
  'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15', 'P8',
] as const;

// Search query validation schema
const searchQuerySchema = z.object({
  // Search term
  q: z.string().max(100).optional(),
  
  // Filters
  type: z.enum(['CREDIT', 'DEBIT', 'ALL']).optional(),
  category: z.enum(TRANSACTION_CATEGORIES).optional(),
  taxCategory: z.enum(TAX_CATEGORIES).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  isBusinessExpense: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  isRecurring: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  
  // Amount filters
  minAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional(),
  maxAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional(),
  
  // Date filters
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  datePreset: z.enum(['today', 'yesterday', 'week', 'month', 'quarter', 'year', 'custom']).optional(),
  
  // Account filters
  accountId: z.string().uuid().optional(),
  institutionId: z.string().optional(),
  
  // Merchant filter
  merchant: z.string().max(100).optional(),
  
  // Tags filter (comma-separated)
  tags: z.string().max(200).optional(),
  
  // Sorting
  sortBy: z.enum([
    'date', 'amount', 'merchant', 'category', 'createdAt'
  ]).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  // Pagination
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
  
  // Export format
  export: z.enum(['json', 'csv', 'pdf']).optional(),
  
  // Include related data
  includeAccount: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  includeReceipts: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  includeNotes: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
}).refine((data) => {
  if (data.minAmount !== undefined && data.maxAmount !== undefined) {
    return data.minAmount <= data.maxAmount;
  }
  return true;
}, {
  message: "Min amount must be less than or equal to max amount",
  path: ["minAmount"],
});

// Search result interface
interface TransactionSearchResult {
  transactions: any[];
  aggregations: {
    totalCount: number;
    totalCredit: number;
    totalDebit: number;
    netAmount: number;
    averageTransaction: number;
    categorySummary: Record<string, { count: number; total: number }>;
    dailyTotals?: Array<{ date: string; credit: number; debit: number }>;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
  searchMetadata: {
    query: string;
    filters: Record<string, any>;
    executionTime: number;
  };
}

/**
 * Transaction search API endpoint
 * Provides advanced search capabilities with filters and aggregations
 */
async function transactionSearchHandler(req: AuthenticatedRequest, res: NextApiResponse) {
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

  logger.info('Transaction search API access', {
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
        return await handleTransactionSearch(userId, req.query, res, req, requestId);

      default:
        res.setHeader('Allow', ['GET']);
        throw new ValidationError(`Method ${req.method} is not allowed`);
    }
  } catch (error) {
    logger.error('Transaction search API error', {
      error,
      userId,
      method: req.method,
      requestId,
    });

    // Log error for monitoring
    await auditLogger.logApiAccess(
      '/api/search/transactions',
      req.method!,
      req,
      userId,
      500,
      0,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      }
    );

    throw error;
  }
}

/**
 * Handle transaction search
 */
async function handleTransactionSearch(
  userId: string,
  query: any,
  res: NextApiResponse,
  req: AuthenticatedRequest,
  requestId: string,
): Promise<void> {
  const startTime = Date.now();
  const cacheManager = await getCacheManager();

  try {
    // Validate query parameters
    const validatedQuery = searchQuerySchema.parse(query);
    const {
      q: searchTerm,
      type,
      category,
      taxCategory,
      status,
      isBusinessExpense,
      isRecurring,
      minAmount,
      maxAmount,
      dateFrom,
      dateTo,
      datePreset,
      accountId,
      institutionId,
      merchant,
      tags,
      sortBy,
      sortOrder,
      page,
      limit,
      export: exportFormat,
      includeAccount,
      includeReceipts,
      includeNotes,
    } = validatedQuery;

    // Check export permissions for large exports
    if (exportFormat && limit > 1000) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscription: true },
      });
      
      if (!user?.subscription || user.subscription.plan === 'FREE') {
        throw new BadRequestError('Large exports require a paid subscription');
      }
    }

    // Build cache key
    const cacheKey = `search:transactions:${userId}:${crypto
      .createHash('md5')
      .update(JSON.stringify(validatedQuery))
      .digest('hex')}`;

    // Try cache for non-export requests
    if (!exportFormat) {
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        logger.debug('Returning cached search results', { userId, requestId });
        return apiResponse.success(res, cached);
      }
    }

    // Build date range
    const { startDate, endDate } = getDateRange(datePreset, dateFrom, dateTo);

    // Build WHERE clause
    const where: Prisma.TransactionWhereInput = {
      userId,
      deletedAt: null,
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Apply filters
    if (type && type !== 'ALL') {
      where.type = type;
    }
    if (category) {
      where.category = category;
    }
    if (taxCategory) {
      where.taxCategory = taxCategory;
    }
    if (status) {
      where.status = status;
    }
    if (isBusinessExpense !== undefined) {
      where.isBusinessExpense = isBusinessExpense;
    }
    if (isRecurring !== undefined) {
      where.isRecurring = isRecurring;
    }
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amount = {};
      if (minAmount !== undefined) {
        where.amount.gte = minAmount;
      }
      if (maxAmount !== undefined) {
        where.amount.lte = maxAmount;
      }
    }
    if (accountId) {
      where.accountId = accountId;
    }
    if (institutionId) {
      where.account = {
        institutionId,
      };
    }
    if (merchant) {
      where.merchant = {
        contains: merchant,
        mode: 'insensitive',
      };
    }
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim());
      where.tags = {
        hasSome: tagList,
      };
    }

    // Full-text search
    if (searchTerm) {
      where.OR = [
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { merchant: { contains: searchTerm, mode: 'insensitive' } },
        { reference: { contains: searchTerm, mode: 'insensitive' } },
        { notes: { contains: searchTerm, mode: 'insensitive' } },
      ];

      // Try to parse as amount
      const amountSearch = parseFloat(searchTerm);
      if (!isNaN(amountSearch)) {
        where.OR.push({ amount: amountSearch });
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const take = Math.min(limit, exportFormat ? 10000 : 100); // Limit regular queries to 100

    // Build include options
    const include: Prisma.TransactionInclude = {};
    if (includeAccount) {
      include.account = {
        select: {
          id: true,
          name: true,
          accountNumber: true,
          institutionName: true,
        },
      };
    }
    if (includeReceipts) {
      include.receipts = {
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          uploadedAt: true,
        },
      };
    }

    // Execute queries in parallel
    const [transactions, totalCount, aggregations] = await Promise.all([
      // Get transactions
      prisma.transaction.findMany({
        where,
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take,
        include,
      }),
      
      // Get total count
      prisma.transaction.count({ where }),
      
      // Get aggregations
      getAggregations(where, userId),
    ]);

    // Get daily totals for the date range (if reasonable)
    let dailyTotals;
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 90 && !exportFormat) {
      dailyTotals = await getDailyTotals(where, startDate, endDate);
    }

    // Format transactions
    const formattedTransactions = transactions.map(transaction => ({
      id: transaction.id,
      date: transaction.date,
      type: transaction.type,
      amount: transaction.amount,
      formattedAmount: formatAmount(transaction.amount, transaction.type),
      merchant: transaction.merchant,
      description: transaction.description,
      category: transaction.category,
      taxCategory: transaction.taxCategory,
      isBusinessExpense: transaction.isBusinessExpense,
      isRecurring: transaction.isRecurring,
      status: transaction.status,
      reference: transaction.reference,
      notes: includeNotes ? transaction.notes : undefined,
      tags: transaction.tags,
      account: include.account ? transaction.account : undefined,
      receipts: include.receipts ? transaction.receipts : undefined,
      metadata: {
        source: transaction.source,
        processingDate: transaction.processingDate,
        hasReceipt: transaction.receiptCount > 0,
      },
    }));

    // Handle export
    if (exportFormat) {
      return await handleExport(
        formattedTransactions,
        aggregations,
        exportFormat,
        userId,
        res,
        requestId
      );
    }

    // Build response
    const result: TransactionSearchResult = {
      transactions: formattedTransactions,
      aggregations: {
        ...aggregations,
        dailyTotals,
      },
      pagination: {
        page,
        limit: take,
        total: totalCount,
        pages: Math.ceil(totalCount / take),
        hasMore: skip + take < totalCount,
      },
      searchMetadata: {
        query: searchTerm || '',
        filters: {
          type,
          category,
          taxCategory,
          dateRange: { from: startDate, to: endDate },
          merchant,
          tags: tags?.split(',').map(t => t.trim()),
        },
        executionTime: Date.now() - startTime,
      },
    };

    // Cache the result
    await cacheManager.set(cacheKey, result, CacheTTL.MINUTE * 5);

    // Log search
    await auditLogger.logDataAccess(
      'transactions',
      'SEARCH',
      req,
      userId,
      undefined,
      {
        searchTerm,
        filters: validatedQuery,
        resultCount: totalCount,
        executionTime: Date.now() - startTime,
        requestId,
      }
    );

    logger.info('Transaction search completed', {
      userId,
      resultCount: totalCount,
      executionTime: Date.now() - startTime,
      requestId,
    });

    return apiResponse.success(res, result);

  } catch (error) {
    logger.error('Transaction search failed', {
      error,
      userId,
      duration: Date.now() - startTime,
      requestId,
    });

    throw error;
  }
}

/**
 * Get date range based on preset or custom dates
 */
function getDateRange(
  preset?: string,
  dateFrom?: string,
  dateTo?: string
): { startDate: Date; endDate: Date } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = endOfDay(now);

  switch (preset) {
    case 'today':
      startDate = startOfDay(now);
      break;
    case 'yesterday':
      startDate = startOfDay(subDays(now, 1));
      endDate = endOfDay(subDays(now, 1));
      break;
    case 'week':
      startDate = subDays(now, 7);
      break;
    case 'month':
      startDate = subMonths(now, 1);
      break;
    case 'quarter':
      startDate = subMonths(now, 3);
      break;
    case 'year':
      startDate = subMonths(now, 12);
      break;
    case 'custom':
    default:
      if (dateFrom) {
        startDate = startOfDay(parseISO(dateFrom));
      } else {
        startDate = subMonths(now, 1); // Default to last month
      }
      if (dateTo) {
        endDate = endOfDay(parseISO(dateTo));
      }
  }

  return { startDate, endDate };
}

/**
 * Get aggregations for search results
 */
async function getAggregations(
  where: Prisma.TransactionWhereInput,
  userId: string
): Promise<any> {
  const [creditSum, debitSum, categorySums] = await Promise.all([
    // Total credits
    prisma.transaction.aggregate({
      where: {
        ...where,
        type: 'CREDIT',
      },
      _sum: {
        amount: true,
      },
      _count: true,
      _avg: {
        amount: true,
      },
    }),
    
    // Total debits
    prisma.transaction.aggregate({
      where: {
        ...where,
        type: 'DEBIT',
      },
      _sum: {
        amount: true,
      },
      _count: true,
      _avg: {
        amount: true,
      },
    }),
    
    // Category breakdown
    prisma.transaction.groupBy({
      by: ['category'],
      where,
      _sum: {
        amount: true,
      },
      _count: true,
    }),
  ]);

  const totalCredit = creditSum._sum.amount || 0;
  const totalDebit = Math.abs(debitSum._sum.amount || 0);
  const totalCount = creditSum._count + debitSum._count;
  const totalAmount = totalCredit + totalDebit;
  const averageTransaction = totalCount > 0 ? totalAmount / totalCount : 0;

  // Build category summary
  const categorySummary: Record<string, { count: number; total: number }> = {};
  for (const cat of categorySums) {
    if (cat.category) {
      categorySummary[cat.category] = {
        count: cat._count,
        total: Math.abs(cat._sum.amount || 0),
      };
    }
  }

  return {
    totalCount,
    totalCredit,
    totalDebit,
    netAmount: totalCredit - totalDebit,
    averageTransaction: Math.round(averageTransaction * 100) / 100,
    categorySummary,
  };
}

/**
 * Get daily totals for date range
 */
async function getDailyTotals(
  where: Prisma.TransactionWhereInput,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; credit: number; debit: number }>> {
  const dailyData = await prisma.$queryRaw<Array<{
    date: Date;
    type: string;
    total: number;
  }>>`
    SELECT 
      DATE(date) as date,
      type,
      SUM(amount) as total
    FROM "Transaction"
    WHERE 
      "userId" = ${where.userId}
      AND date >= ${startDate}
      AND date <= ${endDate}
      AND "deletedAt" IS NULL
    GROUP BY DATE(date), type
    ORDER BY date
  `;

  // Transform to desired format
  const dailyMap = new Map<string, { credit: number; debit: number }>();
  
  for (const row of dailyData) {
    const dateStr = row.date.toISOString().split('T')[0];
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { credit: 0, debit: 0 });
    }
    
    const dayData = dailyMap.get(dateStr)!;
    if (row.type === 'CREDIT') {
      dayData.credit = Number(row.total);
    } else {
      dayData.debit = Math.abs(Number(row.total));
    }
  }

  return Array.from(dailyMap.entries()).map(([date, data]) => ({
    date,
    ...data,
  }));
}

/**
 * Format amount with proper sign and currency
 */
function formatAmount(amount: number, type: TransactionType): string {
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(absAmount);
  
  return type === 'DEBIT' ? `-${formatted}` : formatted;
}

/**
 * Handle export functionality
 */
async function handleExport(
  transactions: any[],
  aggregations: any,
  format: 'json' | 'csv' | 'pdf',
  userId: string,
  res: NextApiResponse,
  requestId: string
): Promise<void> {
  logger.info('Exporting transactions', {
    userId,
    format,
    count: transactions.length,
    requestId,
  });

  switch (format) {
    case 'json':
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="transactions.json"');
      return apiResponse.success(res, {
        transactions,
        aggregations,
        exportDate: new Date().toISOString(),
      });

    case 'csv':
      const csv = generateCSV(transactions);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
      res.status(200).send(csv);
      break;

    case 'pdf':
      // TODO: Implement PDF generation
      throw new BadRequestError('PDF export not yet implemented');

    default:
      throw new BadRequestError('Invalid export format');
  }
}

/**
 * Generate CSV from transactions
 */
function generateCSV(transactions: any[]): string {
  const headers = [
    'Date',
    'Type',
    'Amount',
    'Merchant',
    'Description',
    'Category',
    'Tax Category',
    'Business Expense',
    'Recurring',
    'Status',
    'Reference',
    'Tags',
  ];

  const rows = transactions.map(t => [
    t.date,
    t.type,
    t.amount,
    t.merchant || '',
    t.description || '',
    t.category || '',
    t.taxCategory || '',
    t.isBusinessExpense ? 'Yes' : 'No',
    t.isRecurring ? 'Yes' : 'No',
    t.status,
    t.reference || '',
    Array.isArray(t.tags) ? t.tags.join(';') : '',
  ]);

  // Escape CSV values
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n');

  return csvContent;
}

// Export with comprehensive middleware stack
export default composeMiddleware(
  validateMethod(['GET']),
  authMiddleware.authenticated,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 60, // 60 searches per minute
  }),
)(withErrorHandler(transactionSearchHandler));