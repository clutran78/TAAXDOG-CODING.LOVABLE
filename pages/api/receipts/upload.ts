import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import formidable from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../../../lib/prisma';
import { fileValidation, addSecurityHeaders, sanitizers } from '../../../lib/security/sanitizer';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Validation schema for form fields
const ReceiptUploadFieldsSchema = z.object({
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .transform((val) => (val ? sanitizers.plainText(val) : undefined)),
  amount: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => !val || (!isNaN(val) && val >= 0), 'Amount must be a positive number'),
  date: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date format'),
  category: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizers.plainText(val) : undefined)),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return apiResponse.unauthorized(res, { error: 'Unauthorized' });
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'receipts');
    await fs.mkdir(uploadDir, { recursive: true });

    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: fileValidation.maxSizes.receipt,
      filter: function ({ mimetype }) {
        return mimetype && fileValidation.allowedTypes.receipt.includes(mimetype);
      },
    });

    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.receipt) ? files.receipt[0] : files.receipt;

    if (!file) {
      return apiResponse.error(res, { error: 'No file uploaded' });
    }

    // Validate file
    const validation = fileValidation.validate(
      {
        name: file.originalFilename || '',
        type: file.mimetype || '',
        size: file.size,
      },
      'receipt',
    );

    if (!validation.valid) {
      // Clean up uploaded file
      await fs.unlink(file.filepath).catch(() => {});
      return apiResponse.error(res, {
        error: 'File validation failed',
        errors: validation.errors,
      });
    }

    // Validate and sanitize form fields
    const fieldsData = {
      description: Array.isArray(fields.description) ? fields.description[0] : fields.description,
      amount: Array.isArray(fields.amount) ? fields.amount[0] : fields.amount,
      date: Array.isArray(fields.date) ? fields.date[0] : fields.date,
      category: Array.isArray(fields.category) ? fields.category[0] : fields.category,
    };

    const fieldValidation = ReceiptUploadFieldsSchema.safeParse(fieldsData);
    if (!fieldValidation.success) {
      // Clean up uploaded file
      await fs.unlink(file.filepath).catch(() => {});
      return apiResponse.error(res, {
        error: 'Validation error',
        message: 'Invalid form data',
        errors: fieldValidation.error.flatten(),
      });
    }

    const validatedFields = fieldValidation.data;

    // Generate secure filename
    const fileExt = path.extname(validation.sanitizedName);
    const fileName = `${session.user.id}_${crypto.randomBytes(16).toString('hex')}${fileExt}`;
    const newPath = path.join(uploadDir, fileName);

    // Move file to final location
    await fs.rename(file.filepath, newPath);

    // Verify file still exists after move
    try {
      await fs.access(newPath);
    } catch {
      return apiResponse.internalError(res, { error: 'Failed to save file' });
    }

    // Create receipt record with sanitized data
    const receipt = await prisma.receipt.create({
      data: {
        userId: session.user.id,
        imageUrl: `/uploads/receipts/${fileName}`,
        totalAmount: validatedFields.amount || 0,
        date: validatedFields.date ? new Date(validatedFields.date) : new Date(),
        processingStatus: 'PENDING',
        aiProvider: 'gemini',
        aiModel: 'gemini-1.5-flash',
        description: validatedFields.description,
        category: validatedFields.category,
      },
    });

    // Return success response
    apiResponse.success(res, {
      success: true,
      receiptId: receipt.id,
      message: 'Receipt uploaded successfully and queued for processing',
      data: {
        id: receipt.id,
        imageUrl: receipt.imageUrl,
        processingStatus: receipt.processingStatus,
        uploadedAt: receipt.createdAt,
      },
    });
  } catch (error) {
    logger.error('Receipt upload error:', error);

    // Generic error response
    apiResponse.internalError(res, {
      error: 'Failed to upload receipt',
      message: 'An error occurred while uploading your receipt. Please try again.',
    });
  }
}
