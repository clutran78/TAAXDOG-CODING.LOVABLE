import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';
import { processReceipt } from '../../../../lib/gemini-ai';
import path from 'path';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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

    // Get receipt from database
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

    // Check if already processed
    if (receipt.processingStatus !== 'PENDING') {
      return apiResponse.error(res, { error: 'Receipt already processed' });
    }

    // Update status to processing
    await prisma.receipt.update({
      where: { id },
      data: { processingStatus: 'PROCESSING' },
    });

    // Get full image path
    const imagePath = path.join(process.cwd(), receipt.imageUrl);

    // Process with Gemini AI
    const processedReceipt = await processReceipt(id, imagePath);

    apiResponse.success(res, {
      success: true,
      receipt: processedReceipt,
    });
  } catch (error) {
    logger.error('Receipt processing error:', error);

    // Update status to failed
    if (req.query.id) {
      await prisma.receipt
        .update({
          where: { id: req.query.id as string },
          data: { processingStatus: 'FAILED' },
        })
        .catch(console.error);
    }

    apiResponse.internalError(res, { error: 'Failed to process receipt' });
  } finally {
    await prisma.$disconnect();
  }
}
