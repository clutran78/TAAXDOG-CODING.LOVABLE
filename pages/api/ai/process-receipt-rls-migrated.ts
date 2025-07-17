import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { receiptProcessor, ReceiptData } from '../../../lib/ai/services/receipt-processing';
import { prisma } from '../../../lib/prisma';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { imageData, mimeType, businessId, additionalContext } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const startTime = Date.now();

    // Process receipt with Gemini AI using enhanced multi-provider system
    const processedReceipt = await receiptProcessor.processReceipt({
      imageData,
      mimeType,
      userId: session.user.id,
      businessId,
      additionalContext,
    });
    
    // Validate receipt data with Australian compliance
    const validation = receiptProcessor.validateReceiptData(processedReceipt);
    
    // Check for duplicates
    const isDuplicate = await receiptProcessor.detectDuplicateReceipt(
      processedReceipt, 
      session.user.id
    );

    // Save receipt to database with AI metadata
    const receipt = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.receipt.create({
      data: {
        userId: session.user.id,
        merchant: processedReceipt.merchantName,
        totalAmount: processedReceipt.totalAmount,
        gstAmount: processedReceipt.gstAmount,
        date: processedReceipt.date,
        items: processedReceipt.lineItems as any,
        abn: processedReceipt.abn,
        taxInvoiceNumber: processedReceipt.taxInvoiceNumber,
        isGstRegistered: processedReceipt.isGstCompliant,
        aiProcessed: true,
        aiConfidence: processedReceipt.confidence,
        aiProvider: 'gemini',
        aiModel: 'gemini-pro-vision',
        processingStatus: validation.isValid ? 'PROCESSED' : 'MANUAL_REVIEW',
      },
    });
    });

    const processingTimeMs = Date.now() - startTime;

    res.status(200).json({
      receiptId: receipt.id,
      receipt: processedReceipt,
      validation,
      duplicateDetected: isDuplicate,
      provider: 'gemini',
      processingTimeMs,
      australianCompliant: processedReceipt.isGstCompliant,
      success: true,
    });
  } catch (error) {
    console.error('Receipt processing error:', error);
    res.status(500).json({ 
      error: 'Receipt processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}