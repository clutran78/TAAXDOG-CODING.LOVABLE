import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid budget ID' });
  }

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, id, session.user.id);
    case 'PUT':
      return handlePut(req, res, id, session.user.id);
    case 'DELETE':
      return handleDelete(req, res, id, session.user.id);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  budgetId: string,
  userId: string
) {
  try {
    const budget = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.budget.findUnique({
      where: { id: budgetId },
      include: {
        budgetTracking: {
          orderBy: [
            { year: 'desc' },
            { month: 'desc' },
          ],
        },
      },
    });
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    if (budget.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.status(200).json({ budget });
  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({ error: 'Failed to fetch budget' });
  } finally {
    await prismaWithRLS.$disconnect();
  }
}

async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse,
  budgetId: string,
  userId: string
) {
  try {
    const budget = await req.rlsContext.execute(async () => {
      return await req.rlsContext.execute(async () => {
      return await prismaWithRLS.budget.findUnique({
      where: { id: budgetId },
    });
    });
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    if (budget.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const {
      name,
      monthlyBudget,
      targetSavings,
      monthlyIncome,
      categoryLimits,
      status,
    } = req.body;

    const updatedBudget = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.budget.update({
      where: { id: budgetId },
      data: {
        name,
        monthlyBudget,
        targetSavings,
        monthlyIncome,
        categoryLimits,
        status,
        updatedAt: new Date(),
    }),
      },
    });

    res.status(200).json({ budget: updatedBudget });
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  } finally {
    await prismaWithRLS.$disconnect();
  }
}

async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse,
  budgetId: string,
  userId: string
) {
  try {
    const budget = await prismaWithRLS.budget.findUnique({
      where: { id: budgetId },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    if (budget.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await req.rlsContext.execute(async () => {
      return await prismaWithRLS.budget.delete({
      where: { id: budgetId },
    });
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  } finally {
    await prismaWithRLS.$disconnect();
  }
}