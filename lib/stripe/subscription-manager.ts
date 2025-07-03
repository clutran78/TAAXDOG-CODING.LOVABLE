// Comprehensive Stripe Subscription Management Service
import { Stripe } from 'stripe';
import { getStripe } from './config';
import { prisma } from '../prisma';
import { 
  SUBSCRIPTION_PLANS, 
  getPlanByPriceId,
  getPromotionalEndDate,
  formatAUDAmount,
  BUSINESS_DETAILS
} from './pricing';

export interface CreateSubscriptionParams {
  userId: string;
  customerEmail: string;
  planType: 'SMART' | 'PRO';
  billingInterval: 'monthly' | 'annual';
  paymentMethodId?: string;
  couponCode?: string;
  metadata?: Record<string, string>;
}

export interface UpdateSubscriptionParams {
  subscriptionId: string;
  planType?: 'SMART' | 'PRO';
  billingInterval?: 'monthly' | 'annual';
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, string>;
}

export class SubscriptionManager {
  private stripe: Stripe;

  constructor() {
    this.stripe = getStripe().stripe;
  }

  // Create or get Stripe customer
  async getOrCreateCustomer(userId: string, email: string, metadata?: any): Promise<Stripe.Customer> {
    // Check if customer exists in database
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (existingSubscription?.stripeCustomerId) {
      try {
        const customer = await this.stripe.customers.retrieve(existingSubscription.stripeCustomerId);
        if (!customer.deleted) {
          return customer as Stripe.Customer;
        }
      } catch (error) {
        // Customer doesn't exist in Stripe, create new one
      }
    }

    // Get user details for customer creation
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create new Stripe customer
    const customer = await this.stripe.customers.create({
      email: email || user.email,
      name: user.name,
      metadata: {
        userId,
        ...metadata,
      },
      tax: {
        validate_location: 'immediately',
      },
      address: {
        country: 'AU', // Default to Australia
      },
      tax_id_data: user.abn ? [{
        type: 'au_abn',
        value: user.abn,
      }] : undefined,
    });

    return customer;
  }

  // Create subscription with trial and promotional pricing
  async createSubscription(params: CreateSubscriptionParams): Promise<{
    subscription: Stripe.Subscription;
    clientSecret?: string;
  }> {
    const { userId, customerEmail, planType, billingInterval, paymentMethodId, metadata } = params;

    // Get plan configuration
    const plan = SUBSCRIPTION_PLANS[planType];
    if (!plan) {
      throw new Error('Invalid plan type');
    }

    // Get or create customer
    const customer = await this.getOrCreateCustomer(userId, customerEmail, metadata);

    // Attach payment method if provided
    if (paymentMethodId) {
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });
      
      // Set as default payment method
      await this.stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }

    // Create subscription based on billing interval
    let subscription: Stripe.Subscription;

    if (billingInterval === 'annual') {
      // Annual subscription - simple creation
      subscription = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [{ 
          price_data: {
            currency: 'aud',
            product_data: {
              name: plan.name,
              description: plan.description,
              metadata: {
                planType,
              },
            },
            unit_amount: plan.prices.annual.amount,
            recurring: {
              interval: 'year',
            },
          },
        }],
        trial_period_days: plan.trialDays,
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
        metadata: {
          userId,
          planType,
          billingInterval,
          ...metadata,
        },
      });
    } else {
      // Monthly subscription with promotional pricing
      const promotionalEndDate = getPromotionalEndDate(
        new Date(),
        plan.prices.promotional.metadata.promotionalMonths || 2
      );

      // Create subscription schedule for promotional pricing
      const schedule = await this.stripe.subscriptionSchedules.create({
        customer: customer.id,
        start_date: 'now',
        end_behavior: 'release',
        phases: [
          {
            items: [{
              price_data: {
                currency: 'aud',
                product_data: {
                  name: `${plan.name} - Early Access`,
                  description: plan.description,
                  metadata: {
                    planType,
                    tier: 'promotional',
                  },
                },
                unit_amount: plan.prices.promotional.amount,
                recurring: {
                  interval: 'month',
                },
              },
            }],
            trial_period_days: plan.trialDays,
            end_date: Math.floor(promotionalEndDate.getTime() / 1000),
            metadata: {
              phase: 'promotional',
              planType,
            },
          },
          {
            items: [{
              price_data: {
                currency: 'aud',
                product_data: {
                  name: plan.name,
                  description: plan.description,
                  metadata: {
                    planType,
                    tier: 'regular',
                  },
                },
                unit_amount: plan.prices.regular.amount,
                recurring: {
                  interval: 'month',
                },
              },
            }],
            metadata: {
              phase: 'regular',
              planType,
            },
          },
        ],
        metadata: {
          userId,
          planType,
          billingInterval,
          ...metadata,
        },
      });

      // Get the created subscription
      subscription = await this.stripe.subscriptions.retrieve(schedule.subscription as string, {
        expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      });
    }

    // Save subscription to database
    await this.saveSubscriptionToDatabase(subscription, userId);

    // Return subscription with client secret for payment confirmation
    const clientSecret = 
      (subscription.latest_invoice as Stripe.Invoice)?.payment_intent?.client_secret ||
      (subscription.pending_setup_intent as Stripe.SetupIntent)?.client_secret;

    return { subscription, clientSecret };
  }

  // Update subscription (upgrade/downgrade)
  async updateSubscription(params: UpdateSubscriptionParams): Promise<Stripe.Subscription> {
    const { subscriptionId, planType, billingInterval, cancelAtPeriodEnd, metadata } = params;

    // Get current subscription
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    
    if (cancelAtPeriodEnd !== undefined) {
      // Cancel or uncancel at period end
      const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd,
        metadata: { ...subscription.metadata, ...metadata },
      });

      await this.saveSubscriptionToDatabase(updatedSubscription);
      return updatedSubscription;
    }

    if (planType && billingInterval) {
      // Change plan
      const plan = SUBSCRIPTION_PLANS[planType];
      const subscriptionItem = subscription.items.data[0];
      
      // Create new price
      const newPrice = await this.stripe.prices.create({
        currency: 'aud',
        product_data: {
          name: plan.name,
          metadata: {
            planType,
            billingInterval,
          },
        },
        unit_amount: billingInterval === 'annual' 
          ? plan.prices.annual.amount 
          : plan.prices.regular.amount,
        recurring: {
          interval: billingInterval === 'annual' ? 'year' : 'month',
        },
      });

      // Update subscription
      const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: subscriptionItem.id,
          price: newPrice.id,
        }],
        proration_behavior: 'create_prorations',
        metadata: {
          ...subscription.metadata,
          planType,
          billingInterval,
          ...metadata,
        },
      });

      // Update database
      await this.saveSubscriptionToDatabase(updatedSubscription);

      return updatedSubscription;
    }

    throw new Error('No update parameters provided');
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string, immediately = false): Promise<Stripe.Subscription> {
    let subscription: Stripe.Subscription;

    if (immediately) {
      subscription = await this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
        metadata: {
          cancelledAt: new Date().toISOString(),
        },
      });
    }

    // Update database
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        cancelledAt: new Date(),
      },
    });

    return subscription;
  }

  // Resume cancelled subscription
  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
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

  // Create customer portal session
  async createPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
      configuration: await this.getOrCreatePortalConfiguration(),
    });

    return session.url;
  }

  // Get or create portal configuration
  private async getOrCreatePortalConfiguration(): Promise<string> {
    const configurations = await this.stripe.billingPortal.configurations.list({ limit: 1 });
    
    if (configurations.data.length > 0) {
      return configurations.data[0].id;
    }

    // Create new configuration
    const configuration = await this.stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'Manage your TaxReturnPro subscription',
        privacy_policy_url: 'https://taxreturnpro.com.au/privacy',
        terms_of_service_url: 'https://taxreturnpro.com.au/terms',
      },
      features: {
        customer_update: {
          enabled: true,
          allowed_updates: ['email', 'address', 'phone', 'tax_id'],
        },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { 
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: [
              'too_expensive',
              'missing_features',
              'switched_service',
              'unused',
              'other',
            ],
          },
        },
        subscription_pause: { enabled: false },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price', 'quantity'],
          proration_behavior: 'create_prorations',
          products: [{
            product: SUBSCRIPTION_PLANS.SMART.productId,
            prices: [
              SUBSCRIPTION_PLANS.SMART.prices.regular.id,
              SUBSCRIPTION_PLANS.SMART.prices.annual.id,
            ],
          }, {
            product: SUBSCRIPTION_PLANS.PRO.productId,
            prices: [
              SUBSCRIPTION_PLANS.PRO.prices.regular.id,
              SUBSCRIPTION_PLANS.PRO.prices.annual.id,
            ],
          }],
        },
      },
    });

    return configuration.id;
  }

  // Save subscription to database
  private async saveSubscriptionToDatabase(
    subscription: Stripe.Subscription,
    userId?: string
  ): Promise<void> {
    const price = subscription.items.data[0]?.price;
    
    const data = {
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: price?.id || '',
      status: subscription.status,
      plan: (subscription.metadata.planType || 'SMART') as 'SMART' | 'PRO',
      interval: (subscription.metadata.billingInterval || 'month') as string,
      amount: price?.unit_amount || 0,
      currency: subscription.currency,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    };

    if (userId) {
      await prisma.subscription.upsert({
        where: { userId },
        update: data,
        create: { ...data, userId },
      });
    } else {
      await prisma.subscription.update({
        where: { stripeSubscriptionId: subscription.id },
        data,
      });
    }
  }

  // Generate Australian tax invoice
  async generateTaxInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    const invoice = await this.stripe.invoices.retrieve(invoiceId, {
      expand: ['customer', 'subscription', 'lines.data.price.product'],
    });

    // Calculate GST components
    const gstAmount = Math.round(invoice.total / 11);
    const amountExGST = invoice.total - gstAmount;

    // Update invoice with Australian tax details
    const updatedInvoice = await this.stripe.invoices.update(invoiceId, {
      custom_fields: [
        { name: 'ABN', value: BUSINESS_DETAILS.abn || 'Pending' },
        { name: 'Tax Invoice', value: 'Yes' },
        { name: 'GST Amount', value: formatAUDAmount(gstAmount) },
        { name: 'Amount Ex GST', value: formatAUDAmount(amountExGST) },
      ],
      footer: 'All prices include GST (10%). This is a tax invoice when paid.',
      metadata: {
        gst_amount: gstAmount.toString(),
        amount_ex_gst: amountExGST.toString(),
        tax_invoice: 'true',
      },
    });

    return updatedInvoice;
  }

  // Handle subscription webhooks
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.trial_will_end':
        await this.handleTrialEnding(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }
  }

  private async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    if (!userId) return;

    await this.saveSubscriptionToDatabase(subscription, userId);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    if (!userId) return;

    await prisma.subscription.update({
      where: { userId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });
  }

  private async handleTrialEnding(subscription: Stripe.Subscription): Promise<void> {
    // Send trial ending notification
    console.log(`Trial ending for subscription ${subscription.id}`);
    // Implement email notification here
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    // Generate tax invoice
    await this.generateTaxInvoice(invoice.id);

    // Record payment
    const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata.userId;

    if (userId) {
      await prisma.payment.create({
        data: {
          userId,
          stripePaymentIntentId: invoice.payment_intent as string,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: 'succeeded',
          description: `Subscription payment - ${invoice.number}`,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            gstAmount: Math.round(invoice.amount_paid / 11),
          },
        },
      });
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata.userId;

    if (userId) {
      // Update subscription status
      await prisma.subscription.update({
        where: { userId },
        data: {
          status: 'past_due',
          failedPaymentCount: {
            increment: 1,
          },
          lastPaymentAttempt: new Date(),
        },
      });

      // Record failed payment
      await prisma.payment.create({
        data: {
          userId,
          stripePaymentIntentId: invoice.payment_intent as string,
          amount: invoice.amount_due,
          currency: invoice.currency,
          status: 'failed',
          description: `Failed payment - ${invoice.number}`,
        },
      });
    }
  }
}

// Export singleton instance
export const subscriptionManager = new SubscriptionManager();