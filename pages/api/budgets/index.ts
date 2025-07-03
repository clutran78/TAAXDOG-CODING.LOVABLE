import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';
import { createBudget } from '../../../lib/ai-budget-prediction';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, session.user.id);
    case 'POST':
      return handlePost(req, res, session.user.id);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const { status, includeTracking } = req.query;

    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        budgetTracking: includeTracking === 'true' ? {
          orderBy: [
            { year: 'desc' },
            { month: 'desc' },
          ],
          take: 12, // Last 12 months
        } : false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate current month variance
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    for (const budget of budgets) {
      if (budget.budgetTracking) {
        const currentTracking = budget.budgetTracking.filter(
          t => t.month === currentMonth && t.year === currentYear
        );
        
        const totalPredicted = currentTracking.reduce((sum, t) => 
          sum + parseFloat(t.predictedAmount.toString()), 0);
        const totalActual = currentTracking.reduce((sum, t) => 
          sum + parseFloat(t.actualAmount?.toString() || '0'), 0);
        
        (budget as any).currentMonthVariance = totalActual - totalPredicted;
        (budget as any).currentMonthVariancePercent = totalPredicted > 0 
          ? ((totalActual - totalPredicted) / totalPredicted) * 100 
          : 0;
      }
    }

    res.status(200).json({ budgets });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  } finally {
    await prisma.$disconnect();
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const { name, monthlyBudget, targetSavings, monthlyIncome, categoryLimits } = req.body;

    if (!name || !monthlyBudget) {
      return res.status(400).json({ error: 'Name and monthly budget are required' });
    }

    // Check for existing active budget
    const existingBudget = await prisma.budget.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    if (existingBudget) {
      // Deactivate existing budget
      await prisma.budget.update({
        where: { id: existingBudget.id },
        data: { status: 'INACTIVE' },
      });
    }

    // Create new budget with AI predictions
    const budget = await createBudget(userId, {
      name,
      monthlyBudget,
      targetSavings,
      monthlyIncome,
      categoryLimits,
    });

    res.status(201).json({
      success: true,
      budget,
      message: 'Budget created with AI predictions',
    });
  } catch (error) {
    console.error('Create budget error:', error);
    res.status(500).json({ error: 'Failed to create budget' });
  }
}