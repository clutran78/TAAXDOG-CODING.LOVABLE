import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';
import { authMiddleware, AuthenticatedRequest } from '../../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../../lib/security/sanitizer';
import { getClientIp } from 'request-ip';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

/**
 * Receipt Image Retrieval API endpoint
 * Handles GET operations for downloading receipt images
 * Ensures users can only access their own receipt images
 */
async function receiptImageHandler(req: AuthenticatedRequest, res: NextApiResponse) {
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

    // Fetch receipt with user ownership check
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: receiptId,
        userId, // Ensure user owns this receipt
        deletedAt: null,
      },
      select: {
        id: true,
        fileUrl: true,
        mimeType: true,
        merchant: true,
        date: true,
        userId: true,
      },
    });

    if (!receipt) {
      return apiResponse.notFound(res, {
        error: 'Receipt not found',
        message: 'The requested receipt does not exist or you do not have access to it',
      });
    }

    // Double-check ownership
    if (receipt.userId !== userId) {
      // Log unauthorized access attempt
      await prisma.auditLog
        .create({
          data: {
            event: 'RECEIPT_IMAGE_UNAUTHORIZED_ACCESS',
            userId,
            ipAddress: clientIp,
            userAgent: req.headers['user-agent'] || '',
            success: false,
            metadata: {
              attemptedReceiptId: receiptId,
              actualOwnerId: receipt.userId,
              timestamp: new Date().toISOString(),
            },
          },
        })
        .catch((err) => logger.error('Audit log error:', err));

      return apiResponse.forbidden(res, {
        error: 'Forbidden',
        message: 'You do not have permission to access this receipt',
      });
    }

    // Log successful access
    await prisma.auditLog
      .create({
        data: {
          event: 'RECEIPT_IMAGE_ACCESS',
          userId,
          ipAddress: clientIp,
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

    // In production, this would redirect to S3/CDN URL or stream from cloud storage
    // For now, return a placeholder response
    if (!receipt.fileUrl) {
      return apiResponse.notFound(res, {
        error: 'Image not found',
        message: 'No image file associated with this receipt',
      });
    }

    // Set appropriate headers for image serving
    res.setHeader('Content-Type', receipt.mimeType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
    res.setHeader(
      'Content-Disposition',
      `inline; filename="receipt-${receipt.date.toISOString().split('T')[0]}-${receipt.merchant.replace(/[^a-zA-Z0-9]/g, '-')}.${receipt.mimeType?.split('/')[1] || 'jpg'}"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY'); // Prevent embedding in iframes

    // In production, you would:
    // 1. Generate a signed URL for S3/cloud storage
    // 2. Redirect to that URL or proxy the stream
    // 3. Apply watermarks or other security measures if needed

    // For now, return a JSON response indicating where the image would be
    return apiResponse.success(res, {
      success: true,
      data: {
        receiptId: receipt.id,
        imageUrl: receipt.fileUrl,
        mimeType: receipt.mimeType,
        message: 'In production, this would serve or redirect to the actual image file',
      },
      _security: {
        dataScope: 'user-only',
        userId: userId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Receipt image retrieval error:', error);

    // Log error
    await prisma.auditLog
      .create({
        data: {
          event: 'RECEIPT_IMAGE_ERROR',
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            receiptId,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    return apiResponse.internalError(res, {
      error: 'Image retrieval failed',
      message: 'Unable to retrieve the receipt image. Please try again.',
    });
  }
}

// Export with authentication and rate limiting middleware
export default withSessionRateLimit(authMiddleware.authenticated(receiptImageHandler), {
  window: 60 * 1000, // 1 minute
  max: 100, // 100 image requests per minute
});
