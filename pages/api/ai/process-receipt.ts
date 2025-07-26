import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { authMiddleware, AuthenticatedRequest } from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { getClientIp } from 'request-ip';
import { z } from 'zod';
import { AIService } from '../../../lib/ai/service';
import formidable from 'formidable';
import fs from 'fs/promises';
import crypto from 'crypto';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import { receiptSchemas } from '../../../lib/validation/api-schemas';
import { logger } from '../../../lib/utils/logger';
import { AuthEvent } from '@prisma/client';
import { getCacheManager, CacheTTL } from '../../../lib/services/cache/cacheManager';
import { apiResponse } from '@/lib/api/response';

export const config = {
  api: {
    bodyParser: false, // Disable body parser for file uploads
  },
};

// Additional validation for form fields
const FormFieldsSchema = z.object({
  additionalContext: z.string().max(1000).optional(),
  businessId: z.string().uuid().optional(),
  categoryHint: z.string().optional(),
  matchTransactionId: z.string().uuid().optional(),
});

// Allowed file types and size limits
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Receipt Processing API endpoint with comprehensive validation
 * Handles POST operations for uploading and processing receipts
 * Uses authentication middleware to ensure data isolation
 */
async function processReceiptHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const userId = req.userId!;
  const clientIp = getClientIp(req) || 'unknown';
  const startTime = Date.now();

  let tempFilePath: string | null = null;

  logger.info('Receipt processing started', {
    userId,
    clientIp,
    requestId,
  });

  try {
    // Parse multipart form data
    const { files, fields } = await parseFormData(req);

    // Get the uploaded file
    const file = Array.isArray(files.receipt) ? files.receipt[0] : files.receipt;
    if (!file) {
      return apiResponse.error(res, {
        error: 'No file uploaded',
        message: 'Please upload a receipt image or PDF',
      });
    }

    tempFilePath = file.filepath;

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype || '')) {
      return apiResponse.error(res, {
        error: 'Invalid file type',
        message: `File type ${file.mimetype} is not supported. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return apiResponse.error(res, {
        error: 'File too large',
        message: `File size ${Math.round(file.size / 1024 / 1024)}MB exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      });
    }

    // Validate additional fields
    const validationResult = FormFieldsSchema.safeParse(fields);
    if (!validationResult.success) {
      logger.warn('Invalid form fields', {
        userId,
        errors: validationResult.error.flatten(),
        requestId,
      });

      return apiResponse.error(res, {
        error: 'Validation error',
        message: 'Invalid input data',
        errors: validationResult.error.flatten(),
        requestId,
      });
    }

    const { additionalContext, businessId, categoryHint, matchTransactionId } =
      validationResult.data;

    // Read file as base64
    const fileBuffer = await fs.readFile(file.filepath);
    const imageData = fileBuffer.toString('base64');

    // Generate file hash for duplicate detection
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const cacheManager = await getCacheManager();

    // Check for duplicate uploads using cache first
    const duplicateCacheKey = `receipt:duplicate:${userId}:${fileHash}`;
    const cachedDuplicate = await cacheManager.remember(
      duplicateCacheKey,
      CacheTTL.WEEK, // Cache for 7 days
      async () => {
        // Check for duplicate uploads by the same user
        const existing = await prisma.receipt.findFirst({
          where: {
            userId,
            fileHash,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Within last 7 days
            },
            deletedAt: null,
          },
          select: {
            id: true,
            createdAt: true,
          },
        });
        return existing;
      },
    );

    if (cachedDuplicate) {
      logger.warn('Duplicate receipt upload attempt', {
        userId,
        existingReceiptId: cachedDuplicate.id,
        fileHash,
        requestId,
      });

      return res.status(409).json({
        error: 'Duplicate receipt',
        message: 'This receipt has already been uploaded',
        existingReceiptId: cachedDuplicate.id,
        uploadedAt: cachedDuplicate.createdAt,
        requestId,
      });
    }

    // Log receipt processing attempt
    await prisma.auditLog.create({
      data: {
        event: 'RECEIPT_PROCESS' as AuthEvent,
        userId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: {
          fileSize: file.size,
          mimeType: file.mimetype,
          hasBusinessId: !!businessId,
          hasContext: !!additionalContext,
        },
      },
    });

    // Process receipt with AI
    let extractedData: any = null;
    let confidence = 0;
    let aiError: string | null = null;

    try {
      const aiResponse = await AIService.processWithFallback({
        operation: 'RECEIPT_SCANNING',
        prompt: `Extract receipt information including merchant, amount, date, items, and GST details.${additionalContext ? ` Additional context: ${additionalContext}` : ''}${categoryHint ? ` Category hint: ${categoryHint}` : ''}`,
        data: {
          image: imageData,
          mimeType: file.mimetype,
        },
        userId,
      });

      if (aiResponse.success && aiResponse.data) {
        extractedData = aiResponse.data;
        confidence = aiResponse.confidence || 0.8;
      } else {
        throw new Error('AI processing returned no data');
      }
    } catch (error) {
      // AI processing failed, but we'll still save the receipt for manual review
      aiError = error instanceof Error ? error.message : 'AI processing failed';
      logger.error('AI receipt processing error', {
        error: aiError,
        userId,
        requestId,
      });
    }

    // Prepare receipt data
    const receiptData = extractedData || {
      merchant: 'Pending Manual Review',
      amount: 0,
      date: new Date().toISOString(),
      category: 'Unknown',
    };

    // Store the file (in production, this would upload to cloud storage)
    const fileUrl = await storeReceiptFile(fileBuffer, file.mimetype || 'image/jpeg', userId);

    // Save receipt to database with user isolation
    const receipt = await prisma.receipt.create({
      data: {
        userId,
        fileName: file.originalFilename || 'receipt',
        fileUrl,
        fileSize: file.size,
        fileHash,
        status: aiError ? 'FAILED' : 'PROCESSED',
        extractedData: receiptData,
        confidence: confidence,
        error: aiError,
      },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        status: true,
        extractedData: true,
        confidence: true,
        error: true,
        createdAt: true,
      },
    });

    // If a transaction ID was provided, update the transaction
    if (matchTransactionId && !aiError) {
      try {
        await prisma.transaction.update({
          where: {
            id: matchTransactionId,
            userId, // Ensure user owns the transaction
          },
          data: {
            receiptId: receipt.id,
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        logger.error('Failed to link receipt to transaction', {
          error: err instanceof Error ? err.message : 'Unknown error',
          receiptId: receipt.id,
          transactionId: matchTransactionId,
          requestId,
        });
      }
    }

    // Log successful processing
    logger.info('Receipt processed successfully', {
      userId,
      receiptId: receipt.id,
      processingTimeMs: Date.now() - startTime,
      aiSuccess: !aiError,
      requestId,
    });

    // Clean up temp file
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => {});
    }

    return apiResponse.created(res, {
      success: true,
      data: receipt,
    });
  } catch (error) {
    logger.error('Receipt processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      requestId,
    });

    // Clean up temp file on error
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => {});
    }

    return apiResponse.internalError(res, {
      error: 'Receipt processing failed',
      message: 'Unable to process your receipt. Please try again.',
      requestId,
    });
  }
}

// Parse multipart form data
async function parseFormData(req: NextApiRequest): Promise<{
  files: formidable.Files;
  fields: formidable.Fields;
}> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: MAX_FILE_SIZE,
      maxFields: 10,
      maxFieldsSize: 2 * 1024 * 1024, // 2MB for fields
      filter: ({ mimetype }) => {
        return mimetype ? ALLOWED_MIME_TYPES.includes(mimetype) : false;
      },
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
      } else {
        // Convert fields to plain object
        const plainFields: Record<string, any> = {};
        for (const [key, value] of Object.entries(fields)) {
          plainFields[key] = Array.isArray(value) ? value[0] : value;
        }
        resolve({ files, fields: plainFields });
      }
    });
  });
}

// Store receipt file (in production, this would upload to S3/cloud storage)
async function storeReceiptFile(
  fileBuffer: Buffer,
  mimeType: string,
  userId: string,
): Promise<string> {
  // In production, upload to S3 or cloud storage
  // For now, return a placeholder URL
  const timestamp = Date.now();
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex').substring(0, 8);
  return `/receipts/${userId}/${timestamp}-${hash}.${mimeType.split('/')[1]}`;
}

// Export with validation, authentication and rate limiting middleware
export default composeMiddleware(
  validateMethod(['POST']),
  withValidation({
    // File validation happens in the handler due to multipart form
    response: receiptSchemas.process.response,
  }),
  authMiddleware.authenticated,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 20, // 20 receipts per minute (to prevent abuse)
  }),
)(processReceiptHandler);
