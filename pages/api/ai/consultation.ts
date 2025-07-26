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

    const { query, context, operation } = req.body;

    if (!query) {
      return apiResponse.error(res, { error: 'Query is required' });
    }

    let result;

    switch (operation) {
      case 'consult':
        result = await taxConsultant.consultTaxQuery(session.user.id, query, context);
        break;

      case 'analyzeDeductions':
        if (!req.body.expenses) {
          return apiResponse.error(res, { error: 'Expenses data required' });
        }
        result = await taxConsultant.analyzeDeductions(session.user.id, req.body.expenses);
        break;

      case 'generateStrategy':
        if (!req.body.financialData) {
          return apiResponse.error(res, { error: 'Financial data required' });
        }
        result = await taxConsultant.generateTaxStrategy(session.user.id, req.body.financialData);
        break;

      default:
        return apiResponse.error(res, { error: 'Invalid operation' });
    }

    apiResponse.success(res, result);
  } catch (error) {
    logger.error('Tax consultation error:', error);
    apiResponse.internalError(res, {
      error: 'Tax consultation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
