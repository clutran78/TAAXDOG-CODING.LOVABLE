import { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/config';
import { subscriptionManager } from '@/lib/stripe/subscription-manager';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

// Disable body parsing, we need raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Webhook event handlers
const webhookHandlers: Record<string, (event: Stripe.Event) => Promise<void>> = {
  'customer.subscription.created': handleSubscriptionCreated,
  'customer.subscription.updated': handleSubscriptionUpdated,
  'customer.subscription.deleted': handleSubscriptionDeleted,
  'customer.subscription.trial_will_end': handleTrialWillEnd,
  'invoice.paid': handleInvoicePaid,
  'invoice.payment_failed': handleInvoicePaymentFailed,
  'payment_method.attached': handlePaymentMethodAttached,
  'payment_method.detached': handlePaymentMethodDetached,
  'checkout.session.completed': handleCheckoutCompleted,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    return apiResponse.error(res, { error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    const { stripe, webhookSecret } = getStripe();
    event = stripe.webhooks.constructEvent(buf, signature, webhookSecret);
  } catch (err: any) {
    logger.error('Webhook signature verification failed:', err.message);
    return apiResponse.error(res, { error: `Webhook Error: ${err.message}` });
  }

  // Log webhook event
  try {
    await prisma.auditLog.create({
      data: {
        event: 'STRIPE_WEBHOOK' as any,
        ipAddress: (req.headers['x-forwarded-for'] as string) || 'unknown',
        metadata: {
          eventType: event.type,
          eventId: event.id,
          liveMode: event.livemode,
        },
        success: true,
      },
    });
  } catch (error) {
    logger.error('Failed to log webhook event:', error);
  }

  // Handle the event
  try {
    const handler = webhookHandlers[event.type];
    if (handler) {
      await handler(event);
    } else {
      logger.info(`Unhandled webhook event type: ${event.type}`);
    }

    apiResponse.success(res, { received: true });
  } catch (error: any) {
    logger.error(`Error handling webhook ${event.type}:`, error);
    apiResponse.internalError(res, { error: `Webhook handler error: ${error.message}` });
  }
}

// Webhook handler functions
async function handleSubscriptionCreated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  await subscriptionManager.handleWebhookEvent(event);
  logger.info(`Subscription created: ${subscription.id}`);
}

async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  await subscriptionManager.handleWebhookEvent(event);
  logger.info(`Subscription updated: ${subscription.id}`);
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  await subscriptionManager.handleWebhookEvent(event);
  logger.info(`Subscription deleted: ${subscription.id}`);
}

async function handleTrialWillEnd(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  await subscriptionManager.handleWebhookEvent(event);

  // Send trial ending notification email
  const userId = subscription.metadata.userId;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      // TODO: Implement email notification
      logger.info(`Trial ending notification for user: ${user.email}`);
    }
  }
}

async function handleInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  await subscriptionManager.handleWebhookEvent(event);
  logger.info(`Invoice paid: ${invoice.id}`);
}

async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  await subscriptionManager.handleWebhookEvent(event);

  // Send payment failed notification
  if (invoice.subscription) {
    const subscription = await getStripe().stripe.subscriptions.retrieve(
      invoice.subscription as string,
    );

    const userId = subscription.metadata.userId;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (user) {
        // TODO: Implement email notification
        logger.info(`Payment failed notification for user: ${user.email}`);
      }
    }
  }
}

async function handlePaymentMethodAttached(event: Stripe.Event) {
  const paymentMethod = event.data.object as Stripe.PaymentMethod;
  logger.info(`Payment method attached: ${paymentMethod.id}`);

  // Update default payment method if needed
  if (paymentMethod.customer) {
    const { stripe } = getStripe();
    await stripe.customers.update(paymentMethod.customer as string, {
      invoice_settings: {
        default_payment_method: paymentMethod.id,
      },
    });
  }
}

async function handlePaymentMethodDetached(event: Stripe.Event) {
  const paymentMethod = event.data.object as Stripe.PaymentMethod;
  logger.info(`Payment method detached: ${paymentMethod.id}`);
}

async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  logger.info(`Checkout completed: ${session.id}`);

  // Handle successful checkout
  if (session.mode === 'subscription' && session.subscription) {
    const subscription = await getStripe().stripe.subscriptions.retrieve(
      session.subscription as string,
    );

    await subscriptionManager.handleWebhookEvent({
      ...event,
      type: 'customer.subscription.created',
      data: { object: subscription },
    });
  }
}
