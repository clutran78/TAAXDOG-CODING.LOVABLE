import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { z } from 'zod';
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import prisma from '../../../lib/prisma';
import { logger } from '@/lib/logger';
import {
  authMiddleware,
  AuthenticatedRequest,
  buildUserScopedFilters,
  validateResourceOwnership,
} from '../../../lib/middleware/auth';
import { withSessionRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/security/rateLimiter';
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
import { aiService, AIOperationType } from '../../../lib/ai/service';
import { withCSRFProtection } from '../../../lib/auth/csrf-protection';
import { sessionManager } from '../../../lib/auth/session-manager';
import { AuthEvent, TransactionType } from '@prisma/client';
import { uploadToCloudStorage, deleteFromCloudStorage } from '../../../lib/services/storage/cloudStorage';
import sharp from 'sharp';

// Australian tax categories for receipts
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

// File size and type limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

// Receipt processing status
enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW',
}

// Validation schemas
const processReceiptSchema = z.object({
  transactionId: z.string().uuid().optional(),
  bankAccountId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  category: z.string().optional(),
  taxCategory: z.enum(Object.keys(TAX_CATEGORIES) as [string, ...string[]]).optional(),
  isBusinessExpense: z.boolean().optional(),
});

// Extracted receipt data interface
interface ExtractedReceiptData {
  merchantName?: string;
  merchantABN?: string;
  date?: Date;
  totalAmount?: number;
  gstAmount?: number;
  items?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice: number;
  }>;
  paymentMethod?: string;
  receiptNumber?: string;
  address?: string;
  confidence: number;
}

// Receipt validation result
interface ReceiptValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Receipt processing API endpoint
 * Handles file upload, OCR processing, data extraction, and validation
 */
async function receiptHandler(req: AuthenticatedRequest, res: NextApiResponse) {
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

  logger.info('Receipt processing API access', {
    userId,
    userEmail,
    method: req.method,
    clientIp,
    requestId,
    sessionId,
  });

  try {
    switch (req.method) {
      case 'POST':
        return await handleProcessReceipt(userId, req, res, requestId);

      case 'GET':
        return await handleGetReceiptStatus(userId, req.query, res, requestId);

      default:
        res.setHeader('Allow', ['POST', 'GET']);
        throw new ValidationError(`Method ${req.method} is not allowed`);
    }
  } catch (error) {
    logger.error('Receipt processing API error', {
      error,
      userId,
      method: req.method,
      requestId,
    });

    // Log error for monitoring
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.AI_ERROR,
        userId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: false,
        metadata: {
          service: 'receipt-processing',
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId,
        },
      },
    }).catch(err => logger.error('Audit log error', { err }));

    throw error;
  }
}

/**
 * Handle receipt upload and processing
 */
async function handleProcessReceipt(
  userId: string,
  req: AuthenticatedRequest,
  res: NextApiResponse,
  requestId: string,
) {
  const startTime = Date.now();
  const clientIp = getClientIP(req);

  // Parse multipart form data
  const form = formidable({
    maxFileSize: MAX_FILE_SIZE,
    keepExtensions: true,
    uploadDir: '/tmp',
  });

  let files: formidable.Files;
  let fields: formidable.Fields;

  try {
    [fields, files] = await form.parse(req);
  } catch (error) {
    logger.error('Form parsing error', { error, userId, requestId });
    throw new BadRequestError('Invalid file upload');
  }

  const file = Array.isArray(files.receipt) ? files.receipt[0] : files.receipt;
  if (!file) {
    throw new BadRequestError('No receipt file provided');
  }

  // Validate file type
  const fileExtension = path.extname(file.originalFilename || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    throw new ValidationError(`Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype || '')) {
    throw new ValidationError(`Invalid file format. Allowed formats: JPEG, PNG, PDF`);
  }

  // Parse additional fields
  const metadata = processReceiptSchema.parse({
    transactionId: fields.transactionId?.[0],
    bankAccountId: fields.bankAccountId?.[0],
    description: fields.description?.[0],
    category: fields.category?.[0],
    taxCategory: fields.taxCategory?.[0],
    isBusinessExpense: fields.isBusinessExpense?.[0] === 'true',
  });

  let receiptId: string | undefined;
  let uploadedFileUrl: string | undefined;
  let tempFilePath = file.filepath;

  try {
    // Verify resource ownership if transaction or bank account specified
    if (metadata.transactionId) {
      const transaction = await prisma.transaction.findFirst({
        where: {
          id: metadata.transactionId,
          userId,
          deletedAt: null,
        },
      });

      if (!transaction) {
        logger.warn('Unauthorized transaction access attempt', {
          userId,
          attemptedTransactionId: metadata.transactionId,
          clientIp,
          requestId,
        });

        throw new ValidationError('Transaction not found');
      }
    }

    if (metadata.bankAccountId) {
      const bankAccount = await prisma.bankAccount.findFirst({
        where: {
          id: metadata.bankAccountId,
          userId,
          deletedAt: null,
        },
      });

      if (!bankAccount) {
        logger.warn('Unauthorized bank account access attempt', {
          userId,
          attemptedAccountId: metadata.bankAccountId,
          clientIp,
          requestId,
        });

        throw new ValidationError('Bank account not found');
      }
    }

    // Process image if needed (resize, optimize)
    let processedFilePath = tempFilePath;
    if (file.mimetype?.startsWith('image/')) {
      processedFilePath = `${tempFilePath}_processed.jpg`;
      
      await sharp(tempFilePath)
        .resize(2000, 2000, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toFile(processedFilePath);

      // Update file path
      tempFilePath = processedFilePath;
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const fileName = `receipts/${userId}/${timestamp}-${randomString}${fileExtension}`;

    // Upload to cloud storage
    uploadedFileUrl = await uploadToCloudStorage(tempFilePath, fileName, {
      contentType: file.mimetype || 'application/octet-stream',
      metadata: {
        userId,
        originalName: file.originalFilename || 'receipt',
        uploadedAt: new Date().toISOString(),
      },
    });

    // Create receipt record
    const receipt = await prisma.receipt.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        fileName: file.originalFilename || 'receipt',
        fileUrl: uploadedFileUrl,
        fileSize: file.size,
        mimeType: file.mimetype || 'application/octet-stream',
        status: ProcessingStatus.PENDING,
        transactionId: metadata.transactionId,
        metadata: {
          bankAccountId: metadata.bankAccountId,
          description: metadata.description,
          category: metadata.category,
          taxCategory: metadata.taxCategory,
          isBusinessExpense: metadata.isBusinessExpense,
          requestId,
        },
      },
    });

    receiptId = receipt.id;

    // Start async OCR processing
    setImmediate(async () => {
      try {
        await processReceiptWithOCR(receipt.id, userId, uploadedFileUrl, metadata, requestId);
      } catch (error) {
        logger.error('Receipt OCR processing failed', {
          error,
          receiptId: receipt.id,
          userId,
          requestId,
        });

        // Update receipt status
        await prisma.receipt.update({
          where: { id: receipt.id },
          data: {
            status: ProcessingStatus.FAILED,
            processingError: error instanceof Error ? error.message : 'Processing failed',
            processedAt: new Date(),
          },
        });
      }
    });

    // Log successful upload
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.FILE_UPLOAD,
        userId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: {
          receiptId: receipt.id,
          fileName: file.originalFilename,
          fileSize: file.size,
          transactionId: metadata.transactionId,
          requestId,
        },
      },
    });

    logger.info('Receipt uploaded successfully', {
      userId,
      receiptId: receipt.id,
      fileName: file.originalFilename,
      fileSize: file.size,
      processingTime: Date.now() - startTime,
      requestId,
    });

    return apiResponse.success(res, {
      receiptId: receipt.id,
      status: ProcessingStatus.PENDING,
      message: 'Receipt uploaded successfully. Processing in progress.',
      estimatedProcessingTime: '10-30 seconds',
    });

  } catch (error) {
    // Clean up uploaded file if exists
    if (uploadedFileUrl) {
      await deleteFromCloudStorage(uploadedFileUrl).catch(err =>
        logger.error('Failed to delete uploaded file', { err, uploadedFileUrl })
      );
    }

    throw error;
  } finally {
    // Clean up temp files
    await fs.unlink(tempFilePath).catch(() => {});
    if (tempFilePath !== file.filepath) {
      await fs.unlink(file.filepath).catch(() => {});
    }
  }
}

/**
 * Process receipt with OCR and data extraction
 */
async function processReceiptWithOCR(
  receiptId: string,
  userId: string,
  fileUrl: string,
  metadata: z.infer<typeof processReceiptSchema>,
  requestId: string,
) {
  const startTime = Date.now();

  try {
    // Update status to processing
    await prisma.receipt.update({
      where: { id: receiptId },
      data: { status: ProcessingStatus.PROCESSING },
    });

    // Call AI service for OCR and data extraction
    const extractedData = await aiService.processReceipt({
      receiptUrl: fileUrl,
      extractFields: [
        'merchantName',
        'merchantABN',
        'date',
        'totalAmount',
        'gstAmount',
        'items',
        'paymentMethod',
        'receiptNumber',
        'address',
      ],
      enhanceAccuracy: true,
      australianFormat: true,
    });

    // Validate extracted data
    const validation = validateExtractedData(extractedData);

    // Parse and clean extracted data
    const processedData = processExtractedData(extractedData);

    // Determine if manual review is needed
    const requiresReview = validation.errors.length > 0 || 
                          processedData.confidence < 0.8 ||
                          !processedData.totalAmount ||
                          !processedData.date;

    // Create or update transaction if linked
    let transactionId = metadata.transactionId;
    if (!transactionId && processedData.totalAmount && processedData.date && metadata.bankAccountId) {
      // Try to match with existing transaction
      const matchingTransaction = await findMatchingTransaction(
        userId,
        metadata.bankAccountId,
        processedData.totalAmount,
        processedData.date
      );

      if (matchingTransaction) {
        transactionId = matchingTransaction.id;
      } else if (!requiresReview) {
        // Create new transaction if data is reliable
        const newTransaction = await prisma.transaction.create({
          data: {
            id: crypto.randomUUID(),
            userId,
            bankAccountId: metadata.bankAccountId,
            amount: -Math.abs(processedData.totalAmount), // Negative for expense
            type: TransactionType.DEBIT,
            date: processedData.date,
            description: processedData.merchantName || metadata.description || 'Receipt expense',
            merchantName: processedData.merchantName,
            category: metadata.category || categorizeTransaction(processedData.merchantName),
            taxCategory: metadata.taxCategory,
            isBusinessExpense: metadata.isBusinessExpense ?? true,
            receiptId,
            metadata: {
              source: 'receipt_upload',
              gstAmount: processedData.gstAmount,
              receiptNumber: processedData.receiptNumber,
              items: processedData.items,
            },
          },
        });

        transactionId = newTransaction.id;
      }
    }

    // Update receipt with extracted data
    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        status: requiresReview ? ProcessingStatus.REQUIRES_REVIEW : ProcessingStatus.COMPLETED,
        transactionId,
        extractedData: processedData as any,
        validationResults: validation as any,
        processedAt: new Date(),
        processingTime: Date.now() - startTime,
        merchantName: processedData.merchantName,
        amount: processedData.totalAmount,
        date: processedData.date,
        confidence: processedData.confidence,
      },
    });

    // Update transaction if linked
    if (transactionId && metadata.transactionId) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          merchantName: processedData.merchantName || undefined,
          amount: processedData.totalAmount ? -Math.abs(processedData.totalAmount) : undefined,
          date: processedData.date || undefined,
          metadata: {
            gstAmount: processedData.gstAmount,
            receiptNumber: processedData.receiptNumber,
            items: processedData.items,
          },
        },
      });
    }

    logger.info('Receipt processed successfully', {
      receiptId,
      userId,
      processingTime: Date.now() - startTime,
      requiresReview,
      confidence: processedData.confidence,
      requestId,
    });

    // Send notification if review required
    if (requiresReview) {
      // Implement notification logic here
      logger.info('Receipt requires manual review', {
        receiptId,
        userId,
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

  } catch (error) {
    logger.error('Receipt processing error', {
      error,
      receiptId,
      userId,
      requestId,
    });

    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        status: ProcessingStatus.FAILED,
        processingError: error instanceof Error ? error.message : 'Processing failed',
        processedAt: new Date(),
      },
    });

    throw error;
  }
}

/**
 * Validate extracted receipt data
 */
function validateExtractedData(data: ExtractedReceiptData): ReceiptValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Required fields validation
  if (!data.totalAmount && data.totalAmount !== 0) {
    errors.push('Total amount not found');
  }

  if (!data.date) {
    errors.push('Receipt date not found');
  }

  if (!data.merchantName) {
    warnings.push('Merchant name not detected');
  }

  // ABN validation (Australian Business Number)
  if (data.merchantABN) {
    if (!isValidABN(data.merchantABN)) {
      warnings.push('Invalid ABN format detected');
    }
  } else {
    warnings.push('No ABN found on receipt');
  }

  // GST validation (should be 1/11th of GST-inclusive amount)
  if (data.gstAmount && data.totalAmount) {
    const expectedGST = Math.round((data.totalAmount / 11) * 100) / 100;
    const gstDifference = Math.abs(data.gstAmount - expectedGST);
    
    if (gstDifference > 0.02) { // Allow 2 cents variance
      warnings.push(`GST amount (${data.gstAmount}) doesn't match expected (${expectedGST})`);
    }
  }

  // Date validation
  if (data.date) {
    const receiptDate = new Date(data.date);
    const now = new Date();
    const daysDifference = (now.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24);

    if (receiptDate > now) {
      errors.push('Receipt date is in the future');
    } else if (daysDifference > 365) {
      warnings.push('Receipt is over 1 year old');
    }
  }

  // Confidence check
  if (data.confidence < 0.7) {
    warnings.push('Low confidence in extracted data');
    suggestions.push('Consider uploading a clearer image');
  }

  // Items validation
  if (data.items && data.items.length > 0) {
    const itemsTotal = data.items.reduce((sum, item) => sum + item.totalPrice, 0);
    if (Math.abs(itemsTotal - (data.totalAmount || 0)) > 0.10) {
      warnings.push('Item totals don\'t match receipt total');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Process and clean extracted data
 */
function processExtractedData(data: any): ExtractedReceiptData {
  return {
    merchantName: cleanString(data.merchantName),
    merchantABN: cleanABN(data.merchantABN),
    date: parseDate(data.date),
    totalAmount: parseAmount(data.totalAmount),
    gstAmount: parseAmount(data.gstAmount),
    items: parseItems(data.items),
    paymentMethod: cleanString(data.paymentMethod),
    receiptNumber: cleanString(data.receiptNumber),
    address: cleanString(data.address),
    confidence: data.confidence || 0.5,
  };
}

/**
 * Find matching transaction for receipt
 */
async function findMatchingTransaction(
  userId: string,
  bankAccountId: string,
  amount: number,
  date: Date,
) {
  // Look for transactions within 3 days of receipt date
  const startDate = new Date(date);
  startDate.setDate(startDate.getDate() - 3);
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 3);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      bankAccountId,
      type: TransactionType.DEBIT,
      date: {
        gte: startDate,
        lte: endDate,
      },
      receiptId: null, // Not already linked to a receipt
      deletedAt: null,
    },
  });

  // Find best match based on amount
  const tolerance = 0.10; // 10 cents tolerance
  return transactions.find(t => 
    Math.abs(Math.abs(t.amount) - amount) <= tolerance
  );
}

/**
 * Get receipt processing status
 */
async function handleGetReceiptStatus(
  userId: string,
  query: any,
  res: NextApiResponse,
  requestId: string,
) {
  const { receiptId } = query;

  if (!receiptId) {
    throw new ValidationError('Receipt ID is required');
  }

  const receipt = await prisma.receipt.findFirst({
    where: {
      id: receiptId,
      userId,
      deletedAt: null,
    },
    include: {
      transaction: {
        select: {
          id: true,
          description: true,
          amount: true,
          date: true,
          category: true,
          taxCategory: true,
        },
      },
    },
  });

  if (!receipt) {
    throw new ValidationError('Receipt not found');
  }

  return apiResponse.success(res, {
    receiptId: receipt.id,
    status: receipt.status,
    fileName: receipt.fileName,
    uploadedAt: receipt.uploadedAt,
    processedAt: receipt.processedAt,
    processingTime: receipt.processingTime,
    extractedData: receipt.extractedData,
    validationResults: receipt.validationResults,
    transaction: receipt.transaction,
    confidence: receipt.confidence,
  });
}

// Helper functions
function cleanString(str: any): string | undefined {
  if (!str) return undefined;
  return String(str).trim().replace(/\s+/g, ' ');
}

function cleanABN(abn: any): string | undefined {
  if (!abn) return undefined;
  return String(abn).replace(/\D/g, '');
}

function parseDate(dateStr: any): Date | undefined {
  if (!dateStr) return undefined;
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return undefined;
  
  return date;
}

function parseAmount(amount: any): number | undefined {
  if (amount === null || amount === undefined) return undefined;
  
  const num = typeof amount === 'string' 
    ? parseFloat(amount.replace(/[^0-9.-]/g, ''))
    : Number(amount);
    
  return isNaN(num) ? undefined : Math.round(num * 100) / 100;
}

function parseItems(items: any): ExtractedReceiptData['items'] {
  if (!Array.isArray(items)) return undefined;
  
  return items.map(item => ({
    description: cleanString(item.description) || 'Unknown item',
    quantity: item.quantity ? Number(item.quantity) : undefined,
    unitPrice: parseAmount(item.unitPrice),
    totalPrice: parseAmount(item.totalPrice) || 0,
  })).filter(item => item.totalPrice > 0);
}

function isValidABN(abn: string): boolean {
  const cleanABN = abn.replace(/\D/g, '');
  if (cleanABN.length !== 11) return false;
  
  // Simple ABN validation (full algorithm available at abr.business.gov.au)
  return /^\d{11}$/.test(cleanABN);
}

function categorizeTransaction(merchantName?: string): string {
  if (!merchantName) return 'Other';
  
  const lower = merchantName.toLowerCase();
  
  // Simple categorization based on merchant name
  if (lower.includes('coles') || lower.includes('woolworth') || lower.includes('aldi')) {
    return 'Groceries';
  }
  if (lower.includes('fuel') || lower.includes('petrol') || lower.includes('ampol')) {
    return 'Transport';
  }
  if (lower.includes('restaurant') || lower.includes('cafe') || lower.includes('mcdonald')) {
    return 'Food & Dining';
  }
  if (lower.includes('officeworks') || lower.includes('staples')) {
    return 'Office Supplies';
  }
  
  return 'Other';
}

// Export with comprehensive middleware stack
export default composeMiddleware(
  validateMethod(['POST', 'GET']),
  authMiddleware.authenticated,
  withCSRFProtection,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
  }),
)(withErrorHandler(receiptHandler));

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};