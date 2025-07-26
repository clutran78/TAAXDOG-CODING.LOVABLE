import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { generateFinancialInsights, getActiveInsights } from '../../../lib/ai-financial-insights';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, session.user.id);
    case 'POST':
      return handlePost(req, res, session.user.id);
    default:
      return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const insights = await getActiveInsights(userId);

    apiResponse.success(res, {
      insights,
      count: insights.length,
    });
  } catch (error) {
    logger.error('Get insights error:', error);
    apiResponse.internalError(res, { error: 'Failed to fetch insights' });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const { insightTypes } = req.body;

    // Generate new insights
    const insights = await generateFinancialInsights(userId, insightTypes);

    apiResponse.created(res, {
      success: true,
      insights,
      message: `Generated ${insights.length} new insights`,
    });
  } catch (error) {
    logger.error('Generate insights error:', error);
    apiResponse.internalError(res, { error: 'Failed to generate insights' });
  }
}
