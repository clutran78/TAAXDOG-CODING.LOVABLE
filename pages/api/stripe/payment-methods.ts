import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
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
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { PaymentService } from '../../../lib/stripe/payment-service';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const paymentService = new PaymentService();

  try {
    switch (req.method) {
      case 'GET':
        const paymentMethods = await paymentService.getPaymentMethods(session.user.id);
        return res.status(200).json({ paymentMethods });

      case 'POST':
        const { paymentMethodId } = req.body;
        if (!paymentMethodId) {
          return res.status(400).json({ error: 'Payment method ID is required' });
        }
        
        const result = await paymentService.addPaymentMethod(session.user.id, paymentMethodId);
        return res.status(200).json(result);

      case 'PUT':
        const { paymentMethodId: defaultMethodId } = req.body;
        if (!defaultMethodId) {
          return res.status(400).json({ error: 'Payment method ID is required' });
        }
        
        const setDefaultResult = await paymentService.setDefaultPaymentMethod(
          session.user.id, 
          defaultMethodId
        );
        return res.status(200).json(setDefaultResult);

      case 'DELETE':
        const { paymentMethodId: deleteMethodId } = req.query;
        if (!deleteMethodId || typeof deleteMethodId !== 'string') {
          return res.status(400).json({ error: 'Payment method ID is required' });
        }
        
        const deleteResult = await paymentService.removePaymentMethod(
          session.user.id, 
          deleteMethodId
        );
        return res.status(200).json(deleteResult);

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end('Method Not Allowed');
    }
  } catch (error) {
    console.error('Payment method error:', error);
    return res.status(500).json({ 
      error: 'Payment method operation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}