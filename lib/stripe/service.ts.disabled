import prisma from '../prisma';
import { getStripe, SUBSCRIPTION_PLANS, GST_CONFIG, calculateGSTFromTotal } from './config';
import type { User, Subscription, Plan } from '@prisma/client';
import Stripe from 'stripe';

export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = getStripe().stripe;
  }

  // Create a Stripe customer
  async createCustomer(user: User): Promise<Stripe.Customer> {
    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user.id,
        abn: user.abn || '',
        taxResidency: user.taxResidency,
      },
    });

    return customer;
  }

  // Get or create Stripe customer
  async getOrCreateCustomer(userId: string): Promise<Stripe.Customer> {
    // Check if user already has a subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (subscription?.stripeCustomerId) {
      return (await this.stripe.customers.retrieve(
        subscription.stripeCustomerId,
      )) as Stripe.Customer;
    }

    // Create new customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return await this.createCustomer(user);
  }

  // Create a checkout session for subscription
  async createCheckoutSession({
    userId,
    plan,
    successUrl,
    cancelUrl,
  }: {
    userId: string;
    plan: 'SMART' | 'PRO';
    successUrl: string;
    cancelUrl: string;
  }): Promise<Stripe.Checkout.Session> {
    const customer = await this.getOrCreateCustomer(userId);
    const planConfig = SUBSCRIPTION_PLANS[plan];

    // Create line items for checkout
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: planConfig.prices.promotional.stripePriceId,
        quantity: 1,
      },
    ];

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        trial_period_days: planConfig.prices.trial.days,
        metadata: {
          userId,
          plan,
        },
      },
      metadata: {
        userId,
        plan,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      tax_id_collection: {
        enabled: true,
      },
    });

    return session;
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const subscription = await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // Update database
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      },
    });

    return subscription;
  }

  // Reactivate subscription
  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const subscription = await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    // Update database
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: {
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
    });

    return subscription;
  }

  // Update subscription (change plan)
  async updateSubscription(
    subscriptionId: string,
    newPlan: 'SMART' | 'PRO',
  ): Promise<Stripe.Subscription> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const planConfig = SUBSCRIPTION_PLANS[newPlan];

    // Update subscription with new price
    const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: planConfig.prices.regular.stripePriceId,
        },
      ],
      proration_behavior: 'always_invoice',
    });

    // Update database
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: {
        plan: newPlan as Plan,
        stripePriceId: planConfig.prices.regular.stripePriceId,
      },
    });

    return updatedSubscription;
  }

  // Create portal session for customer to manage subscription
  async createPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<Stripe.BillingPortal.Session> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session;
  }

  // Generate tax invoice (Australian compliance)
  async generateTaxInvoice(invoiceId: string): Promise<any> {
    const invoice = await this.stripe.invoices.retrieve(invoiceId, {
      expand: ['customer', 'subscription'],
    });

    const customer = invoice.customer as Stripe.Customer;
    const { gstAmount, amountExGST } = calculateGSTFromTotal(invoice.total);

    // Create invoice record in database
    const dbInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${invoice.number}`,
        stripeInvoiceId: invoice.id,
        customerName: customer.name || customer.email,
        customerEmail: customer.email!,
        customerABN: customer.metadata?.abn || null,
        subtotal: amountExGST,
        gstAmount: gstAmount,
        total: invoice.total,
        status: invoice.status || 'draft',
        invoiceDate: new Date(invoice.created * 1000),
        paidAt: invoice.paid ? new Date(invoice.status_transitions.paid_at! * 1000) : null,
        lineItems: {
          create: invoice.lines.data.map((line) => ({
            description: line.description || 'Subscription',
            quantity: line.quantity || 1,
            unitPrice: line.price?.unit_amount || 0,
            totalPrice: line.amount,
          })),
        },
      },
      include: {
        lineItems: true,
      },
    });

    return dbInvoice;
  }

  // Sync subscription from Stripe webhook
  async syncSubscriptionFromWebhook(stripeSubscription: Stripe.Subscription): Promise<void> {
    const userId = stripeSubscription.metadata.userId;
    if (!userId) {
      throw new Error('No userId in subscription metadata');
    }

    const plan = stripeSubscription.metadata.plan as 'SMART' | 'PRO';
    const priceId = stripeSubscription.items.data[0].price.id;

    // Upsert subscription
    await prisma.subscription.upsert({
      where: { stripeSubscriptionId: stripeSubscription.id },
      create: {
        userId,
        stripeCustomerId: stripeSubscription.customer as string,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: priceId,
        status: stripeSubscription.status,
        plan: plan as Plan,
        interval: stripeSubscription.items.data[0].price.recurring?.interval || 'month',
        amount: stripeSubscription.items.data[0].price.unit_amount || 0,
        currency: stripeSubscription.currency,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        cancelledAt: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : null,
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
      },
      update: {
        status: stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        cancelledAt: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : null,
      },
    });
  }

  // Handle failed payment
  async handleFailedPayment(invoiceId: string): Promise<void> {
    const invoice = await this.stripe.invoices.retrieve(invoiceId);
    const subscriptionId = invoice.subscription as string;

    if (subscriptionId) {
      // Update subscription in database
      await prisma.subscription.update({
        where: { stripeSubscriptionId: subscriptionId },
        data: {
          lastPaymentAttempt: new Date(),
          failedPaymentCount: {
            increment: 1,
          },
        },
      });

      // TODO: Send payment failure email to customer
    }
  }

  // Get subscription details
  async getSubscriptionDetails(userId: string): Promise<Subscription | null> {
    return await prisma.subscription.findUnique({
      where: { userId },
    });
  }

  // Check if user has active subscription
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) return false;

    const activeStatuses = ['active', 'trialing'];
    return activeStatuses.includes(subscription.status) && !subscription.cancelAtPeriodEnd;
  }
}

// Export singleton instance
export const stripeService = new StripeService();
