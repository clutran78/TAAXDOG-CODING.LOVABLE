import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';
import { getVarianceAnalysis } from '../../../../lib/budget-tracking';

const prisma = new PrismaClient();

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  const { month, year } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid budget ID' });
  }

  if (!month || !year) {
    return res.status(400).json({ error: 'Month and year are required' });
  }

  try {
    // Verify budget ownership
    const budget = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.budget.findUnique({
      where: { id },
    });
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    if (budget.userId !== session.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get variance analysis
    const analysis = await getVarianceAnalysis(
      id,
      parseInt(month as string),
      parseInt(year as string)
    );

    res.status(200).json({ analysis });
  } catch (error) {
    console.error('Get variance error:', error);
    res.status(500).json({ error: 'Failed to get variance analysis' });
  } finally {
    await prismaWithRLS.$disconnect();
  }
}