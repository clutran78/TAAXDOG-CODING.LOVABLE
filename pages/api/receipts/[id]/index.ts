import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';
import { authMiddleware, AuthenticatedRequest } from '../../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../../lib/security/sanitizer';
import { getClientIp } from 'request-ip';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

// Validation schema for PATCH requests
const ReceiptUpdateSchema = z.object({
  merchant: z.string().min(1).max(200).optional(),
  totalAmount: z.number().positive().optional(),
  gstAmount: z.number().min(0).optional(),
  date: z.string().datetime().optional(),
  processingStatus: z.enum(['PENDING', 'PROCESSING', 'PROCESSED', 'MATCHED', 'ERROR']).optional(),
  matchedTransactionId: z.string().uuid().nullable().optional(),
  extractedData: z.record(z.any()).optional(),
});

/**
 * Receipt Details API endpoint
 * Handles GET (retrieve), PATCH (update), DELETE operations
 * Ensures users can only access their own receipts
 */
async function receiptHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const userId = req.userId;
  const receiptId = req.query.id as string;
  const clientIp = getClientIp(req) || 'unknown';

  try {
    // Validate receipt ID
    if (!receiptId || typeof receiptId !== 'string') {
      return apiResponse.error(res, {
        error: 'Invalid request',
        message: 'Receipt ID is required',
      });
    }

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, userId, receiptId);
      case 'PATCH':
        return handlePatch(req, res, userId, receiptId);
      case 'DELETE':
        return handleDelete(req, res, userId, receiptId);
      default:
        res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
        return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
    }
  } catch (error) {
    logger.error('Receipt API error:', error);
    return apiResponse.internalError(res, {
      error: 'Internal server error',
      message: 'An error occurred while processing your request',
    });
  }
}

async function handleGet(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  userId: string,
  receiptId: string,
) {
  try {
    // Fetch receipt with full details and ownership check
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: receiptId,
        userId, // Ensure user owns this receipt
        deletedAt: null,
      },
      include: {
        transaction: {
          select: {
            id: true,
            amount: true,
            description: true,
            date: true,
            category: true,
            userId: true, // For verification
          },
        },
        _count: {
          select: {
            receiptItems: true,
          },
        },
      },
    });

    if (!receipt) {
      return apiResponse.notFound(res, {
        error: 'Receipt not found',
        message: 'The requested receipt does not exist or you do not have access to it',
      });
    }

    // Double-check transaction ownership if linked
    if (receipt.transaction && receipt.transaction.userId !== userId) {
      console.error('Receipt linked to transaction owned by different user', {
        receiptId,
        userId,
        transactionUserId: receipt.transaction.userId,
      });
      receipt.transaction = null; // Remove transaction data
    }

    // Log access
    await prisma.auditLog
      .create({
        data: {
          event: 'RECEIPT_VIEW',
          userId,
          ipAddress: getClientIp(req) || 'unknown',
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            receiptId,
            merchant: receipt.merchant,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    // Remove sensitive fields
    const { userId: _, transaction, ...safeReceipt } = receipt;
    const safeTransaction = transaction
      ? {
          id: transaction.id,
          amount: transaction.amount,
          description: transaction.description,
          date: transaction.date,
          category: transaction.category,
        }
      : null;

    return apiResponse.success(res, {
      success: true,
      data: {
        ...safeReceipt,
        transaction: safeTransaction,
        itemCount: receipt._count.receiptItems,
      },
      _security: {
        dataScope: 'user-only',
        userId: userId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Get receipt error:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to fetch receipt',
      message: 'Unable to retrieve receipt details. Please try again.',
    });
  }
}

async function handlePatch(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  userId: string,
  receiptId: string,
) {
  try {
    // Validate input
    const validationResult = ReceiptUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return apiResponse.error(res, {
        error: 'Validation error',
        message: 'Invalid update data',
        errors: validationResult.error.flatten(),
      });
    }

    const updateData = validationResult.data;

    // Check if receipt exists and user owns it
    const existingReceipt = await prisma.receipt.findFirst({
      where: {
        id: receiptId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        processingStatus: true,
        matchedTransactionId: true,
      },
    });

    if (!existingReceipt) {
      return apiResponse.notFound(res, {
        error: 'Receipt not found',
        message: 'The receipt does not exist or you do not have access to it',
      });
    }

    // If updating matched transaction, verify ownership
    if (updateData.matchedTransactionId) {
      const transaction = await prisma.transaction.findFirst({
        where: {
          id: updateData.matchedTransactionId,
          userId,
          deletedAt: null,
        },
      });

      if (!transaction) {
        return apiResponse.error(res, {
          error: 'Invalid transaction',
          message: 'The specified transaction does not exist or you do not have access to it',
        });
      }
    }

    // Update receipt
    const updatedReceipt = await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        ...updateData,
        date: updateData.date ? new Date(updateData.date) : undefined,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        merchant: true,
        totalAmount: true,
        gstAmount: true,
        date: true,
        processingStatus: true,
        matchedTransactionId: true,
        extractedData: true,
        updatedAt: true,
      },
    });

    // Update linked transaction if needed
    if (
      updateData.matchedTransactionId &&
      updateData.matchedTransactionId !== existingReceipt.matchedTransactionId
    ) {
      // Remove from old transaction
      if (existingReceipt.matchedTransactionId) {
        await prisma.transaction
          .update({
            where: { id: existingReceipt.matchedTransactionId },
            data: { receiptId: null, hasReceipt: false },
          })
          .catch(() => {}); // Ignore if transaction doesn't exist
      }

      // Link to new transaction
      await prisma.transaction.update({
        where: { id: updateData.matchedTransactionId },
        data: { receiptId: receiptId, hasReceipt: true },
      });
    }

    // Log update
    await prisma.auditLog
      .create({
        data: {
          event: 'RECEIPT_UPDATE',
          userId,
          ipAddress: getClientIp(req) || 'unknown',
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            receiptId,
            changes: updateData,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    return apiResponse.success(res, {
      success: true,
      data: updatedReceipt,
      message: 'Receipt updated successfully',
    });
  } catch (error) {
    logger.error('Update receipt error:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to update receipt',
      message: 'Unable to update receipt. Please try again.',
    });
  }
}

async function handleDelete(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  userId: string,
  receiptId: string,
) {
  try {
    // Check if receipt exists and user owns it
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: receiptId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        merchant: true,
        matchedTransactionId: true,
      },
    });

    if (!receipt) {
      return apiResponse.notFound(res, {
        error: 'Receipt not found',
        message: 'The receipt does not exist or you do not have access to it',
      });
    }

    // Soft delete receipt
    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        deletedAt: new Date(),
        matchedTransactionId: null, // Unlink from transaction
      },
    });

    // Update linked transaction if any
    if (receipt.matchedTransactionId) {
      await prisma.transaction
        .update({
          where: {
            id: receipt.matchedTransactionId,
            userId, // Extra safety check
          },
          data: {
            receiptId: null,
            hasReceipt: false,
          },
        })
        .catch(() => {}); // Ignore if transaction doesn't exist
    }

    // Log deletion
    await prisma.auditLog
      .create({
        data: {
          event: 'RECEIPT_DELETE',
          userId,
          ipAddress: getClientIp(req) || 'unknown',
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            receiptId,
            merchant: receipt.merchant,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    return apiResponse.success(res, {
      success: true,
      message: 'Receipt deleted successfully',
    });
  } catch (error) {
    logger.error('Delete receipt error:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to delete receipt',
      message: 'Unable to delete receipt. Please try again.',
    });
  }
}

// Export with authentication and rate limiting middleware
export default withSessionRateLimit(authMiddleware.authenticated(receiptHandler), {
  window: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
});
