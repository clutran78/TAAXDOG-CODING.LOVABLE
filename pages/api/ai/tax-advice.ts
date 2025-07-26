import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { taxConsultant } from '../../../lib/ai/services/tax-consultation';
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

    const { query, context, operation = 'consult' } = req.body;

    if (!query && operation === 'consult') {
      return apiResponse.error(res, { error: 'Query is required' });
    }

    let result;

    switch (operation) {
      case 'consult':
        // General tax consultation using Anthropic Claude
        result = await taxConsultant.consultTaxQuery(session.user.id, query, context);
        break;

      case 'analyzeDeductions':
        // Analyze expenses for deductibility
        const { expenses } = req.body;
        if (!expenses || !Array.isArray(expenses)) {
          return apiResponse.error(res, {
            error: 'Expenses array is required for deduction analysis',
          });
        }

        result = await taxConsultant.analyzeDeductions(session.user.id, expenses);
        break;

      case 'generateStrategy':
        // Generate tax optimization strategy
        const { financialData } = req.body;
        if (!financialData) {
          return apiResponse.error(res, {
            error: 'Financial data is required for strategy generation',
          });
        }

        result = await taxConsultant.generateTaxStrategy(session.user.id, financialData);
        break;

      default:
        return apiResponse.error(res, { error: 'Invalid operation' });
    }

    apiResponse.success(res, {
      success: true,
      result,
      provider: 'anthropic',
      australianCompliant: true,
    });
  } catch (error) {
    logger.error('Tax advice error:', error);
    apiResponse.internalError(res, {
      error: 'Tax advice generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
