import Stripe from 'stripe';
import { getStripeConfig, isProduction } from '../config';

// Stripe configuration type
export interface StripeConfig {
  stripe: Stripe;
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  isLiveMode: boolean;
}

// Create Stripe instance with proper configuration
export function createStripeClient(): StripeConfig {
  const config = getStripeConfig();
  
  // Initialize Stripe with the secret key
  const stripe = new Stripe(config.secretKey, {
    apiVersion: '2024-12-18.acacia',
    typescript: true,
    maxNetworkRetries: 2,
    timeout: 10000, // 10 seconds
    telemetry: false, // Disable telemetry for privacy
  });
  
  // Determine if using live mode
  const isLiveMode = config.publishableKey.startsWith('pk_live_');
  
  return {
    stripe,
    publishableKey: config.publishableKey,
    secretKey: config.secretKey,
    webhookSecret: config.webhookSecret,
    isLiveMode,
  };
}

// Singleton instance
let stripeInstance: StripeConfig | null = null;

// Get Stripe instance (singleton pattern)
export function getStripe(): StripeConfig {
  if (!stripeInstance) {
    stripeInstance = createStripeClient();
  }
  return stripeInstance;
}

// Helper to get publishable key for client-side
export function getPublishableKey(): string {
  return getStripeConfig().publishableKey;
}

// Subscription plan configurations (Australian pricing with GST included)
export const SUBSCRIPTION_PLANS = {
  SMART: {
    planId: 'taax_smart',
    name: 'TAAX Smart',
    description: 'Essential tax management for individuals',
    prices: {
      trial: {
        days: 3,
        amount: 0,
      },
      promotional: {
        amount: 499, // $4.99 AUD including GST
        months: 2,
        stripePriceId: isProduction() 
          ? 'price_live_smart_promo' 
          : 'price_test_smart_promo',
      },
      regular: {
        amount: 999, // $9.99 AUD including GST
        stripePriceId: isProduction()
          ? 'price_live_smart_regular'
          : 'price_test_smart_regular',
      },
    },
    features: [
      'Basic tax return filing',
      'Receipt scanning and tracking',
      'Tax deduction recommendations',
      'Email support',
      'Basic financial insights',
    ],
  },
  PRO: {
    planId: 'taax_pro',
    name: 'TAAX Pro',
    description: 'Professional tax management with advanced features',
    prices: {
      trial: {
        days: 7,
        amount: 0,
      },
      promotional: {
        amount: 1099, // $10.99 AUD including GST
        months: 2,
        stripePriceId: isProduction()
          ? 'price_live_pro_promo'
          : 'price_test_pro_promo',
      },
      regular: {
        amount: 1899, // $18.99 AUD including GST
        stripePriceId: isProduction()
          ? 'price_live_pro_regular'
          : 'price_test_pro_regular',
      },
    },
    features: [
      'All Smart features',
      'Advanced tax optimization',
      'Bank account integration',
      'AI-powered tax assistant',
      'Priority support',
      'Multiple business entities',
      'Quarterly tax planning',
      'Custom reports',
    ],
  },
} as const;

// Australian GST configuration
export const GST_CONFIG = {
  rate: 0.10, // 10% GST
  isIncluded: true, // Prices include GST
  businessName: 'TaxReturnPro',
  abn: '', // Add your ABN here
};

// Calculate GST from a total amount (when GST is included)
export function calculateGSTFromTotal(totalAmount: number): {
  gstAmount: number;
  amountExGST: number;
} {
  const gstAmount = Math.round(totalAmount * (GST_CONFIG.rate / (1 + GST_CONFIG.rate)));
  const amountExGST = totalAmount - gstAmount;
  
  return {
    gstAmount,
    amountExGST,
  };
}

// Format amount for display (in dollars)
export function formatAmount(amountInCents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amountInCents / 100);
}

// Webhook event handlers configuration
export const WEBHOOK_EVENTS = {
  // Customer events
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_DELETED: 'customer.deleted',
  
  // Subscription events
  SUBSCRIPTION_CREATED: 'customer.subscription.created',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  SUBSCRIPTION_TRIAL_WILL_END: 'customer.subscription.trial_will_end',
  
  // Payment events
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED: 'payment_intent.payment_failed',
  
  // Invoice events
  INVOICE_CREATED: 'invoice.created',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  INVOICE_FINALIZED: 'invoice.finalized',
  
  // Checkout events
  CHECKOUT_SESSION_COMPLETED: 'checkout.session.completed',
} as const;

// Error handling
export class StripeError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'StripeError';
  }
}

// Validate Stripe webhook signature
export async function validateWebhookSignature(
  payload: string | Buffer,
  signature: string,
): Promise<Stripe.Event> {
  const { stripe, webhookSecret } = getStripe();
  
  try {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  } catch (error) {
    throw new StripeError(
      'Invalid webhook signature',
      'invalid_signature',
      400,
    );
  }
}