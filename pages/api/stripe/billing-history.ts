import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { InvoiceService } from '../../../lib/stripe/invoice-service';
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

    const invoiceService = new InvoiceService();
    const billingHistory = await invoiceService.getBillingHistory(session.user.id);

    apiResponse.success(res, { invoices: billingHistory });
  } catch (error) {
    logger.error('Error fetching billing history:', error);
    apiResponse.internalError(res, {
      error: 'Failed to fetch billing history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
