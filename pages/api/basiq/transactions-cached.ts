import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { authMiddleware, AuthenticatedRequest } from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { ApiCache } from '../../../lib/services/cache/apiCache';
import { logger } from '../../../lib/utils/logger';
import { getClientIp } from 'request-ip';
import { apiResponse } from '@/lib/api/response';

/**
 * BASIQ transactions API endpoint with caching
 * Example of how to add caching to expensive database queries
 */
async function transactionsHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const userId = req.userId!;
  const clientIp = getClientIp(req) || 'unknown';

  logger.info('Transaction API request', {
    userId,
    method: req.method,
    clientIp,
    requestId,
  });

  try {
    switch (req.method) {
      case 'GET':
        return handleGetTransactions(userId, req.query, res, requestId);

      case 'POST':
        // Sync new transactions - invalidate cache after
        const result = await handleSyncTransactions(userId, req.body, res, requestId);

        // Invalidate transaction caches after sync
        await ApiCache.invalidateOnChange(userId, 'transaction');

        return result;

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return apiResponse.methodNotAllowed(res, {
          error: 'Method not allowed',
          message: `Method ${req.method} is not allowed`,
        });
    }
  } catch (error) {
    logger.error('Transaction API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      method: req.method,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Internal server error',
      message: 'An error occurred while processing your request',
      requestId,
    });
  }
}

/**
 * Get transactions with caching
 */
async function handleGetTransactions(
  userId: string,
  query: any,
  res: NextApiResponse,
  requestId?: string,
) {
  try {
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
      refresh = 'false',
    } = query;

    // Use ApiCache for efficient caching
    const result = await ApiCache.cacheTransactions(
      userId,
      query,
      async () => {
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
            throw new Error('Bank account not found');
          }
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Execute queries in parallel
        const [total, transactions] = await Promise.all([
          prisma.transaction.count({ where }),
          prisma.transaction.findMany({
            where,
            orderBy: { [sortBy]: sortOrder },
            skip,
            take: limit,
            select: {
              id: true,
              amount: true,
              description: true,
              date: true,
              category: true,
              subcategory: true,
              type: true,
              isBusinessExpense: true,
              taxCategory: true,
              merchant: true,
              notes: true,
              bankAccountId: true,
              receiptId: true,
              createdAt: true,
              updatedAt: true,
              // Include bank account info (filtered by user)
              bankAccount: {
                select: {
                  id: true,
                  accountName: true,
                  accountType: true,
                  institution: true,
                },
              },
              // Include receipt info if exists
              receipt: {
                select: {
                  id: true,
                  fileName: true,
                  uploadedAt: true,
                  status: true,
                },
              },
            },
          }),
        ]);

        // Calculate summary statistics
        const summaryStats = await prisma.transaction.aggregate({
          where: {
            ...where,
            type: 'EXPENSE',
          },
          _sum: {
            amount: true,
          },
          _avg: {
            amount: true,
          },
          _count: {
            id: true,
          },
        });

        // Calculate tax deductible amount
        const taxDeductible = await prisma.transaction.aggregate({
          where: {
            ...where,
            isBusinessExpense: true,
            type: 'EXPENSE',
          },
          _sum: {
            amount: true,
          },
        });

        return {
          transactions,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
          },
          summary: {
            totalExpenses: summaryStats._sum.amount || 0,
            averageExpense: summaryStats._avg.amount || 0,
            transactionCount: summaryStats._count.id,
            taxDeductibleAmount: taxDeductible._sum.amount || 0,
            gstClaimable: (taxDeductible._sum.amount || 0) / 11, // GST is 1/11th
          },
        };
      },
      { res },
    );

    // Set additional headers
    res.setHeader('X-Total-Count', result.pagination.total.toString());
    res.setHeader('X-Page-Count', result.pagination.totalPages.toString());

    return apiResponse.success(res, {
      success: true,
      data: result.transactions,
      pagination: result.pagination,
      summary: result.summary,
      _metadata: {
        cached: refresh !== 'true',
        requestId,
      },
    });
  } catch (error) {
    logger.error('Error fetching transactions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Failed to fetch transactions',
      message: 'Unable to retrieve your transactions. Please try again.',
      requestId,
    });
  }
}

/**
 * Sync new transactions from BASIQ
 */
async function handleSyncTransactions(
  userId: string,
  body: any,
  res: NextApiResponse,
  requestId?: string,
) {
  // Implementation for syncing transactions
  // This would call BASIQ API and update the database
  // After updating, caches are invalidated in the main handler

  return apiResponse.success(res, {
    success: true,
    message: 'Transaction sync initiated',
    requestId,
  });
}

// Export with authentication and rate limiting
export default withSessionRateLimit(authMiddleware.authenticated(transactionsHandler), {
  window: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
});
