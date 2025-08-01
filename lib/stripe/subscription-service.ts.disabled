import { stripe, SUBSCRIPTION_PLANS, SubscriptionPlan } from '../stripe';
import prisma from '../prisma';
import Stripe from 'stripe';

export class SubscriptionService {
  async createCheckoutSession({
    userId,
    planId,
    billingCycle,
    successUrl,
    cancelUrl,
  }: {
    userId: string;
    planId: string;
    billingCycle: 'monthly' | 'annual';
    successUrl: string;
    cancelUrl: string;
  }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const plan = SUBSCRIPTION_PLANS[planId.toUpperCase()];
    if (!plan) {
      throw new Error('Invalid plan');
    }

    let customer: Stripe.Customer;
    if (user.subscription?.stripeCustomerId) {
      customer = (await stripe.customers.retrieve(
        user.subscription.stripeCustomerId,
      )) as Stripe.Customer;
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId: user.id,
          abn: user.abn || '',
        },
      });
    }

    const priceId = billingCycle === 'annual' ? plan.annualPriceId : plan.monthlyPriceId;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'aud',
          product_data: {
            name: plan.name,
            description: plan.description,
            metadata: {
              planId: plan.id,
            },
          },
          unit_amount: billingCycle === 'annual' ? plan.annualPrice : plan.promotionalMonthlyPrice,
          recurring: billingCycle === 'annual' ? { interval: 'year' } : { interval: 'month' },
        },
        quantity: 1,
      },
    ];

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      trial_period_days: plan.trialDays,
      metadata: {
        userId: user.id,
        planId: plan.id,
        promotionalMonths: billingCycle === 'monthly' ? plan.promotionalMonths.toString() : '0',
      },
    };

    if (billingCycle === 'monthly' && plan.promotionalMonths > 0) {
      subscriptionData.trial_end = Math.floor(Date.now() / 1000) + plan.trialDays * 24 * 60 * 60;
      subscriptionData.add_invoice_items = [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: `${plan.name} - Regular Price (after promotional period)`,
            },
            unit_amount: plan.monthlyPrice,
            recurring: { interval: 'month' },
          },
        },
      ];
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: subscriptionData,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      tax_id_collection: {
        enabled: true,
      },
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      locale: 'en',
      metadata: {
        userId: user.id,
      },
    });

    return session;
  }

  async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    const userId = subscription.metadata.userId;
    if (!userId) {
      throw new Error('No userId in subscription metadata');
    }

    const planId = subscription.metadata.planId || 'smart';
    const plan = SUBSCRIPTION_PLANS[planId.toUpperCase()];

    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0].price.id,
        status: this.mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        plan: planId.toUpperCase() as 'SMART' | 'PRO',
        interval: subscription.items.data[0].price.recurring?.interval || 'month',
        amount: subscription.items.data[0].price.unit_amount || 0,
        currency: subscription.currency,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      },
      update: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0].price.id,
        status: this.mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        plan: planId.toUpperCase() as 'SMART' | 'PRO',
        interval: subscription.items.data[0].price.recurring?.interval || 'month',
        amount: subscription.items.data[0].price.unit_amount || 0,
        currency: subscription.currency,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      },
    });

    if (
      subscription.metadata.promotionalMonths &&
      parseInt(subscription.metadata.promotionalMonths) > 0
    ) {
      await this.schedulePromotionalPriceEnd(subscription);
    }
  }

  async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    await this.handleSubscriptionCreated(subscription);
  }

  async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const userId = subscription.metadata.userId;
    if (!userId) return;

    await prisma.subscription.update({
      where: { userId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });
  }

  async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    if (!invoice.subscription || !invoice.customer) return;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const invoiceCount = await this.getInvoiceCount(subscription.id);

    if (subscription.metadata.promotionalMonths) {
      const promotionalMonths = parseInt(subscription.metadata.promotionalMonths);
      if (invoiceCount === promotionalMonths + 1) {
        await this.transitionToRegularPricing(subscription);
      }
    }

    await prisma.payment.create({
      data: {
        userId: subscription.metadata.userId!,
        stripePaymentIntentId: invoice.payment_intent as string,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'SUCCEEDED',
        description: `Subscription payment for ${subscription.metadata.planId}`,
      },
    });
  }

  async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    if (!invoice.subscription || !invoice.customer) return;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

    await prisma.payment.create({
      data: {
        userId: subscription.metadata.userId!,
        stripePaymentIntentId: invoice.payment_intent as string,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: 'FAILED',
        description: `Failed payment for ${subscription.metadata.planId}`,
      },
    });

    // TODO: Send failed payment notification email
  }

  async createBillingPortalSession(userId: string, returnUrl: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.stripeCustomerId) {
      throw new Error('No subscription found');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
      locale: 'en',
    });

    return session;
  }

  private async schedulePromotionalPriceEnd(subscription: Stripe.Subscription) {
    const promotionalMonths = parseInt(subscription.metadata.promotionalMonths || '0');
    if (promotionalMonths === 0) return;

    const transitionDate = new Date(subscription.current_period_start * 1000);
    transitionDate.setMonth(transitionDate.getMonth() + promotionalMonths);

    await stripe.subscriptions.update(subscription.id, {
      metadata: {
        ...subscription.metadata,
        promotionalPriceEndDate: transitionDate.toISOString(),
      },
    });
  }

  private async transitionToRegularPricing(subscription: Stripe.Subscription) {
    const planId = subscription.metadata.planId || 'smart';
    const plan = SUBSCRIPTION_PLANS[planId.toUpperCase()];

    if (!plan) return;

    const priceData = {
      currency: 'aud',
      product: subscription.items.data[0].price.product as string,
      unit_amount: plan.monthlyPrice,
      recurring: { interval: 'month' as const },
    };

    const price = await stripe.prices.create(priceData);

    await stripe.subscriptions.update(subscription.id, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: price.id,
        },
      ],
      proration_behavior: 'none',
    });
  }

  private async getInvoiceCount(subscriptionId: string): Promise<number> {
    const invoices = await stripe.invoices.list({
      subscription: subscriptionId,
      status: 'paid',
    });

    return invoices.data.length;
  }

  private mapStripeStatus(status: Stripe.Subscription.Status): string {
    const statusMap: Record<Stripe.Subscription.Status, string> = {
      active: 'ACTIVE',
      canceled: 'CANCELLED',
      incomplete: 'INCOMPLETE',
      incomplete_expired: 'EXPIRED',
      past_due: 'PAST_DUE',
      trialing: 'TRIALING',
      unpaid: 'UNPAID',
      paused: 'PAUSED',
    };

    return statusMap[status] || 'UNKNOWN';
  }
}
