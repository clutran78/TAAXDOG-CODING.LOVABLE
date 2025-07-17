import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { financialInsightsService } from '../../../lib/ai/services/financial-insights';

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { 
      businessId, 
      timeframe = 'month',
      insightTypes = ['all'] 
    } = req.body;

    // Generate comprehensive insights using multi-provider system
    const insights = await financialInsightsService.generateInsights(
      session.user.id,
      businessId,
      timeframe
    );

    // Filter insights if specific types requested
    let filteredInsights = insights;
    if (!insightTypes.includes('all')) {
      filteredInsights = insights.filter(insight => 
        insightTypes.includes(insight.type)
      );
    }

    // Group insights by type for better organization
    const groupedInsights = filteredInsights.reduce((acc, insight) => {
      if (!acc[insight.type]) {
        acc[insight.type] = [];
      }
      acc[insight.type].push(insight);
      return acc;
    }, {} as Record<string, typeof insights>);

    // Calculate total potential impact
    const totalImpact = filteredInsights.reduce((sum, insight) => {
      if (insight.impact?.amount && insight.impact.frequency === 'monthly') {
        return sum + insight.impact.amount;
      } else if (insight.impact?.amount && insight.impact.frequency === 'yearly') {
        return sum + (insight.impact.amount / 12);
      }
      return sum;
    }, 0);

    res.status(200).json({
      success: true,
      insights: filteredInsights,
      groupedInsights,
      summary: {
        totalInsights: filteredInsights.length,
        highPriority: filteredInsights.filter(i => i.priority === 'high').length,
        mediumPriority: filteredInsights.filter(i => i.priority === 'medium').length,
        lowPriority: filteredInsights.filter(i => i.priority === 'low').length,
        estimatedMonthlyImpact: totalImpact,
      },
      metadata: {
        generatedAt: new Date(),
        timeframe,
        userId: session.user.id,
        businessId,
      },
    });
  } catch (error) {
    console.error('Insights generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate insights',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}