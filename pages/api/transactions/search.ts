import { NextApiRequest, NextApiResponse } from 'next';
import { authMiddleware, AuthenticatedRequest } from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
// import { searchTransactions, batchUpdateTransactions } from '../../../lib/db/optimized-queries'; // TODO: Implement optimized queries
import { logger } from '../../../lib/utils/logger';
import { z } from 'zod';
import { apiResponse } from '@/lib/api/response';

// Search query schema
const searchQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});

// Batch update schema
const batchUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().uuid(),
        category: z.string().optional(),
        taxCategory: z.string().optional(),
        isBusinessExpense: z.boolean().optional(),
        notes: z.string().max(1000).optional(),
      }),
    )
    .min(1)
    .max(100),
});

/**
 * Optimized transaction search and batch update endpoint
 * Provides fast search with pagination and batch operations
 */
async function transactionSearchHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const userId = req.userId!;

  try {
    // Validate userId exists
    if (!userId) {
      logger.error('Missing userId in authenticated request', { requestId });
      return apiResponse.unauthorized(res, {
        error: 'Authentication Error',
        message: 'User ID not found in authenticated request',
        requestId,
      });
    }

    switch (req.method) {
      case 'GET':
        return handleSearch(req, res, userId, requestId);

      case 'POST':
        return handleBatchUpdate(req, res, userId, requestId);

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return apiResponse.methodNotAllowed(res, {
          error: 'Method not allowed',
          message: `Method ${req.method} is not allowed`,
          requestId,
        });
    }
  } catch (error) {
    logger.error('Transaction search error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
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
 * Handle transaction search
 */
async function handleSearch(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  userId: string,
  requestId: string,
) {
  // Query is already validated by middleware
  const query = req.query as z.infer<typeof searchQuerySchema>;

  logger.info('Transaction search', {
    userId,
    query,
    requestId,
  });

  try {
    const startTime = Date.now();

    // Convert date strings to Date objects
    const searchOptions = {
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    // Execute optimized search
    const results = await searchTransactions(userId, searchOptions);
    const queryTime = Date.now() - startTime;

    // Log performance
    logger.info('Transaction search completed', {
      userId,
      resultCount: results.transactions.length,
      totalResults: results.pagination.total,
      queryTime,
      requestId,
    });

    return apiResponse.success(res, {
      success: true,
      data: results,
      _meta: {
        queryTime,
        requestId,
      },
    });
  } catch (error) {
    logger.error('Search query error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Search failed',
      message: 'Unable to search transactions. Please try again.',
      requestId,
    });
  }
}

/**
 * Handle batch transaction updates
 */
async function handleBatchUpdate(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  userId: string,
  requestId: string,
) {
  // Body is already validated by middleware
  const { updates } = req.body as z.infer<typeof batchUpdateSchema>;

  logger.info('Batch transaction update', {
    userId,
    updateCount: updates.length,
    requestId,
  });

  try {
    const startTime = Date.now();

    // Execute batch update
    const results = await batchUpdateTransactions(userId, updates);
    const queryTime = Date.now() - startTime;

    // Log results
    logger.info('Batch update completed', {
      userId,
      updated: results.updated,
      errors: results.errors.length,
      queryTime,
      requestId,
    });

    return apiResponse.success(res, {
      success: true,
      data: results,
      _meta: {
        queryTime,
        requestId,
      },
    });
  } catch (error) {
    logger.error('Batch update error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Batch update failed',
      message: 'Unable to update transactions. Please try again.',
      requestId,
    });
  }
}

// Export with validation, authentication and rate limiting middleware
export default composeMiddleware(
  validateMethod(['GET', 'POST']),
  withValidation({
    query: (req: NextApiRequest) => {
      if (req.method === 'GET') {
        return searchQuerySchema;
      }
      return undefined;
    },
    body: (req: NextApiRequest) => {
      if (req.method === 'POST') {
        return batchUpdateSchema;
      }
      return undefined;
    },
  }),
  authMiddleware.authenticated,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
  }),
)(transactionSearchHandler);
