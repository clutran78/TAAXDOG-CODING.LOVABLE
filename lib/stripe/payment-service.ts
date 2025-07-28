import { stripe } from '../stripe';
import prisma from '../prisma';
import Stripe from 'stripe';
import { logger } from '@/lib/logger';

export class PaymentService {
  async getPaymentMethods(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.stripeCustomerId) {
      return [];
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: subscription.stripeCustomerId,
      type: 'card',
    });

    return paymentMethods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
      isDefault: pm.id === subscription.defaultPaymentMethodId,
    }));
  }

  async addPaymentMethod(userId: string, paymentMethodId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.stripeCustomerId) {
      throw new Error('No subscription found');
    }

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: subscription.stripeCustomerId,
    });

    // Set as default if no default exists
    if (!subscription.defaultPaymentMethodId) {
      await this.setDefaultPaymentMethod(userId, paymentMethodId);
    }

    return { success: true };
  }

  async setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.stripeCustomerId) {
      throw new Error('No subscription found');
    }

    // Update Stripe customer default payment method
    await stripe.customers.update(subscription.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Update all active subscriptions
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        default_payment_method: paymentMethodId,
      });
    }

    // Update database
    await prisma.subscription.update({
      where: { userId },
      data: { defaultPaymentMethodId: paymentMethodId },
    });

    return { success: true };
  }

  async removePaymentMethod(userId: string, paymentMethodId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.stripeCustomerId) {
      throw new Error('No subscription found');
    }

    // Check if this is the default payment method
    if (subscription.defaultPaymentMethodId === paymentMethodId) {
      throw new Error('Cannot remove default payment method. Please set a new default first.');
    }

    await stripe.paymentMethods.detach(paymentMethodId);

    return { success: true };
  }

  async handleFailedPayment(invoice: Stripe.Invoice) {
    if (!invoice.subscription || !invoice.customer) return;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const attempt = invoice.attempt_count || 1;

    // Update subscription status in database
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: 'PAST_DUE',
        lastPaymentAttempt: new Date(),
        failedPaymentCount: {
          increment: 1,
        },
      },
    });

    // Send appropriate email based on attempt number
    await this.sendFailedPaymentEmail(subscription, attempt);

    // Schedule retry based on attempt
    if (attempt < 4) {
      await this.schedulePaymentRetry(subscription, attempt);
    } else {
      // After 4 attempts, mark subscription for cancellation
      await this.scheduleSubscriptionCancellation(subscription);
    }
  }

  private async sendFailedPaymentEmail(subscription: Stripe.Subscription, attempt: number) {
    const user = await prisma.user.findFirst({
      where: {
        subscription: {
          stripeSubscriptionId: subscription.id,
        },
      },
    });

    if (!user) return;

    // Email templates based on attempt number
    const emailTemplates = {
      1: {
        subject: 'Payment failed - Action required',
        template: 'payment-failed-first-attempt',
      },
      2: {
        subject: 'Second payment attempt failed - Update payment method',
        template: 'payment-failed-second-attempt',
      },
      3: {
        subject: 'Final payment reminder - Service will be suspended',
        template: 'payment-failed-final-warning',
      },
      4: {
        subject: 'Subscription cancelled due to payment failure',
        template: 'subscription-cancelled-payment-failure',
      },
    };

    const emailConfig = emailTemplates[attempt as keyof typeof emailTemplates] || emailTemplates[1];

    // TODO: Integrate with email service
    logger.info(`Sending ${emailConfig.subject} email to ${user.email}`);
  }

  private async schedulePaymentRetry(subscription: Stripe.Subscription, attempt: number) {
    // Retry schedule: 3 days, 5 days, 7 days
    const retryDays = [3, 5, 7];
    const daysUntilRetry = retryDays[attempt - 1] || 7;

    const retryDate = new Date();
    retryDate.setDate(retryDate.getDate() + daysUntilRetry);

    // Update subscription metadata with retry information
    await stripe.subscriptions.update(subscription.id, {
      metadata: {
        ...subscription.metadata,
        nextRetryDate: retryDate.toISOString(),
        retryAttempt: attempt.toString(),
      },
    });
  }

  private async scheduleSubscriptionCancellation(subscription: Stripe.Subscription) {
    // Cancel subscription at period end
    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    // Update database
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
        status: 'CANCELLING',
      },
    });
  }

  async updatePaymentMethodForSubscription(userId: string, paymentMethodId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    // Retry any failed invoices with the new payment method
    const invoices = await stripe.invoices.list({
      subscription: subscription.stripeSubscriptionId,
      status: 'open',
    });

    for (const invoice of invoices.data) {
      try {
        await stripe.invoices.pay(invoice.id, {
          payment_method: paymentMethodId,
        });
      } catch (error) {
        logger.error(`Failed to pay invoice ${invoice.id}:`, error);
      }
    }

    return { success: true, retriedInvoices: invoices.data.length };
  }
}
