import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';
import {
  detectTaxCategory,
  validateTaxInvoice,
  detectDuplicateReceipt,
} from '../../../../lib/australian-tax-compliance';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return apiResponse.unauthorized(res, { error: 'Unauthorized' });
    }

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return apiResponse.error(res, { error: 'Invalid receipt ID' });
    }

    // Get existing receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id },
    });

    if (!receipt) {
      return apiResponse.notFound(res, { error: 'Receipt not found' });
    }

    // Verify ownership
    if (receipt.userId !== session.user.id) {
      return apiResponse.forbidden(res, { error: 'Forbidden' });
    }

    const {
      merchant,
      totalAmount,
      gstAmount,
      date,
      abn,
      taxInvoiceNumber,
      taxCategory,
      items,
      processingStatus,
      aiConfidence,
    } = req.body;

    // Auto-detect tax category if not provided
    const category = taxCategory || detectTaxCategory(merchant, items);

    // Check for duplicates
    const existingReceipts = await prisma.receipt.findMany({
      where: {
        userId: session.user.id,
        id: { not: id },
        date: new Date(date),
      },
    });

    const duplicateCheck = detectDuplicateReceipt(
      { merchant, totalAmount, date, taxInvoiceNumber },
      existingReceipts,
    );

    if (duplicateCheck.isDuplicate) {
      return apiResponse.error(res, {
        error: 'Duplicate receipt detected',
        duplicateReceiptId: duplicateCheck.matchedReceiptId,
      });
    }

    // Validate tax invoice
    const invoiceValidation = validateTaxInvoice({
      merchant,
      abn,
      date,
      totalAmount,
      gstAmount,
      items,
    });

    // Update receipt
    const updatedReceipt = await prisma.receipt.update({
      where: { id },
      data: {
        merchant,
        totalAmount,
        gstAmount,
        date: new Date(date),
        abn,
        taxInvoiceNumber,
        taxCategory: category,
        items,
        processingStatus: processingStatus || 'PROCESSED',
        aiConfidence: aiConfidence || receipt.aiConfidence,
        isGstRegistered: !!abn,
        updatedAt: new Date(),
      },
    });

    apiResponse.success(res, {
      success: true,
      receipt: updatedReceipt,
      taxInvoiceValid: invoiceValidation.isValid,
      missingFields: invoiceValidation.missingFields,
    });
  } catch (error) {
    logger.error('Receipt update error:', error);
    apiResponse.internalError(res, { error: 'Failed to update receipt' });
  } finally {
    await prisma.$disconnect();
  }
}
