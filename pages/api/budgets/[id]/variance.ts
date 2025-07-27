import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';
import { getVarianceAnalysis } from '../../../../lib/services/budget/budget-tracking';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  const { id } = req.query;
  const { month, year } = req.query;

  if (!id || typeof id !== 'string') {
    return apiResponse.error(res, { error: 'Invalid budget ID' });
  }

  if (!month || !year) {
    return apiResponse.error(res, { error: 'Month and year are required' });
  }

  try {
    // Verify budget ownership
    const budget = await prisma.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      return apiResponse.notFound(res, { error: 'Budget not found' });
    }

    if (budget.userId !== session.user.id) {
      return apiResponse.forbidden(res, { error: 'Forbidden' });
    }

    // Get variance analysis
    const analysis = await getVarianceAnalysis(
      id,
      parseInt(month as string),
      parseInt(year as string),
    );

    apiResponse.success(res, { analysis });
  } catch (error) {
    logger.error('Get variance error:', error);
    apiResponse.internalError(res, { error: 'Failed to get variance analysis' });
  } finally {
    await prisma.$disconnect();
  }
}
