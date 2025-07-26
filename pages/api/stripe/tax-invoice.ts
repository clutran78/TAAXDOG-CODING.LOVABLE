import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { InvoiceService } from '../../../lib/stripe/invoice-service';
import { prisma } from '../../../lib/prisma';
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

    const { invoiceId } = req.query;

    if (!invoiceId || typeof invoiceId !== 'string') {
      return apiResponse.error(res, { error: 'Invoice ID is required' });
    }

    // Verify the user owns this invoice
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription) {
      return apiResponse.notFound(res, { error: 'No subscription found' });
    }

    const invoiceService = new InvoiceService();
    const taxInvoice = await invoiceService.generateTaxInvoice(invoiceId);
    const html = invoiceService.generateInvoiceHTML(taxInvoice);

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (error) {
    logger.error('Error generating tax invoice:', error);
    apiResponse.internalError(res, {
      error: 'Failed to generate tax invoice',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
