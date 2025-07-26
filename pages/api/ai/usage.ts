import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { AIService } from '../../../lib/ai/ai-service';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return apiResponse.unauthorized(res, { error: 'Unauthorized' });
    }

    const { days = '30' } = req.query;
    const daysNumber = parseInt(days as string, 10);

    if (isNaN(daysNumber) || daysNumber < 1 || daysNumber > 365) {
      return apiResponse.error(res, { error: 'Days must be between 1 and 365' });
    }

    // Get AI service and comprehensive usage stats
    const aiService = new AIService();
    const usageStats = await aiService.getUserUsageStats(session.user.id, daysNumber);

    apiResponse.success(res, {
      success: true,
      period: {
        days: daysNumber,
        startDate: new Date(Date.now() - daysNumber * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      },
      usage: usageStats,
      currency: 'USD',
      summary: {
        totalRequests: Object.values(usageStats.byProvider).reduce(
          (sum, provider) => sum + provider.requests,
          0,
        ),
        costBreakdown: {
          anthropic: usageStats.byProvider.anthropic?.cost || 0,
          openrouter: usageStats.byProvider.openrouter?.cost || 0,
          gemini: usageStats.byProvider.gemini?.cost || 0,
        },
        mostUsedProvider:
          Object.entries(usageStats.byProvider).sort(
            ([, a], [, b]) => b.requests - a.requests,
          )[0]?.[0] || 'none',
        mostUsedOperation:
          Object.entries(usageStats.byOperation).sort(
            ([, a], [, b]) => b.requests - a.requests,
          )[0]?.[0] || 'none',
      },
    });
  } catch (error) {
    logger.error('Usage stats error:', error);
    apiResponse.internalError(res, {
      error: 'Failed to retrieve usage statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
