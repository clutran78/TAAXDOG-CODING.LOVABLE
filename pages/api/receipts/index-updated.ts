import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError, getPaginationParams } from '@/lib/middleware/rls-middleware';
import prismaWithRLS from '@/lib/prisma-rls';

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  if (!req.rlsContext) {
    return res.status(500).json({ error: 'RLS context not initialized' });
  }

  switch (req.method) {
    case 'GET':
      return handleGet(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req: NextApiRequestWithRLS, res: NextApiResponse) {
  try {
    const { status, startDate, endDate } = req.query;
    const { skip, take, page: pageNum, limit: limitNum } = getPaginationParams(req);

    const where: any = {};

    if (status) {
      where.processingStatus = status;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    // Execute queries with RLS context
    const result = await req.rlsContext!.execute(async () => {
      const [receipts, total] = await Promise.all([
        prismaWithRLS.receipt.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prismaWithRLS.receipt.count({ where }),
      ]);

      // Calculate summary statistics
      const stats = await prismaWithRLS.receipt.aggregate({
        where: {
          ...where,
          processingStatus: { in: ['PROCESSED', 'MATCHED'] },
        },
        _sum: {
          totalAmount: true,
          gstAmount: true,
        },
        _count: true,
      });

      return { receipts, total, stats };
    });

    res.status(200).json({
      receipts: result.receipts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        pages: Math.ceil(result.total / limitNum),
      },
      stats: {
        totalAmount: result.stats._sum.totalAmount || 0,
        totalGst: result.stats._sum.gstAmount || 0,
        processedCount: result.stats._count,
      },
    });
  } catch (error) {
    return handleRLSError(error, res);
  }
}

export default withRLSMiddleware(handler);