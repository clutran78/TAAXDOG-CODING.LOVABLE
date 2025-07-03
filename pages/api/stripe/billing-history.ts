import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { InvoiceService } from '../../../lib/stripe/invoice-service';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const invoiceService = new InvoiceService();
    const billingHistory = await invoiceService.getBillingHistory(session.user.id);

    res.status(200).json({ invoices: billingHistory });
  } catch (error) {
    console.error('Error fetching billing history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch billing history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}