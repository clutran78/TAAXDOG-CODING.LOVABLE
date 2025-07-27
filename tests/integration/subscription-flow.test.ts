import { createMockApiContext, apiAssertions } from '@/tests/utils/api-mocks';
import { testDataFactory } from '@/tests/utils/db-helpers';
import Stripe from 'stripe';

// Import API handlers
import createCheckoutHandler from '@/pages/api/stripe/create-checkout-session';
import webhookHandler from '@/pages/api/stripe/webhook';
import cancelSubscriptionHandler from '@/pages/api/stripe/cancel-subscription';
import updatePaymentHandler from '@/pages/api/stripe/update-payment-method';

// Mock dependencies
jest.mock('stripe');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

const mockPrisma = require('@/lib/prisma').prisma;
const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
  },
  subscriptions: {
    retrieve: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
  },
  customers: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  paymentMethods: {
    attach: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

(Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(() => mockStripe as any);

describe('Subscription Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'test-stripe-key';
    process.env.STRIPE_WEBHOOK_SECRET = 'test-webhook-secret';
  });

  describe('Subscription Creation Flow', () => {
    it('creates checkout session for new subscription', async () => {
      const userId = 'user-123';
      const user = testDataFactory.user({
        id: userId,
        email: 'user@example.com',
        stripeCustomerId: null,
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce(user);

      // Create Stripe customer
      mockStripe.customers.create.mockResolvedValueOnce({
        id: 'cus_test123',
        email: user.email,
      });

      // Create checkout session
      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/pay/cs_test123',
        customer: 'cus_test123',
      });

      const { req, res } = createMockApiContext('POST', {
        plan: 'TAAX_PRO',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      });
      req.user = { id: userId };

      await createCheckoutHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data.sessionId).toBe('cs_test123');
      expect(data.url).toBe('https://checkout.stripe.com/pay/cs_test123');

      // Verify Stripe customer was created
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: user.email,
        metadata: { userId },
      });

      // Verify user was updated with Stripe customer ID
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { stripeCustomerId: 'cus_test123' },
      });

      // Verify checkout session was created with correct parameters
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_test123',
        payment_method_types: ['card'],
        line_items: [
          {
            price: expect.stringContaining('price_'), // TAAX_PRO price ID
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: 'https://app.example.com/success',
        cancel_url: 'https://app.example.com/cancel',
        subscription_data: {
          trial_period_days: 7, // TAAX Pro trial
          metadata: { userId, plan: 'TAAX_PRO' },
        },
      });
    });

    it('handles checkout completion webhook', async () => {
      const webhookEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test123',
            customer: 'cus_test123',
            subscription: 'sub_test123',
            metadata: {
              userId: 'user-123',
              plan: 'TAAX_PRO',
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValueOnce(webhookEvent);

      // Get subscription details
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        id: 'sub_test123',
        status: 'trialing',
        current_period_end: Math.floor(Date.now() / 1000) + 604800, // 7 days
        items: {
          data: [
            {
              price: {
                id: 'price_taax_pro',
                unit_amount: 1099, // $10.99
                currency: 'aud',
              },
            },
          ],
        },
      });

      mockPrisma.subscription.create.mockResolvedValueOnce({
        id: 'db-sub-1',
        userId: 'user-123',
        stripeSubscriptionId: 'sub_test123',
        plan: 'TAAX_PRO',
        status: 'TRIALING',
      });

      const { req, res } = createMockApiContext('POST', null);
      req.headers['stripe-signature'] = 'test-signature';
      req.body = JSON.stringify(webhookEvent);

      await webhookHandler(req, res);

      apiAssertions.expectSuccess(res);

      // Verify subscription was created in database
      expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          stripeSubscriptionId: 'sub_test123',
          stripeCustomerId: 'cus_test123',
          plan: 'TAAX_PRO',
          status: 'TRIALING',
          currentPeriodEnd: expect.any(Date),
          priceId: 'price_taax_pro',
          amount: 10.99,
        },
      });

      // Verify user was updated
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          subscriptionStatus: 'TRIALING',
          subscriptionPlan: 'TAAX_PRO',
        },
      });
    });
  });

  describe('Subscription Lifecycle', () => {
    it('handles trial end and conversion to paid', async () => {
      const trialEndEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test123',
            status: 'active',
            trial_end: Math.floor(Date.now() / 1000) - 3600, // Trial ended
            current_period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days
          },
          previous_attributes: {
            status: 'trialing',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValueOnce(trialEndEvent);

      mockPrisma.subscription.findUnique.mockResolvedValueOnce({
        id: 'db-sub-1',
        userId: 'user-123',
        stripeSubscriptionId: 'sub_test123',
        status: 'TRIALING',
      });

      mockPrisma.subscription.update.mockResolvedValueOnce({
        id: 'db-sub-1',
        status: 'ACTIVE',
      });

      const { req, res } = createMockApiContext('POST');
      req.headers['stripe-signature'] = 'test-signature';
      req.body = JSON.stringify(trialEndEvent);

      await webhookHandler(req, res);

      apiAssertions.expectSuccess(res);

      // Verify subscription status was updated
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_test123' },
        data: {
          status: 'ACTIVE',
          trialEnd: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
        },
      });

      // Verify audit log
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'SUBSCRIPTION_CONVERTED',
          userId: 'user-123',
          metadata: {
            plan: 'TAAX_PRO',
            previousStatus: 'TRIALING',
            newStatus: 'ACTIVE',
          },
        },
      });
    });

    it('handles successful payment and invoice generation', async () => {
      const paymentSuccessEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_test123',
            subscription: 'sub_test123',
            amount_paid: 1099, // $10.99 in cents
            currency: 'aud',
            invoice_pdf: 'https://stripe.com/invoice.pdf',
            number: 'INV-2024-001',
            metadata: {
              userId: 'user-123',
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValueOnce(paymentSuccessEvent);

      mockPrisma.payment.create.mockResolvedValueOnce({
        id: 'payment-1',
        userId: 'user-123',
        amount: 10.99,
        status: 'SUCCEEDED',
      });

      const { req, res } = createMockApiContext('POST');
      req.headers['stripe-signature'] = 'test-signature';
      req.body = JSON.stringify(paymentSuccessEvent);

      await webhookHandler(req, res);

      apiAssertions.expectSuccess(res);

      // Verify payment was recorded
      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          stripeInvoiceId: 'in_test123',
          amount: 10.99,
          currency: 'AUD',
          status: 'SUCCEEDED',
          invoiceUrl: 'https://stripe.com/invoice.pdf',
          invoiceNumber: 'INV-2024-001',
          gstAmount: 1.0, // 10% GST
        },
      });
    });

    it('handles failed payment and retry logic', async () => {
      const paymentFailedEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_test123',
            subscription: 'sub_test123',
            attempt_count: 1,
            next_payment_attempt: Math.floor(Date.now() / 1000) + 259200, // 3 days
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValueOnce(paymentFailedEvent);

      mockPrisma.subscription.update.mockResolvedValueOnce({
        id: 'db-sub-1',
        status: 'PAST_DUE',
      });

      const { req, res } = createMockApiContext('POST');
      req.headers['stripe-signature'] = 'test-signature';
      req.body = JSON.stringify(paymentFailedEvent);

      await webhookHandler(req, res);

      apiAssertions.expectSuccess(res);

      // Verify subscription marked as past due
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_test123' },
        data: {
          status: 'PAST_DUE',
          paymentRetryAt: expect.any(Date),
        },
      });
    });
  });

  describe('Subscription Management', () => {
    it('cancels subscription at period end', async () => {
      const userId = 'user-123';
      const subscription = {
        id: 'db-sub-1',
        userId,
        stripeSubscriptionId: 'sub_test123',
        status: 'ACTIVE',
      };

      mockPrisma.subscription.findUnique.mockResolvedValueOnce(subscription);

      mockStripe.subscriptions.update.mockResolvedValueOnce({
        id: 'sub_test123',
        cancel_at_period_end: true,
        canceled_at: Math.floor(Date.now() / 1000),
      });

      const { req, res } = createMockApiContext('POST', {
        reason: 'Too expensive',
        feedback: 'Great service but need to cut costs',
      });
      req.user = { id: userId };

      await cancelSubscriptionHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data.subscription.cancelAtPeriodEnd).toBe(true);

      // Verify Stripe API call
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_test123', {
        cancel_at_period_end: true,
      });

      // Verify database update
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'db-sub-1' },
        data: {
          cancelAtPeriodEnd: true,
          cancelReason: 'Too expensive',
          cancelFeedback: 'Great service but need to cut costs',
        },
      });
    });

    it('updates payment method', async () => {
      const userId = 'user-123';
      const user = testDataFactory.user({
        id: userId,
        stripeCustomerId: 'cus_test123',
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce(user);

      mockStripe.paymentMethods.attach.mockResolvedValueOnce({
        id: 'pm_test123',
      });

      mockStripe.customers.update = jest.fn().mockResolvedValueOnce({
        id: 'cus_test123',
        invoice_settings: {
          default_payment_method: 'pm_test123',
        },
      });

      const { req, res } = createMockApiContext('POST', {
        paymentMethodId: 'pm_test123',
      });
      req.user = { id: userId };

      await updatePaymentHandler(req, res);

      apiAssertions.expectSuccess(res);

      // Verify payment method was attached
      expect(mockStripe.paymentMethods.attach).toHaveBeenCalledWith('pm_test123', {
        customer: 'cus_test123',
      });

      // Verify default payment method was updated
      expect(mockStripe.customers.update).toHaveBeenCalledWith('cus_test123', {
        invoice_settings: {
          default_payment_method: 'pm_test123',
        },
      });
    });
  });

  describe('Plan Changes', () => {
    it('handles upgrade from TAAX Smart to TAAX Pro', async () => {
      const userId = 'user-123';
      const currentSubscription = {
        id: 'db-sub-1',
        userId,
        stripeSubscriptionId: 'sub_test123',
        plan: 'TAAX_SMART',
        status: 'ACTIVE',
      };

      mockPrisma.subscription.findUnique.mockResolvedValueOnce(currentSubscription);

      // Stripe subscription update for plan change
      mockStripe.subscriptions.update.mockResolvedValueOnce({
        id: 'sub_test123',
        items: {
          data: [
            {
              id: 'si_test123',
              price: { id: 'price_taax_pro' },
            },
          ],
        },
      });

      const { req, res } = createMockApiContext('POST', {
        newPlan: 'TAAX_PRO',
        immediate: true,
      });
      req.user = { id: userId };

      await updatePaymentHandler(req, res);

      // Verify immediate upgrade
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_test123', {
        items: [
          {
            id: 'si_test123',
            price: 'price_taax_pro',
          },
        ],
        proration_behavior: 'always_invoice',
      });
    });

    it('handles downgrade with proration', async () => {
      const userId = 'user-123';
      const currentSubscription = {
        id: 'db-sub-1',
        userId,
        stripeSubscriptionId: 'sub_test123',
        plan: 'TAAX_PRO',
        status: 'ACTIVE',
      };

      mockPrisma.subscription.findUnique.mockResolvedValueOnce(currentSubscription);

      mockStripe.subscriptions.update.mockResolvedValueOnce({
        id: 'sub_test123',
        items: {
          data: [
            {
              id: 'si_test123',
              price: { id: 'price_taax_smart' },
            },
          ],
        },
      });

      const { req, res } = createMockApiContext('POST', {
        newPlan: 'TAAX_SMART',
        immediate: false, // Downgrade at period end
      });
      req.user = { id: userId };

      await updatePaymentHandler(req, res);

      // Verify downgrade scheduled for period end
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_test123', {
        items: [
          {
            id: 'si_test123',
            price: 'price_taax_smart',
          },
        ],
        proration_behavior: 'none',
      });
    });
  });
});
