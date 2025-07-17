import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { InvoiceService } from '../../../lib/stripe/invoice-service';
import { prisma } from '../../../lib/prisma';

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
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

    const { invoiceId } = req.query;

    if (!invoiceId || typeof invoiceId !== 'string') {
      return res.status(400).json({ error: 'Invoice ID is required' });
    }

    // Verify the user owns this invoice
    const subscription = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.subscription.findUnique({
      where: { },
    });
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const invoiceService = new InvoiceService();
    const taxInvoice = await invoiceService.generateTaxInvoice(invoiceId);
    const html = invoiceService.generateInvoiceHTML(taxInvoice);

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (error) {
    console.error('Error generating tax invoice:', error);
    res.status(500).json({ 
      error: 'Failed to generate tax invoice',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}