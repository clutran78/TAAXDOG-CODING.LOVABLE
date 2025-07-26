import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { ReportCommentaryService } from '../../../lib/ai/services/report-commentary';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return apiResponse.unauthorized(res, { error: 'Unauthorized' });
    }

    const { reportType, data, options } = req.body;

    if (!reportType || !data) {
      return apiResponse.error(res, { error: 'Report type and data are required' });
    }

    const commentaryService = new ReportCommentaryService();
    let result;

    switch (reportType) {
      case 'taxReturn':
        result = await commentaryService.generateTaxReturnCommentary(session.user.id, data);
        break;

      case 'financial':
        if (!data.reportType) {
          return apiResponse.error(res, { error: 'Financial report type required' });
        }
        result = await commentaryService.generateFinancialReportNarrative(
          session.user.id,
          data.reportType,
          data.reportData,
        );
        break;

      case 'investment':
        result = await commentaryService.generateInvestmentPerformanceCommentary(
          session.user.id,
          data,
        );
        break;

      case 'benchmark':
        result = await commentaryService.generateBenchmarkComparison(session.user.id, data);
        break;

      case 'custom':
        if (!data.title) {
          return apiResponse.error(res, { error: 'Report title required' });
        }
        result = await commentaryService.generateCustomReport(
          session.user.id,
          data.title,
          data.reportData,
          options,
        );
        break;

      default:
        return apiResponse.error(res, { error: 'Invalid report type' });
    }

    apiResponse.success(res, result);
  } catch (error) {
    logger.error('Report commentary error:', error);
    apiResponse.internalError(res, {
      error: 'Report commentary generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
