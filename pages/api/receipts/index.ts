import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { PrismaClient } from '../../../generated/prisma';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, session.user.id);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const { status, startDate, endDate, page = '1', limit = '20' } = req.query;

    const where: any = { userId };

    if (status) {
      where.processingStatus = status;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [receipts, total] = await Promise.all([
      prisma.receipt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.receipt.count({ where }),
    ]);

    // Calculate summary statistics
    const stats = await prisma.receipt.aggregate({
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

    res.status(200).json({
      receipts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      stats: {
        totalAmount: stats._sum.totalAmount || 0,
        totalGst: stats._sum.gstAmount || 0,
        processedCount: stats._count,
      },
    });
  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({ error: 'Failed to fetch receipts' });
  } finally {
    await prisma.$disconnect();
  }
}