import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return apiResponse.error(res, { error: 'Invalid budget ID' });
  }

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, id, session.user.id);
    case 'PUT':
      return handlePut(req, res, id, session.user.id);
    case 'DELETE':
      return handleDelete(req, res, id, session.user.id);
    default:
      return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }
}

async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  budgetId: string,
  userId: string,
) {
  try {
    const budget = await prisma.budget.findUnique({
      where: { id: budgetId },
      include: {
        budgetTracking: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        },
      },
    });

    if (!budget) {
      return apiResponse.notFound(res, { error: 'Budget not found' });
    }

    if (budget.userId !== userId) {
      return apiResponse.forbidden(res, { error: 'Forbidden' });
    }

    apiResponse.success(res, { budget });
  } catch (error) {
    logger.error('Get budget error:', error);
    apiResponse.internalError(res, { error: 'Failed to fetch budget' });
  } finally {
    await prisma.$disconnect();
  }
}

async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse,
  budgetId: string,
  userId: string,
) {
  try {
    const budget = await prisma.budget.findUnique({
      where: { id: budgetId },
    });

    if (!budget) {
      return apiResponse.notFound(res, { error: 'Budget not found' });
    }

    if (budget.userId !== userId) {
      return apiResponse.forbidden(res, { error: 'Forbidden' });
    }

    const { name, monthlyBudget, targetSavings, monthlyIncome, categoryLimits, status } = req.body;

    const updatedBudget = await prisma.budget.update({
      where: { id: budgetId },
      data: {
        name,
        monthlyBudget,
        targetSavings,
        monthlyIncome,
        categoryLimits,
        status,
        updatedAt: new Date(),
      },
    });

    apiResponse.success(res, { budget: updatedBudget });
  } catch (error) {
    logger.error('Update budget error:', error);
    apiResponse.internalError(res, { error: 'Failed to update budget' });
  } finally {
    await prisma.$disconnect();
  }
}

async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse,
  budgetId: string,
  userId: string,
) {
  try {
    const budget = await prisma.budget.findUnique({
      where: { id: budgetId },
    });

    if (!budget) {
      return apiResponse.notFound(res, { error: 'Budget not found' });
    }

    if (budget.userId !== userId) {
      return apiResponse.forbidden(res, { error: 'Forbidden' });
    }

    await prisma.budget.delete({
      where: { id: budgetId },
    });

    apiResponse.success(res, { success: true });
  } catch (error) {
    logger.error('Delete budget error:', error);
    apiResponse.internalError(res, { error: 'Failed to delete budget' });
  } finally {
    await prisma.$disconnect();
  }
}
