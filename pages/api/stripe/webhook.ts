import { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import Stripe from 'stripe';
import { stripe } from '../../../lib/stripe';
import { SubscriptionService } from '../../../lib/stripe/subscription-service';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export const config = {
  api: {
    bodyParser: false,
  },
};

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    logger.error('Webhook signature verification failed:', err);
    res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return;
  }

  const subscriptionService = new SubscriptionService();

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await subscriptionService.handleSubscriptionCreated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.updated':
        await subscriptionService.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.deleted':
        await subscriptionService.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'invoice.payment_succeeded':
        await subscriptionService.handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice,
        );
        break;

      case 'invoice.payment_failed':
        await subscriptionService.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.trial_will_end':
        const subscription = event.data.object as Stripe.Subscription;
        logger.info('Trial ending soon for subscription:', subscription.id);
        // TODO: Send trial ending notification email
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    apiResponse.internalError(res, { error: 'Webhook processing failed' });
  }
}
