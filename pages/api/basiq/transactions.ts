import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import prisma from '../../../lib/prisma';
import { z } from 'zod';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import {
  authMiddleware,
  AuthenticatedRequest,
  buildUserScopedFilters,
  validateResourceOwnership,
} from '../../../lib/middleware/auth';
import { withSessionRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/security/rateLimiter';
import { getClientIP } from '../../../lib/auth/auth-utils';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import { transactionSchemas } from '../../../lib/validation/api-schemas';
import { logger } from '@/lib/logger';
import { AuthEvent, TransactionType } from '@prisma/client';
import { apiResponse } from '@/lib/api/response';
import {
  withErrorHandler,
  successResponse,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  tryCatch,
} from '../../../lib/errors/api-error-handler';
import { basiqService } from '../../../lib/basiq/service';
import { withCSRFProtection } from '../../../lib/auth/csrf-protection';
import { sessionManager } from '../../../lib/auth/session-manager';

// Australian tax categories for expense deductions (ATO compliant)
const TAX_CATEGORIES = {
  D1: 'Car expenses',
  D2: 'Travel expenses',
  D3: 'Clothing, laundry and dry-cleaning expenses',
  D4: 'Education expenses',
  D5: 'Other work-related expenses',
  D6: 'Low value pool deduction',
  D7: 'Interest deductions',
  D8: 'Dividend deductions',
  D9: 'Gifts and donations',
  D10: 'Cost of managing tax affairs',
  D11: 'Deductible amount of undeducted purchase price',
  D12: 'Personal superannuation contributions',
  D13: 'Deduction for project pool',
  D14: 'Forestry managed investment',
  D15: 'Other deductions',
  P8: 'Partnership and trust deductions',
  PERSONAL: 'Personal/Non-deductible',
} as const;

// Transaction sync status
enum SyncStatus {
  PENDING = 'PENDING',
  SYNCING = 'SYNCING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// Cache for transaction summaries (5 minutes)
const summaryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * BASIQ transactions API endpoint with comprehensive validation
 * Handles fetching, syncing, and categorizing bank transactions
 * Uses authentication middleware to ensure data isolation
 */
async function transactionsHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers to all responses
  addSecurityHeaders(res);

  const requestId = (req as any).requestId || crypto.randomUUID();
  const userId = req.userId;
  const userEmail = req.userEmail;
  const clientIp = getClientIP(req);
  const sessionId = req.session?.id;

  // Validate userId exists
  if (!userId) {
    logger.error('Missing user ID in authenticated request', { requestId });
    throw new AuthenticationError('User authentication failed');
  }

  // Update session activity
  if (sessionId) {
    await sessionManager.updateSessionActivity(sessionId, req);
  }

  logger.info('Transaction API access', {
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
        return await handleGetTransactions(userId, req.query, res, req, requestId);

      case 'POST':
        return await handleUpdateTransaction(userId, req.body, res, req, requestId);

      case 'PUT':
        return await handleSyncTransactions(userId, req.body, res, req, requestId);

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT']);
        throw new ValidationError(`Method ${req.method} is not allowed`);
    }
  } catch (error) {
    logger.error('Transaction API error', {
      error,
      userId,
      method: req.method,
      requestId,
    });
    throw error;
  }
}

/**
 * Get transactions with optional filtering and tax categorization
 */
async function handleGetTransactions(
  userId: string,
  query: any,
  res: NextApiResponse,
  req: AuthenticatedRequest,
  requestId?: string,
) {
  // Query is already validated by middleware
  const {
    page = 1,
    limit = 20,
    startDate,
    endDate,
    category,
    taxCategory,
    isBusinessExpense,
    bankAccountId,
    search,
    sortBy = 'date',
    sortOrder = 'desc',
    includeReceipts = false,
    includeSummary = true,
  } = query;

  // Check cache for summary if requested
  const cacheKey = `summary:${userId}:${JSON.stringify(query)}`;
  if (includeSummary && summaryCache.has(cacheKey)) {
    const cached = summaryCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug('Returning cached transaction summary', { userId, requestId });
      return apiResponse.success(res, cached.data);
    }
    summaryCache.delete(cacheKey);
  }

  // Build date filters with proper timezone handling
  const dateFilters: any = {};
  if (startDate) {
    dateFilters.gte = new Date(`${startDate}T00:00:00Z`);
  }
  if (endDate) {
    dateFilters.lte = new Date(`${endDate}T23:59:59Z`);
  }

  // Build optimized query filters
  const where: any = {
    userId,
    deletedAt: null, // Exclude soft-deleted transactions
    ...(Object.keys(dateFilters).length > 0 && { date: dateFilters }),
    ...(category && { category }),
    ...(taxCategory && { taxCategory }),
    ...(isBusinessExpense !== undefined && { isBusinessExpense }),
    ...(bankAccountId && { bankAccountId }),
  };

  // Add search with full-text search if available
  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
      { merchantName: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Verify bank account ownership if specified
  if (bankAccountId) {
    const account = await prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!account) {
      logger.warn('Unauthorized bank account access attempt', {
        userId,
        attemptedAccountId: bankAccountId,
        clientIp: getClientIP(req),
        requestId,
      });

      await prisma.auditLog.create({
        data: {
          event: AuthEvent.UNAUTHORIZED_ACCESS,
          userId,
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            resource: 'bankAccount',
            attemptedId: bankAccountId,
            action: 'read',
          },
        },
      });

      throw new NotFoundError('Bank account not found');
    }
  }

  // Calculate pagination
  const skip = (page - 1) * limit;
  const take = Math.min(limit, 100); // Cap at 100 for performance

  // Use transaction for consistency
  const result = await prisma.$transaction(async (tx) => {
    // Get total count for pagination
    const total = await tx.transaction.count({ where });

    // Fetch transactions with optimized includes
    const transactions = await tx.transaction.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      take,
      skip,
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        type: true,
        category: true,
        taxCategory: true,
        isBusinessExpense: true,
        notes: true,
        merchantName: true,
        basiqTransactionId: true,
        receiptId: includeReceipts,
        bankAccount: {
          select: {
            id: true,
            accountName: true,
            institution: true,
            accountNumber: true,
          },
        },
        receipt: includeReceipts ? {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            uploadedAt: true,
          },
        } : false,
      },
    });

    // Calculate summary statistics only if requested
    let summary = null;
    if (includeSummary) {
      const [income, expenses, taxDeductible] = await Promise.all([
        tx.transaction.aggregate({
          where: { ...where, type: TransactionType.CREDIT },
          _sum: { amount: true },
          _count: true,
        }),
        tx.transaction.aggregate({
          where: { ...where, type: TransactionType.DEBIT },
          _sum: { amount: true },
          _count: true,
        }),
        tx.transaction.aggregate({
          where: { ...where, isBusinessExpense: true, type: TransactionType.DEBIT },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

      summary = {
        totalIncome: income._sum.amount || 0,
        totalExpenses: Math.abs(expenses._sum.amount || 0),
        totalDeductible: Math.abs(taxDeductible._sum.amount || 0),
        netCashFlow: (income._sum.amount || 0) + (expenses._sum.amount || 0),
        averageIncome: income._count ? (income._sum.amount || 0) / income._count : 0,
        averageExpense: expenses._count ? Math.abs(expenses._sum.amount || 0) / expenses._count : 0,
        transactionCount: total,
        incomeCount: income._count,
        expenseCount: expenses._count,
        deductibleCount: taxDeductible._count,
      };
    }

    return { transactions, total, summary };
  });

  // Format transactions with GST calculations and data sanitization
  const formattedTransactions = result.transactions.map((transaction) => {
    const absAmount = Math.abs(transaction.amount);
    const gstAmount = transaction.isBusinessExpense && transaction.type === TransactionType.DEBIT
      ? calculateGST(absAmount)
      : null;

    return {
      id: transaction.id,
      description: sanitizeString(transaction.description),
      amount: transaction.amount,
      date: transaction.date.toISOString(),
      type: transaction.type,
      category: transaction.category,
      taxCategory: transaction.taxCategory,
      taxCategoryName: transaction.taxCategory ? TAX_CATEGORIES[transaction.taxCategory as keyof typeof TAX_CATEGORIES] : null,
      isBusinessExpense: transaction.isBusinessExpense,
      gstAmount,
      netAmount: gstAmount ? absAmount - gstAmount : absAmount,
      notes: sanitizeString(transaction.notes),
      merchantName: sanitizeString(transaction.merchantName),
      bankAccount: {
        id: transaction.bankAccount.id,
        name: transaction.bankAccount.accountName,
        institution: transaction.bankAccount.institution,
        lastFour: transaction.bankAccount.accountNumber?.slice(-4) || '****',
      },
      receipt: transaction.receipt || null,
    };
  });

  // Build response
  const response = {
    transactions: formattedTransactions,
    pagination: {
      page,
      limit: take,
      total: result.total,
      pages: Math.ceil(result.total / take),
      hasMore: skip + take < result.total,
    },
    summary: result.summary,
    filters: {
      startDate: startDate || null,
      endDate: endDate || null,
      category: category || null,
      taxCategory: taxCategory || null,
      isBusinessExpense: isBusinessExpense ?? null,
      bankAccountId: bankAccountId || null,
    },
  };

  // Cache summary if generated
  if (includeSummary && result.summary) {
    summaryCache.set(cacheKey, {
      data: response,
      timestamp: Date.now(),
    });
  }

  logger.info('Transactions retrieved successfully', {
    userId,
    count: formattedTransactions.length,
    total: result.total,
    cached: false,
    requestId,
  });

  return apiResponse.success(res, response);
}

/**
 * Update transaction categorization and tax information
 */
async function handleUpdateTransaction(
  userId: string,
  body: any,
  res: NextApiResponse,
  req: AuthenticatedRequest,
  requestId?: string,
) {
  // Body is already validated by middleware
  const { transactionId, category, taxCategory, isBusinessExpense, notes, receiptId } = body;
  const clientIp = getClientIP(req);

  // Validate tax category if provided
  if (taxCategory && !Object.keys(TAX_CATEGORIES).includes(taxCategory)) {
    throw new ValidationError(`Invalid tax category: ${taxCategory}`);
  }

  // Use transaction for consistency
  const result = await prisma.$transaction(async (tx) => {
    // Verify transaction ownership with select optimization
    const transaction = await tx.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        amount: true,
        type: true,
        bankAccountId: true,
        isBusinessExpense: true,
        taxCategory: true,
      },
    });

    if (!transaction) {
      logger.warn('Unauthorized transaction update attempt', {
        userId,
        attemptedTransactionId: transactionId,
        clientIp,
        requestId,
      });

      await tx.auditLog.create({
        data: {
          event: AuthEvent.UNAUTHORIZED_ACCESS,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            resource: 'transaction',
            attemptedId: transactionId,
            action: 'update',
          },
        },
      });

      throw new NotFoundError('Transaction not found');
    }

    // Validate receipt ownership if provided
    if (receiptId) {
      const receipt = await tx.receipt.findFirst({
        where: {
          id: receiptId,
          userId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!receipt) {
        logger.warn('Invalid receipt ID in transaction update', {
          userId,
          transactionId,
          attemptedReceiptId: receiptId,
          requestId,
        });

        throw new ValidationError('Invalid receipt ID');
      }
    }

    // Build update data with validation
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Track changes for audit log
    const changes: string[] = [];

    if (category !== undefined) {
      updateData.category = category;
      changes.push('category');
    }

    if (taxCategory !== undefined) {
      updateData.taxCategory = taxCategory;
      changes.push('taxCategory');
      
      // Auto-set as business expense if tax category is set
      if (taxCategory && taxCategory !== 'PERSONAL') {
        updateData.isBusinessExpense = true;
        changes.push('isBusinessExpense');
      }
    }

    if (isBusinessExpense !== undefined) {
      updateData.isBusinessExpense = isBusinessExpense;
      changes.push('isBusinessExpense');
      
      // Clear tax category if marking as personal
      if (!isBusinessExpense && transaction.taxCategory !== 'PERSONAL') {
        updateData.taxCategory = 'PERSONAL';
        changes.push('taxCategory');
      }
    }

    if (notes !== undefined) {
      updateData.notes = sanitizeString(notes).slice(0, 500); // Limit notes length
      changes.push('notes');
    }

    if (receiptId !== undefined) {
      updateData.receiptId = receiptId;
      changes.push('receiptId');
    }

    // Update transaction
    const updatedTransaction = await tx.transaction.update({
      where: {
        id: transactionId,
      },
      data: updateData,
      include: {
        receipt: !!receiptId,
      },
    });

    // Log successful update
    await tx.auditLog.create({
      data: {
        event: AuthEvent.DATA_UPDATE,
        userId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: {
          resource: 'transaction',
          transactionId,
          updatedFields: changes,
          previousValues: {
            isBusinessExpense: transaction.isBusinessExpense,
            taxCategory: transaction.taxCategory,
          },
        },
      },
    });

    return updatedTransaction;
  });

  // Clear cache for this user
  for (const [key] of summaryCache) {
    if (key.includes(userId)) {
      summaryCache.delete(key);
    }
  }

  logger.info('Transaction updated successfully', {
    userId,
    transactionId,
    updatedFields: Object.keys(body).filter(k => k !== 'transactionId'),
    requestId,
  });

  // Calculate GST if business expense
  const gstAmount = result.isBusinessExpense && result.type === TransactionType.DEBIT
    ? calculateGST(Math.abs(result.amount))
    : null;

  return apiResponse.success(res, {
    id: result.id,
    category: result.category,
    taxCategory: result.taxCategory,
    taxCategoryName: result.taxCategory ? TAX_CATEGORIES[result.taxCategory as keyof typeof TAX_CATEGORIES] : null,
    isBusinessExpense: result.isBusinessExpense,
    notes: result.notes,
    gstAmount,
    receipt: result.receipt || null,
    updatedAt: result.updatedAt.toISOString(),
  });
}

/**
 * Sync transactions from BASIQ
 */
async function handleSyncTransactions(
  userId: string,
  body: any,
  res: NextApiResponse,
  req: AuthenticatedRequest,
  requestId?: string,
) {
  const { bankAccountId, startDate, endDate } = body;
  const clientIp = getClientIP(req);

  // Verify bank account ownership
  const bankAccount = await prisma.bankAccount.findFirst({
    where: {
      id: bankAccountId,
      userId,
      deletedAt: null,
    },
    select: {
      id: true,
      basiqAccountId: true,
      lastSyncedAt: true,
      syncStatus: true,
    },
  });

  if (!bankAccount) {
    logger.warn('Unauthorized bank account sync attempt', {
      userId,
      attemptedAccountId: bankAccountId,
      clientIp,
      requestId,
    });

    throw new NotFoundError('Bank account not found');
  }

  // Check if already syncing
  if (bankAccount.syncStatus === SyncStatus.SYNCING) {
    logger.info('Sync already in progress', {
      userId,
      bankAccountId,
      requestId,
    });

    return apiResponse.success(res, {
      status: 'already_syncing',
      message: 'Sync already in progress for this account',
    });
  }

  // Update sync status
  await prisma.bankAccount.update({
    where: { id: bankAccountId },
    data: { syncStatus: SyncStatus.SYNCING },
  });

  // Trigger async sync
  setImmediate(async () => {
    try {
      logger.info('Starting transaction sync', {
        userId,
        bankAccountId,
        basiqAccountId: bankAccount.basiqAccountId,
        requestId,
      });

      // Call BASIQ service to sync transactions
      const syncResult = await basiqService.syncTransactions(
        userId,
        bankAccount.basiqAccountId!,
        {
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          lastSyncedAt: bankAccount.lastSyncedAt || undefined,
        }
      );

      // Update sync status
      await prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: {
          syncStatus: SyncStatus.COMPLETED,
          lastSyncedAt: new Date(),
        },
      });

      // Clear cache for this user
      for (const [key] of summaryCache) {
        if (key.includes(userId)) {
          summaryCache.delete(key);
        }
      }

      logger.info('Transaction sync completed', {
        userId,
        bankAccountId,
        transactionsAdded: syncResult.added,
        transactionsUpdated: syncResult.updated,
        requestId,
      });

      // Log audit event
      await prisma.auditLog.create({
        data: {
          event: AuthEvent.DATA_SYNC,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            bankAccountId,
            transactionsAdded: syncResult.added,
            transactionsUpdated: syncResult.updated,
            duration: syncResult.duration,
          },
        },
      });
    } catch (error) {
      logger.error('Transaction sync failed', {
        error,
        userId,
        bankAccountId,
        requestId,
      });

      // Update sync status
      await prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { syncStatus: SyncStatus.FAILED },
      });

      // Log audit event
      await prisma.auditLog.create({
        data: {
          event: AuthEvent.DATA_SYNC,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            bankAccountId,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      });
    }
  });

  return apiResponse.success(res, {
    status: 'sync_started',
    message: 'Transaction sync has been initiated',
    bankAccountId,
  });
}

/**
 * Calculate GST amount (10% for Australia)
 */
function calculateGST(amount: number): number {
  // GST is 1/11th of the GST-inclusive amount
  return Math.round((amount / 11) * 100) / 100;
}

/**
 * Sanitize string input
 */
function sanitizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str.trim().replace(/[<>]/g, '');
}

// Export with validation, authentication, rate limiting and error handling middleware
export default composeMiddleware(
  validateMethod(['GET', 'POST', 'PUT']),
  withValidation({
    query: (req: NextApiRequest) => {
      if (req.method === 'GET') return transactionSchemas.list.query;
      return z.object({});
    },
    body: (req: NextApiRequest) => {
      if (req.method === 'POST') return transactionSchemas.update.body;
      if (req.method === 'PUT') return transactionSchemas.sync.body;
      return z.object({});
    },
    response: (req: NextApiRequest) => {
      if (req.method === 'GET') return transactionSchemas.list.response;
      if (req.method === 'POST') return transactionSchemas.update.response;
      return transactionSchemas.sync.response;
    },
  }),
  authMiddleware.authenticated,
  withCSRFProtection,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute (higher for transaction syncing)
  }),
)(withErrorHandler(transactionsHandler));
