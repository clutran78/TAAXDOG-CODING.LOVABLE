import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';
import { detectTaxCategory, validateTaxInvoice, detectDuplicateReceipt } from '../../../../lib/australian-tax-compliance';

const prisma = new PrismaClient();

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid receipt ID' });
    }

    // Get existing receipt
    const receipt = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.receipt.findUnique({
      where: { id },
    });
    });

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Verify ownership
    if (receipt.userId !== session.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
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
    const existingReceipts = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.receipt.findMany({
      where: {
        id: { not: id },
        date: new Date(date);
    }),
      },
    });

    const duplicateCheck = detectDuplicateReceipt(
      { merchant, totalAmount, date, taxInvoiceNumber },
      existingReceipts
    );

    if (duplicateCheck.isDuplicate) {
      return res.status(400).json({
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
    const updatedReceipt = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.receipt.update({
      where: { id },
      data: {
        merchant,
        totalAmount,
        gstAmount,
        date: new Date(date);
    }),
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

    res.status(200).json({
      success: true,
      receipt: updatedReceipt,
      taxInvoiceValid: invoiceValidation.isValid,
      missingFields: invoiceValidation.missingFields,
    });

  } catch (error) {
    console.error('Receipt update error:', error);
    res.status(500).json({ error: 'Failed to update receipt' });
  } finally {
    await prismaWithRLS.$disconnect();
  }
}