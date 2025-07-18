import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient, FinancialOperation } from '@prisma/client';
import { createAuditLog } from '@/lib/services/auditLogger';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schema
const processReceiptSchema = z.object({
  imageUrl: z.string().url(),
  merchant: z.string().optional(),
  totalAmount: z.number().positive(),
  gstAmount: z.number().min(0).optional(),
  date: z.string().datetime(),
  items: z.array(z.object({
    description: z.string(),
    amount: z.number(),
    gstIncluded: z.boolean().optional()
  })).optional()
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // Validate request body
    const validatedData = processReceiptSchema.parse(req.body);
    
    // Create receipt record
    const receipt = await prisma.receipt.create({
      data: {
        userId: session.user.id,
        imageUrl: validatedData.imageUrl,
        merchant: validatedData.merchant,
        totalAmount: validatedData.totalAmount,
        gstAmount: validatedData.gstAmount || (validatedData.totalAmount * 0.0909), // Calculate GST if not provided (10/110)
        date: new Date(validatedData.date),
        items: validatedData.items || null,
        processingStatus: 'PROCESSING',
        aiProcessed: true,
        aiProvider: 'anthropic',
        aiModel: 'claude-3',
        aiConfidence: 0.95
      }
    });
    
    // Create audit log for receipt upload
    await createAuditLog({
      userId: session.user.id,
      operationType: FinancialOperation.RECEIPT_UPLOAD,
      resourceType: 'Receipt',
      resourceId: receipt.id,
      currentData: {
        id: receipt.id,
        merchant: receipt.merchant,
        totalAmount: Number(receipt.totalAmount),
        gstAmount: Number(receipt.gstAmount),
        date: receipt.date,
        itemCount: validatedData.items?.length || 0
      },
      amount: Number(receipt.totalAmount),
      gstAmount: Number(receipt.gstAmount),
      success: true
    }, {
      request: req,
      sessionId: session.user.id
    });
    
    // Simulate AI processing
    setTimeout(async () => {
      try {
        // Update receipt status after processing
        const processedReceipt = await prisma.receipt.update({
          where: { id: receipt.id },
          data: {
            processingStatus: 'PROCESSED',
            taxCategory: 'Business Expense',
            isGstRegistered: true
          }
        });
        
        // Create audit log for processing completion
        await createAuditLog({
          userId: session.user.id,
          operationType: FinancialOperation.RECEIPT_PROCESS,
          resourceType: 'Receipt',
          resourceId: receipt.id,
          previousData: receipt,
          currentData: processedReceipt,
          amount: Number(processedReceipt.totalAmount),
          gstAmount: Number(processedReceipt.gstAmount),
          success: true
        }, {
          sessionId: session.user.id
        });
      } catch (error: any) {
        console.error('Receipt processing error:', error);
        
        // Log processing failure
        await createAuditLog({
          userId: session.user.id,
          operationType: FinancialOperation.RECEIPT_PROCESS,
          resourceType: 'Receipt',
          resourceId: receipt.id,
          success: false,
          errorMessage: error.message
        }, {
          sessionId: session.user.id
        });
      }
    }, 2000);
    
    return res.status(201).json({
      success: true,
      data: {
        id: receipt.id,
        status: receipt.processingStatus,
        message: 'Receipt uploaded and processing'
      }
    });
    
  } catch (error: any) {
    // Log the failure
    await createAuditLog({
      userId: session.user.id,
      operationType: FinancialOperation.RECEIPT_UPLOAD,
      resourceType: 'Receipt',
      currentData: req.body,
      success: false,
      errorMessage: error.message
    }, {
      request: req,
      sessionId: session.user.id
    });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    
    console.error('Receipt upload error:', error);
    return res.status(500).json({
      error: 'Failed to process receipt'
    });
  }
}