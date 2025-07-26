import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { z } from 'zod';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import {
  authMiddleware,
  AuthenticatedRequest,
  buildUserScopedFilters,
  validateResourceOwnership,
} from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { getClientIp } from 'request-ip';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import { transactionSchemas } from '../../../lib/validation/api-schemas';
import { logger } from '../../../lib/utils/logger';
import { AuthEvent } from '@prisma/client';
import { apiResponse } from '@/lib/api/response';
import {
  withErrorHandler,
  successResponse,
  AuthenticationError,
  NotFoundError,
  tryCatch,
} from '../../../lib/errors/api-error-handler';

// Australian tax categories for expense deductions
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
};

// Re-use schemas from api-schemas for consistency
const validTaxCategories = Object.keys(TAX_CATEGORIES) as [string, ...string[]];

/**
 * BASIQ transactions API endpoint with comprehensive validation
 * Handles fetching, syncing, and categorizing bank transactions
 * Uses authentication middleware to ensure data isolation
 */
async function transactionsHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers to all responses
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const userId = req.userId;
  const userEmail = req.userEmail;
  const clientIp = getClientIp(req) || 'unknown';

  // Validate userId exists
  if (!userId) {
    throw new AuthenticationError('User ID not found in authenticated request');
  }

  logger.info('Transaction API access', {
    userId,
    method: req.method,
    clientIp,
    requestId,
  });

  switch (req.method) {
    case 'GET':
      return handleGetTransactions(userId, req.query, res, req.userRole, requestId);

    case 'POST':
      return handleUpdateTransaction(userId, req.body, res, req, requestId);

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      throw new Error(`Method ${req.method} is not allowed`);
  }
}

/**
 * Get transactions with optional filtering and tax categorization
 */
async function handleGetTransactions(
  userId: string,
  query: any,
  res: NextApiResponse,
  userRole?: string,
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
  } = query;

  // Build date filters
  const dateFilters: any = {};
  if (startDate) {
    dateFilters.gte = new Date(startDate);
  }
  if (endDate) {
    dateFilters.lte = new Date(endDate);
  }

  // Build query filters
  const where: any = {
    userId,
    ...(Object.keys(dateFilters).length > 0 && { date: dateFilters }),
    ...(category && { category }),
    ...(taxCategory && { taxCategory }),
    ...(isBusinessExpense !== undefined && { isBusinessExpense }),
    ...(bankAccountId && { bankAccountId }),
    ...(search && {
      OR: [
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  // Verify bank account ownership if specified
  if (bankAccountId) {
    const account = await prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        userId,
        deletedAt: null,
      },
    });

    if (!account) {
      logger.warn('Unauthorized bank account access attempt', {
        userId,
        attemptedAccountId: bankAccountId,
        requestId,
      });

      await prisma.auditLog.create({
        data: {
          event: 'UNAUTHORIZED_ACCESS' as AuthEvent,
          userId,
          ipAddress: getClientIp(req) || 'unknown',
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            resource: 'bankAccount',
            attemptedId: bankAccountId,
          },
        },
      });

      throw new NotFoundError('Bank account not found');
    }
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Get total count for pagination
  const total = await prisma.transaction.count({ where });

  // Fetch transactions
  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    take: limit,
    skip,
    include: {
      bankAccount: {
        select: {
          id: true,
          accountName: true,
          institution: true,
        },
      },
    },
  });

  // Calculate summary statistics
  const [income, expenses] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...where, type: 'DEPOSIT' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: 'WITHDRAWAL' },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const summary = {
    totalIncome: income._sum.amount || 0,
    totalExpenses: Math.abs(expenses._sum.amount || 0),
    netCashFlow: (income._sum.amount || 0) + (expenses._sum.amount || 0),
    averageTransaction:
      transactions.length > 0
        ? ((income._sum.amount || 0) + Math.abs(expenses._sum.amount || 0)) / transactions.length
        : 0,
    transactionCount: transactions.length,
  };

  // Format transactions with GST calculations
  const formattedTransactions = transactions.map((transaction) => {
    const gstAmount =
      transaction.isBusinessExpense && transaction.type === 'WITHDRAWAL'
        ? calculateGST(Math.abs(transaction.amount))
        : null;

    return {
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      date: transaction.date,
      type: transaction.type,
      category: transaction.category,
      taxCategory: transaction.taxCategory,
      isBusinessExpense: transaction.isBusinessExpense,
      gstAmount,
      userId: transaction.userId,
      bankAccountId: transaction.bankAccountId,
      receiptId: transaction.receiptId,
    };
  });

  logger.info('Transactions retrieved', {
    userId,
    count: transactions.length,
    requestId,
  });

  return apiResponse.success(res, 
    successResponse({
      transactions: formattedTransactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
      summary,
    }),
  );
}

/**
 * Update transaction categorization and tax information
 */
async function handleUpdateTransaction(
  userId: string,
  body: any,
  res: NextApiResponse,
  req?: AuthenticatedRequest,
  requestId?: string,
) {
  // Body is already validated by middleware
  const { transactionId, category, taxCategory, isBusinessExpense, notes } = body;
  const clientIp = getClientIp(req as NextApiRequest) || 'unknown';

  // Use centralized ownership validation if available
  if (req) {
    const transaction = await validateResourceOwnership(
      req,
      res,
      transactionId,
      prisma.transaction,
    );

    if (!transaction) {
      logger.warn('Unauthorized transaction update attempt', {
        userId,
        attemptedTransactionId: transactionId,
        requestId,
      });

      await prisma.auditLog.create({
        data: {
          event: 'UNAUTHORIZED_ACCESS' as AuthEvent,
          userId,
          ipAddress: clientIp,
          userAgent: (req as any).headers?.['user-agent'] || '',
          success: false,
          metadata: {
            resource: 'transaction',
            attemptedId: transactionId,
            action: 'update',
          },
        },
      });

      return; // Response already sent by validateResourceOwnership
    }
  } else {
    // Fallback: Verify transaction belongs to user
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (!transaction) {
      logger.warn('Transaction not found for update', {
        userId,
        transactionId,
        requestId,
      });

      throw new NotFoundError('Transaction not found');
    }
  }

  // Build update data
  const updateData: any = {
    ...(category !== undefined && { category }),
    ...(taxCategory !== undefined && { taxCategory }),
    ...(isBusinessExpense !== undefined && { isBusinessExpense }),
    ...(notes !== undefined && { notes }),
    updatedAt: new Date(),
  };

  // Update transaction
  const updatedTransaction = await prisma.transaction.update({
    where: {
      id: transactionId,
      userId, // Double-check user ownership
    },
    data: updateData,
  });

  // Log successful update
  await prisma.auditLog.create({
    data: {
      event: 'TRANSACTION_UPDATE' as AuthEvent,
      userId,
      ipAddress: clientIp,
      userAgent: (req as any).headers?.['user-agent'] || '',
      success: true,
      metadata: {
        transactionId,
        updatedFields: Object.keys(updateData).filter((k) => k !== 'updatedAt'),
      },
    },
  });

  logger.info('Transaction updated', {
    userId,
    transactionId,
    updatedFields: Object.keys(updateData),
    requestId,
  });

  return apiResponse.success(res, 
    successResponse({
      id: updatedTransaction.id,
      category: updatedTransaction.category,
      taxCategory: updatedTransaction.taxCategory,
      isBusinessExpense: updatedTransaction.isBusinessExpense,
      notes: updatedTransaction.notes,
      updatedAt: updatedTransaction.updatedAt,
    }),
  );
}

/**
 * Calculate GST amount (10% for Australia)
 */
function calculateGST(amount: number): number {
  // GST is 1/11th of the GST-inclusive amount
  return Math.round((amount / 11) * 100) / 100;
}

// Export with validation, authentication, rate limiting and error handling middleware
export default composeMiddleware(
  validateMethod(['GET', 'POST']),
  withValidation({
    query: transactionSchemas.list.query,
    body: transactionSchemas.update.body,
    response: (req: NextApiRequest) => {
      if (req.method === 'GET') {
        return transactionSchemas.list.response;
      }
      return transactionSchemas.update.response;
    },
  }),
  authMiddleware.authenticated,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute (higher for transaction syncing)
  }),
)(withErrorHandler(transactionsHandler));
