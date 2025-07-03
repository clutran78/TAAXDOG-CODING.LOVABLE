import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { financialInsightsService } from '../../../lib/ai/services/financial-insights';
import { AIInsightType } from '../../../lib/ai/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }


  try {
    switch (req.method) {
      case 'POST':
        const { type, data } = req.body;

        if (!type || !data) {
          return res.status(400).json({ error: 'Type and data are required' });
        }

        let insights;

        switch (type) {
          case 'cashFlow':
            insights = await financialInsightsService.generateCashFlowInsights(
              session.user.id,
              data.transactions,
              data.period
            );
            break;

          case 'expenses':
            insights = await financialInsightsService.analyzeExpensePatterns(
              session.user.id,
              data.expenses
            );
            break;

          case 'business':
            insights = await financialInsightsService.generateBusinessPerformanceInsights(
              session.user.id,
              data.businessData
            );
            break;

          case 'taxSavings':
            insights = await financialInsightsService.identifyTaxSavingOpportunities(
              session.user.id,
              data.financialProfile
            );
            break;

          case 'compliance':
            insights = await financialInsightsService.detectComplianceRisks(
              session.user.id,
              data.taxData
            );
            break;

          default:
            return res.status(400).json({ error: 'Invalid insight type' });
        }

        return res.status(200).json({ insights });

      case 'GET':
        const { types } = req.query;
        const typeArray = types 
          ? (Array.isArray(types) ? types : [types]) as AIInsightType[]
          : undefined;

        const activeInsights = await financialInsightsService.getActiveInsights(
          session.user.id,
          typeArray
        );

        return res.status(200).json({ insights: activeInsights });

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end('Method Not Allowed');
    }
  } catch (error) {
    console.error('Insights generation error:', error);
    return res.status(500).json({ 
      error: 'Insights generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}