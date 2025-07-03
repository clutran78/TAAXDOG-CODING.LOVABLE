import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getStripe } from '@/lib/stripe/config';
import { prisma } from '@/lib/prisma';
import { subscriptionManager } from '@/lib/stripe/subscription-manager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription || !subscription.stripeCustomerId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const { stripe } = getStripe();
    
    // Get query parameters
    const { limit = 10, starting_after } = req.query;

    // Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: subscription.stripeCustomerId,
      limit: Number(limit),
      starting_after: starting_after as string,
      expand: ['data.subscription'],
    });

    // Format invoices for response
    const formattedInvoices = await Promise.all(
      invoices.data.map(async (invoice) => {
        // Generate tax invoice if paid
        if (invoice.status === 'paid' && !invoice.metadata.tax_invoice) {
          try {
            await subscriptionManager.generateTaxInvoice(invoice.id);
          } catch (error) {
            console.error('Failed to generate tax invoice:', error);
          }
        }

        // Calculate GST components
        const gstAmount = Math.round(invoice.total / 11);
        const amountExGST = invoice.total - gstAmount;

        return {
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          amount: invoice.total,
          amountPaid: invoice.amount_paid,
          amountDue: invoice.amount_due,
          currency: invoice.currency,
          created: invoice.created,
          dueDate: invoice.due_date,
          paidAt: invoice.status_transitions.paid_at,
          periodStart: invoice.period_start,
          periodEnd: invoice.period_end,
          hosted_invoice_url: invoice.hosted_invoice_url,
          invoice_pdf: invoice.invoice_pdf,
          gst: {
            amount: gstAmount,
            rate: 0.10,
            amountExGST: amountExGST,
          },
          lines: invoice.lines.data.map(line => ({
            description: line.description,
            amount: line.amount,
            period: {
              start: line.period.start,
              end: line.period.end,
            },
          })),
        };
      })
    );

    // Return invoices
    res.status(200).json({
      success: true,
      invoices: formattedInvoices,
      has_more: invoices.has_more,
    });

  } catch (error: any) {
    console.error('Get invoices error:', error);
    
    res.status(500).json({ 
      error: 'Failed to retrieve invoices', 
      message: error.message 
    });
  }
}