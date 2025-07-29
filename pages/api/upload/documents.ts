import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { z } from 'zod';
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import { AuthEvent, DocumentType, DocumentStatus } from '@prisma/client';
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
import { auditLogger } from '../../../lib/audit/audit-logger';
import { encryptField, hashSensitiveData } from '../../../lib/security/encryption';
import sharp from 'sharp';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mime from 'mime-types';

// File upload configuration
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILES_PER_REQUEST = 5;
const MAX_FILES_PER_USER = 1000;
const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
];

// Dangerous file extensions to block
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js', '.jar',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.iso', '.dmg',
  '.app', '.deb', '.rpm', '.msi', '.pkg',
];

// Document types mapping
const DOCUMENT_TYPE_MAP: Record<string, DocumentType> = {
  'tax_return': 'TAX_RETURN',
  'receipt': 'RECEIPT',
  'invoice': 'INVOICE',
  'bank_statement': 'BANK_STATEMENT',
  'payslip': 'PAYSLIP',
  'contract': 'CONTRACT',
  'identification': 'IDENTIFICATION',
  'other': 'OTHER',
};

// S3 configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const S3_BUCKET = process.env.S3_BUCKET_NAME || 'taaxdog-documents';
const S3_REGION = process.env.AWS_REGION || 'ap-southeast-2';

// Validation schemas
const uploadQuerySchema = z.object({
  documentType: z.enum(Object.keys(DOCUMENT_TYPE_MAP) as [string, ...string[]]),
  taxYear: z.string().regex(/^\d{4}$/).optional(),
  category: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  isPrivate: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
});

// File metadata interface
interface FileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string;
  dimensions?: {
    width: number;
    height: number;
  };
  virusScanStatus?: 'pending' | 'clean' | 'infected';
  virusScanDate?: Date;
}

/**
 * Document upload API endpoint
 * Handles secure file uploads with validation and virus scanning
 */
async function documentUploadHandler(req: AuthenticatedRequest, res: NextApiResponse) {
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

  logger.info('Document upload API access', {
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
        return await handleDocumentUpload(userId, req, res, requestId);

      case 'GET':
        return await handleGetUserDocuments(userId, req.query, res, requestId);

      default:
        res.setHeader('Allow', ['POST', 'GET']);
        throw new ValidationError(`Method ${req.method} is not allowed`);
    }
  } catch (error) {
    logger.error('Document upload API error', {
      error,
      userId,
      method: req.method,
      requestId,
    });

    // Log error for monitoring
    await auditLogger.logApiAccess(
      '/api/upload/documents',
      req.method!,
      req,
      userId,
      500,
      0,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      }
    );

    throw error;
  }
}

/**
 * Handle document upload
 */
async function handleDocumentUpload(
  userId: string,
  req: AuthenticatedRequest,
  res: NextApiResponse,
  requestId: string,
) {
  const startTime = Date.now();
  const uploadedFiles: string[] = [];

  try {
    // Check user's document limit
    const documentCount = await prisma.document.count({
      where: {
        userId,
        deletedAt: null,
      },
    });

    if (documentCount >= MAX_FILES_PER_USER) {
      throw new BadRequestError(`Maximum document limit (${MAX_FILES_PER_USER}) reached`);
    }

    // Parse form data
    const form = formidable({
      maxFiles: MAX_FILES_PER_REQUEST,
      maxFileSize: MAX_FILE_SIZE,
      allowEmptyFiles: false,
      filter: (part) => {
        // Validate MIME type
        if (!part.mimetype || !ALLOWED_MIME_TYPES.includes(part.mimetype)) {
          return false;
        }
        // Check file extension
        const ext = path.extname(part.originalFilename || '').toLowerCase();
        if (BLOCKED_EXTENSIONS.includes(ext)) {
          return false;
        }
        return true;
      },
    });

    const [fields, files] = await form.parse(req);
    
    // Validate query parameters
    const validatedQuery = uploadQuerySchema.parse(req.query);
    const { documentType, taxYear, category, description, isPrivate = false } = validatedQuery;

    // Get file array (formidable returns array or single file)
    const fileArray = Array.isArray(files.file) ? files.file : files.file ? [files.file] : [];
    
    if (fileArray.length === 0) {
      throw new BadRequestError('No files provided');
    }

    if (fileArray.length > MAX_FILES_PER_REQUEST) {
      throw new BadRequestError(`Maximum ${MAX_FILES_PER_REQUEST} files allowed per request`);
    }

    const uploadResults = [];

    // Process each file
    for (const file of fileArray) {
      const fileId = crypto.randomUUID();
      
      try {
        // Read file for processing
        const fileBuffer = await fs.readFile(file.filepath);
        
        // Calculate checksum
        const checksum = crypto
          .createHash('sha256')
          .update(fileBuffer)
          .digest('hex');

        // Check for duplicate
        const existingDocument = await prisma.document.findFirst({
          where: {
            userId,
            checksum,
            deletedAt: null,
          },
        });

        if (existingDocument) {
          logger.warn('Duplicate file detected', {
            userId,
            fileId,
            checksum,
            existingDocumentId: existingDocument.id,
            requestId,
          });
          
          uploadResults.push({
            status: 'duplicate',
            message: 'File already exists',
            documentId: existingDocument.id,
            originalName: file.originalFilename,
          });
          continue;
        }

        // Virus scanning (mock implementation - integrate with real service)
        const virusScanResult = await performVirusScan(fileBuffer);
        if (virusScanResult.infected) {
          logger.error('Virus detected in uploaded file', {
            userId,
            fileId,
            threat: virusScanResult.threat,
            requestId,
          });
          
          throw new BadRequestError('File failed security scan');
        }

        // Process image files
        let metadata: FileMetadata = {
          originalName: file.originalFilename || 'unknown',
          mimeType: file.mimetype || 'application/octet-stream',
          size: file.size,
          checksum,
          virusScanStatus: 'clean',
          virusScanDate: new Date(),
        };

        let processedBuffer = fileBuffer;
        
        if (file.mimetype?.startsWith('image/')) {
          try {
            // Get image metadata
            const imageMetadata = await sharp(fileBuffer).metadata();
            metadata.dimensions = {
              width: imageMetadata.width || 0,
              height: imageMetadata.height || 0,
            };

            // Optimize image (resize if too large, compress)
            if (imageMetadata.width && imageMetadata.width > 2000) {
              processedBuffer = await sharp(fileBuffer)
                .resize(2000, null, { withoutEnlargement: true })
                .jpeg({ quality: 85, progressive: true })
                .toBuffer();
            }

            // Strip EXIF data for privacy
            processedBuffer = await sharp(processedBuffer)
              .rotate() // Auto-rotate based on EXIF
              .removeMetadata()
              .toBuffer();
          } catch (imageError) {
            logger.warn('Image processing failed, using original', {
              error: imageError,
              fileId,
              requestId,
            });
          }
        }

        // Generate S3 key
        const fileExtension = path.extname(file.originalFilename || '.bin');
        const s3Key = `users/${userId}/${taxYear || 'general'}/${fileId}${fileExtension}`;

        // Upload to S3
        const uploadCommand = new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key,
          Body: processedBuffer,
          ContentType: file.mimetype || 'application/octet-stream',
          Metadata: {
            userId,
            documentId: fileId,
            originalName: Buffer.from(file.originalFilename || 'unknown').toString('base64'),
            uploadedAt: new Date().toISOString(),
          },
          ServerSideEncryption: 'AES256',
          StorageClass: 'INTELLIGENT_TIERING',
        });

        await s3Client.send(uploadCommand);
        uploadedFiles.push(s3Key);

        // Create document record
        const document = await prisma.document.create({
          data: {
            id: fileId,
            userId,
            fileName: file.originalFilename || 'unknown',
            fileSize: processedBuffer.length,
            mimeType: file.mimetype || 'application/octet-stream',
            documentType: DOCUMENT_TYPE_MAP[documentType],
            taxYear: taxYear ? parseInt(taxYear) : null,
            category,
            description,
            isPrivate,
            status: DocumentStatus.ACTIVE,
            s3Key,
            s3Bucket: S3_BUCKET,
            checksum,
            metadata: metadata as any,
            virusScanStatus: 'clean',
            virusScanDate: new Date(),
          },
        });

        // Log successful upload
        await auditLogger.logDataModification(
          'document',
          'CREATE',
          req,
          userId,
          document.id,
          {
            fileName: document.fileName,
            fileSize: document.fileSize,
            documentType: document.documentType,
          },
          { requestId }
        );

        uploadResults.push({
          status: 'success',
          documentId: document.id,
          originalName: file.originalFilename,
          size: document.fileSize,
          url: await generatePresignedUrl(s3Key, file.originalFilename || 'download'),
        });

      } catch (fileError) {
        logger.error('Error processing file', {
          error: fileError,
          fileId,
          fileName: file.originalFilename,
          requestId,
        });

        uploadResults.push({
          status: 'error',
          originalName: file.originalFilename,
          error: fileError instanceof Error ? fileError.message : 'Processing failed',
        });
      } finally {
        // Clean up temp file
        try {
          await fs.unlink(file.filepath);
        } catch (cleanupError) {
          logger.warn('Failed to clean up temp file', {
            error: cleanupError,
            filepath: file.filepath,
          });
        }
      }
    }

    // Clear user's document cache
    const cacheManager = await getCacheManager();
    await cacheManager.deletePattern(`documents:${userId}:*`);

    logger.info('Document upload completed', {
      userId,
      uploadCount: uploadResults.filter(r => r.status === 'success').length,
      failureCount: uploadResults.filter(r => r.status === 'error').length,
      duplicateCount: uploadResults.filter(r => r.status === 'duplicate').length,
      processingTime: Date.now() - startTime,
      requestId,
    });

    return apiResponse.success(res, {
      results: uploadResults,
      summary: {
        total: uploadResults.length,
        successful: uploadResults.filter(r => r.status === 'success').length,
        failed: uploadResults.filter(r => r.status === 'error').length,
        duplicates: uploadResults.filter(r => r.status === 'duplicate').length,
      },
    });

  } catch (error) {
    // Clean up any uploaded files on error
    for (const s3Key of uploadedFiles) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key,
        }));
      } catch (cleanupError) {
        logger.error('Failed to clean up S3 file', {
          error: cleanupError,
          s3Key,
        });
      }
    }

    logger.error('Document upload failed', {
      error,
      userId,
      duration: Date.now() - startTime,
      requestId,
    });

    throw error;
  }
}

/**
 * Get user's documents
 */
async function handleGetUserDocuments(
  userId: string,
  query: any,
  res: NextApiResponse,
  requestId: string,
) {
  try {
    const {
      documentType,
      taxYear,
      category,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // Build filters
    const where: any = {
      userId,
      deletedAt: null,
    };

    if (documentType) {
      where.documentType = DOCUMENT_TYPE_MAP[documentType];
    }
    if (taxYear) {
      where.taxYear = parseInt(taxYear);
    }
    if (category) {
      where.category = category;
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    const take = Math.min(Number(limit), 100);

    // Get documents with count
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take,
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          documentType: true,
          taxYear: true,
          category: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.document.count({ where }),
    ]);

    // Generate presigned URLs for documents
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        const url = await generatePresignedUrl(doc.s3Key!, doc.fileName);
        return {
          ...doc,
          downloadUrl: url,
          sizeFormatted: formatFileSize(doc.fileSize),
        };
      })
    );

    return apiResponse.success(res, {
      documents: documentsWithUrls,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        pages: Math.ceil(total / take),
        hasMore: skip + take < total,
      },
    });

  } catch (error) {
    logger.error('Error retrieving documents', {
      error,
      userId,
      requestId,
    });

    throw error;
  }
}

/**
 * Perform virus scan (mock implementation)
 */
async function performVirusScan(buffer: Buffer): Promise<{
  infected: boolean;
  threat?: string;
}> {
  // TODO: Integrate with real virus scanning service (e.g., ClamAV, VirusTotal)
  // This is a mock implementation
  
  // Check for suspicious patterns (very basic)
  const suspicious = [
    Buffer.from('4D5A'), // EXE header
    Buffer.from('504B0304'), // ZIP header
    Buffer.from('CAFEBABE'), // Java class file
  ];

  for (const pattern of suspicious) {
    if (buffer.subarray(0, pattern.length).equals(pattern)) {
      return {
        infected: true,
        threat: 'Suspicious file type detected',
      };
    }
  }

  return { infected: false };
}

/**
 * Generate presigned URL for S3 object
 */
async function generatePresignedUrl(s3Key: string, fileName: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
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

// Export with comprehensive middleware stack
export default composeMiddleware(
  validateMethod(['POST', 'GET']),
  authMiddleware.authenticated,
  withCSRFProtection,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 10, // 10 uploads per minute
  }),
)(withErrorHandler(documentUploadHandler));