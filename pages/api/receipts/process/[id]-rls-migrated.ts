import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';
import { processReceipt } from '../../../../lib/gemini-ai';
import path from 'path';

const prisma = new PrismaClient();

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  if (req.method !== 'POST') {
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

    // Get receipt from database
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

    // Check if already processed
    if (receipt.processingStatus !== 'PENDING') {
      return res.status(400).json({ error: 'Receipt already processed' });
    }

    // Update status to processing
    await req.rlsContext.execute(async () => {
      return await prismaWithRLS.receipt.update({
      where: { id },
      data: { processingStatus: 'PROCESSING' },
    });
    });

    // Get full image path
    const imagePath = path.join(process.cwd(), receipt.imageUrl);

    // Process with Gemini AI
    const processedReceipt = await processReceipt(id, imagePath);

    res.status(200).json({
      success: true,
      receipt: processedReceipt,
    });

  } catch (error) {
    console.error('Receipt processing error:', error);
    
    // Update status to failed
    if (req.query.id) {
      await req.rlsContext.execute(async () => {
      return await prismaWithRLS.receipt.update({
        where: { id: req.query.id as string },
        data: { processingStatus: 'FAILED' },
      });
    }).catch(console.error);
    }
    
    res.status(500).json({ error: 'Failed to process receipt' });
  } finally {
    await prismaWithRLS.$disconnect();
  }
}