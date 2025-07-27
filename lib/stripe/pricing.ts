// Australian Subscription Pricing Configuration with GST
import { Stripe } from 'stripe';

export interface PricingTier {
  id: string;
  name: string;
  interval: 'month' | 'year';
  amount: number; // in cents, GST inclusive
  currency: 'aud';
  trialDays?: number;
  metadata: {
    tier: 'promotional' | 'regular' | 'annual';
    promotionalMonths?: number;
    transitionToPriceId?: string;
    gstInclusive: 'true';
    gstAmount: string;
    amountExGst: string;
  };
}

export interface SubscriptionPlan {
  productId: string;
  name: string;
  description: string;
  trialDays: number;
  prices: {
    promotional: PricingTier;
    regular: PricingTier;
    annual: PricingTier;
  };
  features: string[];
}

// Calculate GST from GST-inclusive amount
function calculateGSTComponents(amountIncGST: number): {
  gstAmount: number;
  amountExGST: number;
} {
  const gstAmount = Math.round(amountIncGST / 11); // GST = Total × 1/11
  const amountExGST = amountIncGST - gstAmount;
  return { gstAmount, amountExGST };
}

// TAAX Smart Plan Configuration
export const TAAX_SMART_PLAN: SubscriptionPlan = {
  productId: 'prod_taax_smart',
  name: 'TAAX Smart',
  description: 'Essential tax management for individuals',
  trialDays: 3,
  prices: {
    promotional: {
      id: 'price_taax_smart_promotional',
      name: 'TAAX Smart - Early Access',
      interval: 'month',
      amount: 499, // $4.99 AUD inc GST
      currency: 'aud',
      metadata: {
        tier: 'promotional',
        promotionalMonths: 2,
        transitionToPriceId: 'price_taax_smart_regular',
        gstInclusive: 'true',
        gstAmount: calculateGSTComponents(499).gstAmount.toString(),
        amountExGst: calculateGSTComponents(499).amountExGST.toString(),
      },
    },
    regular: {
      id: 'price_taax_smart_regular',
      name: 'TAAX Smart - Monthly',
      interval: 'month',
      amount: 999, // $9.99 AUD inc GST
      currency: 'aud',
      metadata: {
        tier: 'regular',
        gstInclusive: 'true',
        gstAmount: calculateGSTComponents(999).gstAmount.toString(),
        amountExGst: calculateGSTComponents(999).amountExGST.toString(),
      },
    },
    annual: {
      id: 'price_taax_smart_annual',
      name: 'TAAX Smart - Annual',
      interval: 'year',
      amount: 9900, // $99.00 AUD inc GST (2 months free)
      currency: 'aud',
      metadata: {
        tier: 'annual',
        gstInclusive: 'true',
        gstAmount: calculateGSTComponents(9900).gstAmount.toString(),
        amountExGst: calculateGSTComponents(9900).amountExGST.toString(),
      },
    },
  },
  features: [
    'Basic tax return filing',
    'Receipt scanning and tracking',
    'Tax deduction recommendations',
    'Email support',
    'Basic financial insights',
    'Mobile app access',
    'Secure document storage',
  ],
};

// TAAX Pro Plan Configuration
export const TAAX_PRO_PLAN: SubscriptionPlan = {
  productId: 'prod_taax_pro',
  name: 'TAAX Pro',
  description: 'Professional tax management with advanced features',
  trialDays: 7,
  prices: {
    promotional: {
      id: 'price_taax_pro_promotional',
      name: 'TAAX Pro - Early Access',
      interval: 'month',
      amount: 1099, // $10.99 AUD inc GST
      currency: 'aud',
      metadata: {
        tier: 'promotional',
        promotionalMonths: 2,
        transitionToPriceId: 'price_taax_pro_regular',
        gstInclusive: 'true',
        gstAmount: calculateGSTComponents(1099).gstAmount.toString(),
        amountExGst: calculateGSTComponents(1099).amountExGST.toString(),
      },
    },
    regular: {
      id: 'price_taax_pro_regular',
      name: 'TAAX Pro - Monthly',
      interval: 'month',
      amount: 1899, // $18.99 AUD inc GST
      currency: 'aud',
      metadata: {
        tier: 'regular',
        gstInclusive: 'true',
        gstAmount: calculateGSTComponents(1899).gstAmount.toString(),
        amountExGst: calculateGSTComponents(1899).amountExGST.toString(),
      },
    },
    annual: {
      id: 'price_taax_pro_annual',
      name: 'TAAX Pro - Annual',
      interval: 'year',
      amount: 18900, // $189.00 AUD inc GST (2 months free)
      currency: 'aud',
      metadata: {
        tier: 'annual',
        gstInclusive: 'true',
        gstAmount: calculateGSTComponents(18900).gstAmount.toString(),
        amountExGst: calculateGSTComponents(18900).amountExGST.toString(),
      },
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
    'API access',
    'Dedicated account manager',
    'Unlimited document storage',
    'Real-time collaboration',
  ],
};

// All plans configuration
export const SUBSCRIPTION_PLANS = {
  SMART: TAAX_SMART_PLAN,
  PRO: TAAX_PRO_PLAN,
} as const;

// Helper to get plan by product ID
export function getPlanByProductId(productId: string): SubscriptionPlan | null {
  return Object.values(SUBSCRIPTION_PLANS).find((plan) => plan.productId === productId) || null;
}

// Helper to get plan by price ID
export function getPlanByPriceId(priceId: string): SubscriptionPlan | null {
  for (const plan of Object.values(SUBSCRIPTION_PLANS)) {
    if (
      plan.prices.promotional.id === priceId ||
      plan.prices.regular.id === priceId ||
      plan.prices.annual.id === priceId
    ) {
      return plan;
    }
  }
  return null;
}

// Stripe product creation parameters
export function getProductParams(plan: SubscriptionPlan): Stripe.ProductCreateParams {
  return {
    id: plan.productId,
    name: plan.name,
    description: plan.description,
    active: true,
    metadata: {
      plan_type: plan.productId.includes('smart') ? 'smart' : 'pro',
      trial_days: plan.trialDays.toString(),
    },
    default_price_data: {
      currency: 'aud',
      unit_amount: plan.prices.regular.amount,
      recurring: {
        interval: 'month',
      },
    },
    features: plan.features.map((feature) => ({ name: feature })),
  };
}

// Stripe price creation parameters
export function getPriceParams(
  productId: string,
  priceTier: PricingTier,
): Stripe.PriceCreateParams {
  return {
    product: productId,
    currency: priceTier.currency,
    unit_amount: priceTier.amount,
    recurring: {
      interval: priceTier.interval,
      trial_period_days: priceTier.trialDays,
    },
    nickname: priceTier.name,
    metadata: priceTier.metadata,
    lookup_key: priceTier.id,
  };
}

// Format amount for display
export function formatAUDAmount(amountInCents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amountInCents / 100);
}

// Calculate promotional period end date
export function getPromotionalEndDate(startDate: Date, months: number): Date {
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);
  return endDate;
}

// Australian business details for invoicing
export const BUSINESS_DETAILS = {
  name: 'TaxReturnPro',
  abn: '', // Add your ABN when available
  address: {
    line1: '', // Add your business address
    city: '',
    state: '',
    postal_code: '',
    country: 'AU',
  },
  email: 'billing@taxreturnpro.com.au',
  phone: '', // Add your business phone
  website: 'https://taxreturnpro.com.au',
};
