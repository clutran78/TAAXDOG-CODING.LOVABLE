import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { ReportCommentaryService } from '../../../lib/ai/services/report-commentary';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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

    const { reportType, data, options } = req.body;

    if (!reportType || !data) {
      return res.status(400).json({ error: 'Report type and data are required' });
    }

    const commentaryService = new ReportCommentaryService();
    let result;

    switch (reportType) {
      case 'taxReturn':
        result = await commentaryService.generateTaxReturnCommentary(
          session.user.id,
          data
        );
        break;

      case 'financial':
        if (!data.reportType) {
          return res.status(400).json({ error: 'Financial report type required' });
        }
        result = await commentaryService.generateFinancialReportNarrative(
          session.user.id,
          data.reportType,
          data.reportData
        );
        break;

      case 'investment':
        result = await commentaryService.generateInvestmentPerformanceCommentary(
          session.user.id,
          data
        );
        break;

      case 'benchmark':
        result = await commentaryService.generateBenchmarkComparison(
          session.user.id,
          data
        );
        break;

      case 'custom':
        if (!data.title) {
          return res.status(400).json({ error: 'Report title required' });
        }
        result = await commentaryService.generateCustomReport(
          session.user.id,
          data.title,
          data.reportData,
          options
        );
        break;

      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Report commentary error:', error);
    res.status(500).json({ 
      error: 'Report commentary generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}