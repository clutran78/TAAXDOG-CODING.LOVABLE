import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return apiResponse.error(res, { error: 'Invalid insight ID' });
  }

  try {
    const insight = await prisma.financialInsight.findUnique({
      where: { id },
    });

    if (!insight) {
      return apiResponse.notFound(res, { error: 'Insight not found' });
    }

    if (insight.userId !== session.user.id) {
      return apiResponse.forbidden(res, { error: 'Forbidden' });
    }

    // Mark insight as inactive
    await prisma.financialInsight.update({
      where: { id },
      data: { isActive: false },
    });

    apiResponse.success(res, { success: true });
  } catch (error) {
    logger.error('Dismiss insight error:', error);
    apiResponse.internalError(res, { error: 'Failed to dismiss insight' });
  } finally {
    await prisma.$disconnect();
  }
}
