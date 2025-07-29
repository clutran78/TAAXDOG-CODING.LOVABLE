import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { z } from 'zod';
import { AuthEvent } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { logger } from '@/lib/logger';
import {
  authMiddleware,
  AuthenticatedRequest,
} from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { getClientIP } from '../../../lib/auth/auth-utils';
import { getCacheManager } from '../../../lib/services/cache/cacheManager';
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
import { withCSRFProtection } from '../../../lib/auth/csrf-protection';
import { sessionManager } from '../../../lib/auth/session-manager';
import { auditLogger, AuditCategory, ComplianceStandard } from '../../../lib/audit/audit-logger';
import { emailService, EmailType } from '../../../lib/services/email-service';
import { encryptField, maskSensitiveData, EncryptionFieldType } from '../../../lib/security/encryption';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import archiver from 'archiver';
import Queue from 'bull';

// Export types
export enum ExportType {
  TRANSACTIONS = 'TRANSACTIONS',
  TAX_SUMMARY = 'TAX_SUMMARY',
  FINANCIAL_YEAR = 'FINANCIAL_YEAR',
  ACCOUNT_STATEMENT = 'ACCOUNT_STATEMENT',
  RECEIPTS = 'RECEIPTS',
  FULL_BACKUP = 'FULL_BACKUP',
  GDPR_REQUEST = 'GDPR_REQUEST',
}

// Export formats
export enum ExportFormat {
  CSV = 'CSV',
  PDF = 'PDF',
  JSON = 'JSON',
  ZIP = 'ZIP',
}

// Export status
export enum ExportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

// S3 configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const S3_BUCKET = process.env.S3_EXPORT_BUCKET || 'taaxdog-exports';
const EXPORT_EXPIRY_HOURS = 48; // 48 hours

// Export queue
const exportQueue = new Queue('data-exports', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Validation schemas
const exportRequestSchema = z.object({
  type: z.enum(Object.keys(ExportType) as [string, ...string[]]),
  format: z.enum(Object.keys(ExportFormat) as [string, ...string[]]),
  
  // Date range
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  taxYear: z.string().regex(/^\d{4}$/).optional(),
  
  // Filters
  accountId: z.string().uuid().optional(),
  category: z.string().optional(),
  includeReceipts: z.boolean().optional(),
  includeNotes: z.boolean().optional(),
  
  // Options
  timezone: z.string().default('Australia/Sydney'),
  encryptExport: z.boolean().optional(),
  notifyEmail: z.boolean().default(true),
});

// Export metadata interface
interface ExportMetadata {
  exportId: string;
  userId: string;
  type: ExportType;
  format: ExportFormat;
  status: ExportStatus;
  filters: Record<string, any>;
  recordCount?: number;
  fileSize?: number;
  s3Key?: string;
  downloadUrl?: string;
  expiresAt: Date;
  error?: string;
  processingTime?: number;
}

/**
 * Data export API endpoint
 * Handles secure data exports with multiple formats
 */
async function dataExportHandler(req: AuthenticatedRequest, res: NextApiResponse) {
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

  logger.info('Data export API access', {
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
        return await handleCreateExport(userId, req.body, res, req, requestId);

      case 'GET':
        return await handleGetExports(userId, req.query, res, requestId);

      default:
        res.setHeader('Allow', ['POST', 'GET']);
        throw new ValidationError(`Method ${req.method} is not allowed`);
    }
  } catch (error) {
    logger.error('Data export API error', {
      error,
      userId,
      method: req.method,
      requestId,
    });

    throw error;
  }
}

/**
 * Handle export creation
 */
async function handleCreateExport(
  userId: string,
  body: any,
  res: NextApiResponse,
  req: AuthenticatedRequest,
  requestId: string,
) {
  const startTime = Date.now();
  const exportId = crypto.randomUUID();

  try {
    // Validate request
    const validatedData = exportRequestSchema.parse(body);
    const { type, format, dateFrom, dateTo, taxYear, timezone, encryptExport, notifyEmail } = validatedData;

    // Check user's export limit
    const recentExportCount = await prisma.dataExport.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    if (recentExportCount >= 10) {
      throw new BadRequestError('Export limit reached. Maximum 10 exports per 24 hours.');
    }

    // Check subscription for large exports
    if (type === ExportType.FULL_BACKUP || type === ExportType.GDPR_REQUEST) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscription: true },
      });
      
      if (!user?.subscription || user.subscription.plan === 'FREE') {
        throw new BadRequestError('Full backup and GDPR exports require a paid subscription');
      }
    }

    // Create export record
    const dataExport = await prisma.dataExport.create({
      data: {
        id: exportId,
        userId,
        type: type as any,
        format: format as any,
        status: ExportStatus.PENDING,
        filters: validatedData as any,
        expiresAt: new Date(Date.now() + EXPORT_EXPIRY_HOURS * 60 * 60 * 1000),
      },
    });

    // Queue export job
    await exportQueue.add('process-export', {
      exportId,
      userId,
      type,
      format,
      filters: validatedData,
      timezone,
      encryptExport,
      notifyEmail,
      requestId,
    }, {
      delay: 0,
      priority: type === ExportType.GDPR_REQUEST ? 1 : 2,
    });

    // Log export request
    await auditLogger.logCompliance(
      'DATA_EXPORT_REQUESTED',
      ComplianceStandard.AUSTRALIAN_PRIVACY_ACT,
      req,
      userId,
      {
        exportId,
        type,
        format,
        filters: validatedData,
      }
    );

    logger.info('Export request created', {
      userId,
      exportId,
      type,
      format,
      processingTime: Date.now() - startTime,
      requestId,
    });

    return apiResponse.accepted(res, {
      exportId,
      status: ExportStatus.PENDING,
      message: 'Export request received. You will be notified when it\'s ready.',
      estimatedTime: getEstimatedTime(type),
    });

  } catch (error) {
    logger.error('Export creation failed', {
      error,
      userId,
      exportId,
      duration: Date.now() - startTime,
      requestId,
    });

    throw error;
  }
}

/**
 * Handle get exports
 */
async function handleGetExports(
  userId: string,
  query: any,
  res: NextApiResponse,
  requestId: string,
) {
  try {
    const { exportId, status, page = 1, limit = 10 } = query;

    if (exportId) {
      // Get specific export
      const dataExport = await prisma.dataExport.findFirst({
        where: {
          id: exportId,
          userId,
        },
      });

      if (!dataExport) {
        throw new BadRequestError('Export not found');
      }

      // Check if expired
      if (dataExport.expiresAt < new Date()) {
        await prisma.dataExport.update({
          where: { id: exportId },
          data: { status: ExportStatus.EXPIRED },
        });
        
        throw new BadRequestError('Export has expired');
      }

      // Generate download URL if completed
      let downloadUrl;
      if (dataExport.status === ExportStatus.COMPLETED && dataExport.s3Key) {
        downloadUrl = await generateDownloadUrl(dataExport.s3Key, dataExport.fileName || 'export');
      }

      return apiResponse.success(res, {
        ...dataExport,
        downloadUrl,
      });
    } else {
      // List exports
      const skip = (Number(page) - 1) * Number(limit);
      const take = Math.min(Number(limit), 50);

      const where: any = { userId };
      if (status) {
        where.status = status;
      }

      const [exports, total] = await Promise.all([
        prisma.dataExport.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.dataExport.count({ where }),
      ]);

      return apiResponse.success(res, {
        exports,
        pagination: {
          page: Number(page),
          limit: take,
          total,
          pages: Math.ceil(total / take),
          hasMore: skip + take < total,
        },
      });
    }

  } catch (error) {
    logger.error('Failed to get exports', {
      error,
      userId,
      requestId,
    });

    throw error;
  }
}

// Process export queue
exportQueue.process('process-export', async (job) => {
  const { exportId, userId, type, format, filters, timezone, encryptExport, notifyEmail, requestId } = job.data;
  const startTime = Date.now();

  try {
    logger.info('Processing export', { exportId, userId, type, format });

    // Update status
    await prisma.dataExport.update({
      where: { id: exportId },
      data: { status: ExportStatus.PROCESSING },
    });

    // Generate export based on type
    let result: ExportResult;
    
    switch (type) {
      case ExportType.TRANSACTIONS:
        result = await exportTransactions(userId, filters, format, timezone);
        break;
      
      case ExportType.TAX_SUMMARY:
        result = await exportTaxSummary(userId, filters, format, timezone);
        break;
      
      case ExportType.FINANCIAL_YEAR:
        result = await exportFinancialYear(userId, filters, format, timezone);
        break;
      
      case ExportType.ACCOUNT_STATEMENT:
        result = await exportAccountStatement(userId, filters, format, timezone);
        break;
      
      case ExportType.RECEIPTS:
        result = await exportReceipts(userId, filters, timezone);
        break;
      
      case ExportType.FULL_BACKUP:
        result = await exportFullBackup(userId, filters, timezone);
        break;
      
      case ExportType.GDPR_REQUEST:
        result = await exportGDPRData(userId, timezone);
        break;
      
      default:
        throw new Error(`Unknown export type: ${type}`);
    }

    // Encrypt if requested
    if (encryptExport) {
      result.data = await encryptField(result.data.toString('base64'));
      result.fileName += '.encrypted';
    }

    // Upload to S3
    const s3Key = `exports/${userId}/${exportId}/${result.fileName}`;
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: result.data,
      ContentType: result.contentType,
      Metadata: {
        userId,
        exportId,
        type,
        format,
        encrypted: encryptExport ? 'true' : 'false',
      },
      ServerSideEncryption: 'AES256',
    }));

    // Update export record
    await prisma.dataExport.update({
      where: { id: exportId },
      data: {
        status: ExportStatus.COMPLETED,
        s3Key,
        fileName: result.fileName,
        fileSize: result.data.length,
        recordCount: result.recordCount,
        processingTime: Date.now() - startTime,
        completedAt: new Date(),
      },
    });

    // Send notification
    if (notifyEmail) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (user) {
        const downloadUrl = await generateDownloadUrl(s3Key, result.fileName);
        
        await emailService.sendTransactional(
          EmailType.DATA_EXPORT_READY,
          user.email,
          {
            name: user.name,
            exportType: type,
            exportFormat: format,
            downloadUrl,
            expiresAt: format(new Date(Date.now() + EXPORT_EXPIRY_HOURS * 60 * 60 * 1000), 'PPP'),
            recordCount: result.recordCount,
            fileSize: formatFileSize(result.data.length),
          },
          userId
        );
      }
    }

    // Log completion
    await auditLogger.logCompliance(
      'DATA_EXPORT_COMPLETED',
      ComplianceStandard.AUSTRALIAN_PRIVACY_ACT,
      null as any,
      userId,
      {
        exportId,
        type,
        format,
        recordCount: result.recordCount,
        fileSize: result.data.length,
        processingTime: Date.now() - startTime,
      }
    );

    logger.info('Export completed', {
      exportId,
      userId,
      type,
      format,
      recordCount: result.recordCount,
      fileSize: result.data.length,
      processingTime: Date.now() - startTime,
    });

  } catch (error) {
    logger.error('Export processing failed', {
      error,
      exportId,
      userId,
      type,
      format,
    });

    // Update status
    await prisma.dataExport.update({
      where: { id: exportId },
      data: {
        status: ExportStatus.FAILED,
        error: error instanceof Error ? error.message : 'Export processing failed',
      },
    });

    throw error;
  }
});

// Export result interface
interface ExportResult {
  data: Buffer;
  fileName: string;
  contentType: string;
  recordCount: number;
}

/**
 * Export transactions
 */
async function exportTransactions(
  userId: string,
  filters: any,
  format: ExportFormat,
  timezone: string
): Promise<ExportResult> {
  const { dateFrom, dateTo, accountId, category } = filters;

  // Build query
  const where: any = {
    userId,
    deletedAt: null,
  };

  if (dateFrom && dateTo) {
    where.date = {
      gte: parseISO(dateFrom),
      lte: parseISO(dateTo),
    };
  }
  if (accountId) {
    where.accountId = accountId;
  }
  if (category) {
    where.category = category;
  }

  // Get transactions
  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      account: {
        select: {
          name: true,
          accountNumber: true,
          institutionName: true,
        },
      },
    },
  });

  // Format based on type
  switch (format) {
    case ExportFormat.CSV:
      return exportTransactionsAsCSV(transactions, timezone);
    
    case ExportFormat.PDF:
      return exportTransactionsAsPDF(transactions, timezone, filters);
    
    case ExportFormat.JSON:
      return exportTransactionsAsJSON(transactions);
    
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Export transactions as CSV
 */
function exportTransactionsAsCSV(transactions: any[], timezone: string): ExportResult {
  const headers = [
    'Date',
    'Time',
    'Type',
    'Amount',
    'Merchant',
    'Description',
    'Category',
    'Tax Category',
    'Account',
    'Business Expense',
    'Reference',
    'Status',
  ];

  const rows = transactions.map(t => [
    formatInTimeZone(t.date, timezone, 'yyyy-MM-dd'),
    formatInTimeZone(t.date, timezone, 'HH:mm:ss'),
    t.type,
    t.amount.toFixed(2),
    t.merchant || '',
    t.description || '',
    t.category || '',
    t.taxCategory || '',
    t.account ? `${t.account.name} (${maskSensitiveData(t.account.accountNumber, EncryptionFieldType.BANK_ACCOUNT)})` : '',
    t.isBusinessExpense ? 'Yes' : 'No',
    t.reference || '',
    t.status,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n');

  return {
    data: Buffer.from(csvContent, 'utf8'),
    fileName: `transactions_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`,
    contentType: 'text/csv',
    recordCount: transactions.length,
  };
}

/**
 * Export transactions as PDF
 */
async function exportTransactionsAsPDF(
  transactions: any[],
  timezone: string,
  filters: any
): Promise<ExportResult> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve({
        data: pdfBuffer,
        fileName: `transactions_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`,
        contentType: 'application/pdf',
        recordCount: transactions.length,
      });
    });
    doc.on('error', reject);

    // Add header
    doc.fontSize(20).text('Transaction Report', { align: 'center' });
    doc.fontSize(12).text(`Generated: ${formatInTimeZone(new Date(), timezone, 'PPP')}`, { align: 'center' });
    
    if (filters.dateFrom && filters.dateTo) {
      doc.text(`Period: ${format(parseISO(filters.dateFrom), 'PP')} - ${format(parseISO(filters.dateTo), 'PP')}`, { align: 'center' });
    }
    
    doc.moveDown();

    // Add summary
    const totalCredit = transactions.filter(t => t.type === 'CREDIT').reduce((sum, t) => sum + t.amount, 0);
    const totalDebit = transactions.filter(t => t.type === 'DEBIT').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    doc.fontSize(14).text('Summary', { underline: true });
    doc.fontSize(12);
    doc.text(`Total Income: $${totalCredit.toFixed(2)}`);
    doc.text(`Total Expenses: $${totalDebit.toFixed(2)}`);
    doc.text(`Net: $${(totalCredit - totalDebit).toFixed(2)}`);
    doc.text(`Transaction Count: ${transactions.length}`);
    doc.moveDown();

    // Add transactions table
    doc.fontSize(14).text('Transactions', { underline: true });
    doc.fontSize(10);

    // Table headers
    const startX = 50;
    let currentY = doc.y;
    
    doc.text('Date', startX, currentY);
    doc.text('Description', startX + 80, currentY);
    doc.text('Category', startX + 250, currentY);
    doc.text('Amount', startX + 350, currentY);
    doc.text('Status', startX + 420, currentY);
    
    doc.moveTo(startX, currentY + 15)
       .lineTo(startX + 470, currentY + 15)
       .stroke();
    
    currentY += 20;

    // Add transactions
    for (const transaction of transactions) {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      const description = transaction.merchant || transaction.description || 'N/A';
      const amount = transaction.type === 'CREDIT' 
        ? `$${transaction.amount.toFixed(2)}` 
        : `-$${Math.abs(transaction.amount).toFixed(2)}`;

      doc.text(formatInTimeZone(transaction.date, timezone, 'dd/MM/yyyy'), startX, currentY);
      doc.text(description.substring(0, 30), startX + 80, currentY);
      doc.text(transaction.category || 'N/A', startX + 250, currentY);
      doc.text(amount, startX + 350, currentY);
      doc.text(transaction.status, startX + 420, currentY);
      
      currentY += 15;
    }

    // Add footer
    doc.fontSize(8).text(
      'This document contains confidential financial information. Handle with care.',
      50,
      750,
      { align: 'center' }
    );

    doc.end();
  });
}

/**
 * Export transactions as JSON
 */
function exportTransactionsAsJSON(transactions: any[]): ExportResult {
  const data = {
    exportDate: new Date().toISOString(),
    recordCount: transactions.length,
    transactions: transactions.map(t => ({
      id: t.id,
      date: t.date,
      type: t.type,
      amount: t.amount,
      merchant: t.merchant,
      description: t.description,
      category: t.category,
      taxCategory: t.taxCategory,
      account: t.account ? {
        name: t.account.name,
        accountNumber: maskSensitiveData(t.account.accountNumber, EncryptionFieldType.BANK_ACCOUNT),
        institution: t.account.institutionName,
      } : null,
      isBusinessExpense: t.isBusinessExpense,
      isRecurring: t.isRecurring,
      status: t.status,
      reference: t.reference,
      tags: t.tags,
    })),
  };

  return {
    data: Buffer.from(JSON.stringify(data, null, 2), 'utf8'),
    fileName: `transactions_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`,
    contentType: 'application/json',
    recordCount: transactions.length,
  };
}

/**
 * Export tax summary
 */
async function exportTaxSummary(
  userId: string,
  filters: any,
  format: ExportFormat,
  timezone: string
): Promise<ExportResult> {
  const { taxYear } = filters;
  
  if (!taxYear) {
    throw new Error('Tax year is required for tax summary export');
  }

  // Get tax year dates (July 1 - June 30)
  const startDate = new Date(parseInt(taxYear), 6, 1); // July 1
  const endDate = new Date(parseInt(taxYear) + 1, 5, 30, 23, 59, 59); // June 30

  // Get all relevant data
  const [transactions, taxCalculations, receipts] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        deletedAt: null,
      },
      orderBy: { date: 'asc' },
    }),
    prisma.taxCalculation.findMany({
      where: {
        userId,
        taxYear,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    }),
    prisma.receipt.findMany({
      where: {
        userId,
        transaction: {
          date: { gte: startDate, lte: endDate },
        },
      },
    }),
  ]);

  // Calculate summaries
  const income = transactions
    .filter(t => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const businessExpenses = transactions
    .filter(t => t.type === 'DEBIT' && t.isBusinessExpense)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const deductionsByCategory = transactions
    .filter(t => t.type === 'DEBIT' && t.taxCategory)
    .reduce((acc, t) => {
      const category = t.taxCategory!;
      if (!acc[category]) acc[category] = 0;
      acc[category] += Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

  if (format === ExportFormat.PDF) {
    return exportTaxSummaryAsPDF({
      taxYear,
      income,
      businessExpenses,
      deductionsByCategory,
      transactions,
      taxCalculations,
      receipts,
      timezone,
    });
  } else {
    throw new Error('Tax summary only supports PDF format');
  }
}

/**
 * Export financial year data
 */
async function exportFinancialYear(
  userId: string,
  filters: any,
  format: ExportFormat,
  timezone: string
): Promise<ExportResult> {
  // Similar to tax summary but includes all financial data
  // Implementation would be similar to exportTaxSummary
  throw new Error('Financial year export not yet implemented');
}

/**
 * Export account statement
 */
async function exportAccountStatement(
  userId: string,
  filters: any,
  format: ExportFormat,
  timezone: string
): Promise<ExportResult> {
  const { accountId, dateFrom, dateTo } = filters;
  
  if (!accountId) {
    throw new Error('Account ID is required for account statement export');
  }

  // Get account and transactions
  const [account, transactions] = await Promise.all([
    prisma.account.findFirst({
      where: { id: accountId, userId },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        accountId,
        date: {
          gte: dateFrom ? parseISO(dateFrom) : undefined,
          lte: dateTo ? parseISO(dateTo) : undefined,
        },
        deletedAt: null,
      },
      orderBy: { date: 'asc' },
    }),
  ]);

  if (!account) {
    throw new Error('Account not found');
  }

  if (format === ExportFormat.PDF) {
    return exportAccountStatementAsPDF(account, transactions, timezone, filters);
  } else {
    throw new Error('Account statement only supports PDF format');
  }
}

/**
 * Export receipts
 */
async function exportReceipts(
  userId: string,
  filters: any,
  timezone: string
): Promise<ExportResult> {
  const { dateFrom, dateTo, category } = filters;

  // Get receipts with transactions
  const receipts = await prisma.receipt.findMany({
    where: {
      userId,
      transaction: {
        date: {
          gte: dateFrom ? parseISO(dateFrom) : undefined,
          lte: dateTo ? parseISO(dateTo) : undefined,
        },
        category: category || undefined,
      },
    },
    include: {
      transaction: true,
    },
  });

  // Create ZIP archive
  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  stream.on('data', (chunk) => chunks.push(chunk));
  
  return new Promise((resolve, reject) => {
    stream.on('end', () => {
      resolve({
        data: Buffer.concat(chunks),
        fileName: `receipts_${format(new Date(), 'yyyyMMdd_HHmmss')}.zip`,
        contentType: 'application/zip',
        recordCount: receipts.length,
      });
    });

    archive.on('error', reject);
    archive.pipe(stream);

    // Add receipts manifest
    const manifest = receipts.map(r => ({
      fileName: r.fileName,
      transactionDate: r.transaction.date,
      merchant: r.transaction.merchant,
      amount: r.transaction.amount,
      category: r.transaction.category,
    }));

    archive.append(JSON.stringify(manifest, null, 2), {
      name: 'manifest.json',
    });

    // Add receipt files (would need to fetch from S3)
    // This is simplified - in production, you'd fetch each file from S3
    for (const receipt of receipts) {
      archive.append(`Receipt file data for ${receipt.fileName}`, {
        name: `receipts/${receipt.fileName}`,
      });
    }

    archive.finalize();
  });
}

/**
 * Export full backup
 */
async function exportFullBackup(
  userId: string,
  filters: any,
  timezone: string
): Promise<ExportResult> {
  // Get all user data
  const [
    user,
    transactions,
    accounts,
    goals,
    budgets,
    receipts,
    documents,
    preferences,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        preferences: true,
      },
    }),
    prisma.transaction.findMany({ where: { userId } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.goal.findMany({ where: { userId } }),
    prisma.budget.findMany({ where: { userId } }),
    prisma.receipt.findMany({ where: { userId } }),
    prisma.document.findMany({ where: { userId } }),
    prisma.notificationPreference.findUnique({ where: { userId } }),
  ]);

  const backupData = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    user: {
      ...user,
      email: maskSensitiveData(user!.email, EncryptionFieldType.GENERIC_SENSITIVE),
    },
    data: {
      transactions: transactions.length,
      accounts: accounts.length,
      goals: goals.length,
      budgets: budgets.length,
      receipts: receipts.length,
      documents: documents.length,
    },
    transactions,
    accounts: accounts.map(a => ({
      ...a,
      accountNumber: maskSensitiveData(a.accountNumber, EncryptionFieldType.BANK_ACCOUNT),
    })),
    goals,
    budgets,
    preferences,
  };

  return {
    data: Buffer.from(JSON.stringify(backupData, null, 2), 'utf8'),
    fileName: `backup_${userId}_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`,
    contentType: 'application/json',
    recordCount: Object.values(backupData.data).reduce((sum, count) => sum + count, 0),
  };
}

/**
 * Export GDPR data
 */
async function exportGDPRData(
  userId: string,
  timezone: string
): Promise<ExportResult> {
  // Similar to full backup but includes all personal data
  // and audit logs
  const fullBackup = await exportFullBackup(userId, {}, timezone);
  
  // Add audit logs
  const auditLogs = await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 1000, // Limit for performance
  });

  const gdprData = JSON.parse(fullBackup.data.toString());
  gdprData.auditLogs = auditLogs;
  gdprData.dataSubjectRights = {
    rightToAccess: true,
    rightToRectification: true,
    rightToErasure: true,
    rightToPortability: true,
    rightToObjection: true,
  };

  return {
    data: Buffer.from(JSON.stringify(gdprData, null, 2), 'utf8'),
    fileName: `gdpr_export_${userId}_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`,
    contentType: 'application/json',
    recordCount: fullBackup.recordCount + auditLogs.length,
  };
}

/**
 * Export tax summary as PDF
 */
async function exportTaxSummaryAsPDF(data: any): Promise<ExportResult> {
  // Implementation would create a comprehensive tax summary PDF
  // Including income, deductions, calculations, etc.
  throw new Error('Tax summary PDF export not yet implemented');
}

/**
 * Export account statement as PDF
 */
async function exportAccountStatementAsPDF(
  account: any,
  transactions: any[],
  timezone: string,
  filters: any
): Promise<ExportResult> {
  // Implementation would create a bank-style statement PDF
  throw new Error('Account statement PDF export not yet implemented');
}

/**
 * Generate download URL
 */
async function generateDownloadUrl(s3Key: string, fileName: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
  });

  return getSignedUrl(s3Client, command, { 
    expiresIn: EXPORT_EXPIRY_HOURS * 60 * 60 // Convert to seconds
  });
}

/**
 * Get estimated time for export
 */
function getEstimatedTime(type: ExportType): string {
  const estimates: Record<ExportType, string> = {
    [ExportType.TRANSACTIONS]: '1-2 minutes',
    [ExportType.TAX_SUMMARY]: '2-3 minutes',
    [ExportType.FINANCIAL_YEAR]: '3-5 minutes',
    [ExportType.ACCOUNT_STATEMENT]: '1-2 minutes',
    [ExportType.RECEIPTS]: '5-10 minutes',
    [ExportType.FULL_BACKUP]: '5-10 minutes',
    [ExportType.GDPR_REQUEST]: '10-15 minutes',
  };

  return estimates[type] || '5 minutes';
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Escape CSV value
 */
function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Export with comprehensive middleware stack
export default composeMiddleware(
  validateMethod(['POST', 'GET']),
  authMiddleware.authenticated,
  withCSRFProtection,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 10, // 10 exports per minute
  }),
)(withErrorHandler(dataExportHandler));