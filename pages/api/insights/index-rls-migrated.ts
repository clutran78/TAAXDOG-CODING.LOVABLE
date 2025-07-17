import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { generateFinancialInsights, getActiveInsights } from '../../../lib/ai-financial-insights';

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
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
    const insights = await getActiveInsights(userId);
    
    res.status(200).json({
      insights,
      count: insights.length,
    });
  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const { insightTypes } = req.body;
    
    // Generate new insights
    const insights = await generateFinancialInsights(userId, insightTypes);
    
    res.status(201).json({
      success: true,
      insights,
      message: `Generated ${insights.length} new insights`,
    });
  } catch (error) {
    console.error('Generate insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
}