import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { logger } from '@/lib/logger';
import {
  authMiddleware,
  AuthenticatedRequest,
  buildUserScopedFilters,
} from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { getClientIp } from 'request-ip';
import { z } from 'zod';
import {
  sendSuccess,
  sendUnauthorized,
  sendValidationError,
  sendMethodNotAllowed,
  sendInternalError,
  sendPaginatedSuccess,
  ERROR_CODES,
} from '@/lib/api/response';

// Query validation schema
const ReceiptQuerySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'PROCESSED', 'MATCHED', 'ERROR']).optional(),
  startDate: z.string().datetime({ message: 'Invalid start date format' }).optional(),
  endDate: z.string().datetime({ message: 'Invalid end date format' }).optional(),
  page: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, 'Page must be a positive number')
    .optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, 'Limit must be between 1 and 100')
    .optional(),
});

/**
 * Receipts API endpoint
 * Handles GET (list) operations
 * Uses authentication middleware to ensure data isolation
 */
async function receiptsHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  try {
    const userId = req.userId;
    const clientIp = getClientIp(req) || 'unknown';

    // Validate userId exists
    if (!userId) {
      return apiResponse.unauthorized(res, 'User ID not found in authenticated request');
    }

    // Log receipt access for audit
    await prisma.auditLog
      .create({
        data: {
          event: 'RECEIPT_ACCESS',
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            method: req.method,
            endpoint: '/api/receipts',
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err););

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, userId);
      default:
        return apiResponse.methodNotAllowed(res, ['GET']);
    }
  } catch (error) {
    logger.error('Receipts API error:', error);
    return apiResponse.internalError(res, error, {
      message: 'An error occurred while processing your request',
    });
  }
}

async function handleGet(req: AuthenticatedRequest, res: NextApiResponse, userId: string) {
  try {
    // Validate query parameters
    const validationResult = ReceiptQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return apiResponse.validationError(res, errors, {
        message: 'Invalid query parameters',
      });
    }

    const { status, startDate, endDate, page = 1, limit = 20 } = validationResult.data;

    // Build query filters with user scoping
    const baseFilters: any = {};
    if (status) {
      baseFilters.processingStatus = status;
    }

    if (startDate || endDate) {
      baseFilters.date = {};
      if (startDate) baseFilters.date.gte = new Date(startDate);
      if (endDate) baseFilters.date.lte = new Date(endDate);
    }

    const where = buildUserScopedFilters(req, baseFilters);

    // Additional security: ensure receipts belong to user
    const secureWhere = {
      ...where,
      userId: userId,
      deletedAt: null, // Exclude soft-deleted receipts
    };

    const skip = (page - 1) * limit;

    const [receipts, total] = await Promise.all([
      prisma.receipt
        .findMany({
          where: secureWhere,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            merchant: true,
            totalAmount: true,
            gstAmount: true,
            date: true,
            processingStatus: true,
            extractedData: true,
            matchedTransactionId: true,
            fileUrl: true,
            createdAt: true,
            updatedAt: true,
            userId: true, // Include for verification
          },
        })
        .then((receipts) =>
          // Double-check: ensure all receipts belong to user
          receipts.filter((r) => r.userId === userId).map(({ userId: _, ...r }) => r),
        ),
      prisma.receipt.count({ where: secureWhere }),
    ]);

    // Calculate summary statistics with user isolation
    const stats = await prisma.receipt.aggregate({
      where: {
        ...secureWhere,
        processingStatus: { in: ['PROCESSED', 'MATCHED'] },
      },
      _sum: {
        totalAmount: true,
        gstAmount: true,
      },
      _count: true,
    });

    // Set security headers
    res.setHeader('Cache-Control', 'private, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return sendPaginatedSuccess(
      res,
      receipts,
      {
        page,
        limit,
        total,
      },
      {
        additionalData: {
          stats: {
            totalAmount: stats._sum.totalAmount || 0,
            totalGst: stats._sum.gstAmount || 0,
            processedCount: stats._count,
          },
        },
        meta: {
          version: '1.0',
          requestId: (req as any).requestId,
        },
      },
    );
  } catch (error) {
    logger.error('Get receipts error:', error, { userId });
    return apiResponse.internalError(res, error, {
      message: 'Unable to retrieve your receipts. Please try again.',
    });
  }
}

// Export with authentication and rate limiting middleware
export default withSessionRateLimit(authMiddleware.authenticated(receiptsHandler), {
  window: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (higher for receipt processing)
});
