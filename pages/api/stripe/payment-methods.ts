import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import authOptions from '../auth/[...nextauth]';
import { getStripe } from '@/lib/stripe/config';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import Stripe from 'stripe';

// Request validation schemas
const attachPaymentMethodSchema = z.object({
  paymentMethodId: z.string(),
  setAsDefault: z.boolean().optional().default(true),
});

const detachPaymentMethodSchema = z.object({
  paymentMethodId: z.string(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

    switch (req.method) {
      case 'GET':
        // List payment methods
        const paymentMethods = await stripe.paymentMethods.list({
          customer: subscription.stripeCustomerId,
          type: 'card',
        });

        // Get default payment method
        const customer = await stripe.customers.retrieve(subscription.stripeCustomerId) as Stripe.Customer;
        const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;

        // Format payment methods
        const formattedMethods = paymentMethods.data.map(pm => ({
          id: pm.id,
          type: pm.type,
          card: pm.card ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
            funding: pm.card.funding,
          } : null,
          created: pm.created,
          isDefault: pm.id === defaultPaymentMethodId,
        }));

        res.status(200).json({
          success: true,
          paymentMethods: formattedMethods,
        });
        break;

      case 'POST':
        // Attach payment method
        const attachValidation = attachPaymentMethodSchema.safeParse(req.body);
        if (!attachValidation.success) {
          return res.status(400).json({ 
            error: 'Invalid request data', 
            details: attachValidation.error.errors 
          });
        }

        const { paymentMethodId, setAsDefault } = attachValidation.data;

        // Attach payment method to customer
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: subscription.stripeCustomerId,
        });

        // Set as default if requested
        if (setAsDefault) {
          await stripe.customers.update(subscription.stripeCustomerId, {
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          });
        }

        res.status(200).json({
          success: true,
          message: 'Payment method added successfully',
        });
        break;

      case 'DELETE':
        // Detach payment method
        const detachValidation = detachPaymentMethodSchema.safeParse(req.body);
        if (!detachValidation.success) {
          return res.status(400).json({ 
            error: 'Invalid request data', 
            details: detachValidation.error.errors 
          });
        }

        const { paymentMethodId: methodToDetach } = detachValidation.data;

        // Check if this is the only payment method
        const allMethods = await stripe.paymentMethods.list({
          customer: subscription.stripeCustomerId,
          type: 'card',
        });

        if (allMethods.data.length === 1) {
          return res.status(400).json({
            error: 'Cannot remove the only payment method',
            message: 'Please add another payment method before removing this one',
          });
        }

        // Detach payment method
        await stripe.paymentMethods.detach(methodToDetach);

        res.status(200).json({
          success: true,
          message: 'Payment method removed successfully',
        });
        break;

      default:
        res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error: any) {
    console.error('Payment methods error:', error);
    
    res.status(500).json({ 
      error: 'Failed to manage payment methods', 
      message: error.message 
    });
  }
}