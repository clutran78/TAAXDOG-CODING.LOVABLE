import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

export const getStripePublishableKey = () => {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
  }
  return key;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);
};

export const calculateGST = (
  amountIncludingGST: number,
): {
  gstAmount: number;
  amountExcludingGST: number;
} => {
  const gstAmount = Math.round(amountIncludingGST / 11);
  const amountExcludingGST = amountIncludingGST - gstAmount;

  return {
    gstAmount,
    amountExcludingGST,
  };
};

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  monthlyPriceId: string;
  annualPriceId: string;
  monthlyPrice: number;
  annualPrice: number;
  promotionalMonthlyPrice: number;
  promotionalMonths: number;
  trialDays: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  SMART: {
    id: 'smart',
    name: 'TAAX Smart',
    description: 'Essential tax management for individuals',
    monthlyPriceId:
      process.env.NODE_ENV === 'production'
        ? 'price_smart_monthly_prod'
        : 'price_smart_monthly_test',
    annualPriceId:
      process.env.NODE_ENV === 'production' ? 'price_smart_annual_prod' : 'price_smart_annual_test',
    monthlyPrice: 999, // $9.99 AUD
    annualPrice: 9900, // $99.00 AUD
    promotionalMonthlyPrice: 499, // $4.99 AUD
    promotionalMonths: 2,
    trialDays: 3,
    features: [
      'Basic tax return preparation',
      'ATO compliance checks',
      'Document storage (10GB)',
      'Email support',
      'Mobile app access',
    ],
  },
  PRO: {
    id: 'pro',
    name: 'TAAX Pro',
    description: 'Advanced features for complex tax situations',
    monthlyPriceId:
      process.env.NODE_ENV === 'production' ? 'price_pro_monthly_prod' : 'price_pro_monthly_test',
    annualPriceId:
      process.env.NODE_ENV === 'production' ? 'price_pro_annual_prod' : 'price_pro_annual_test',
    monthlyPrice: 1899, // $18.99 AUD
    annualPrice: 18900, // $189.00 AUD
    promotionalMonthlyPrice: 1099, // $10.99 AUD
    promotionalMonths: 2,
    trialDays: 7,
    features: [
      'Everything in TAAX Smart',
      'Advanced deduction finder',
      'Investment property support',
      'Capital gains calculator',
      'Priority support',
      'Unlimited document storage',
      'Tax planning tools',
      'Multi-year comparisons',
    ],
  },
};

export const getSubscriptionPlan = (planId: string): SubscriptionPlan | null => {
  return SUBSCRIPTION_PLANS[planId.toUpperCase()] || null;
};

export interface TaxInvoiceData {
  invoiceNumber: string;
  date: Date;
  customerName: string;
  customerEmail: string;
  customerABN?: string;
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  subtotal: number;
  gstAmount: number;
  total: number;
  supplierABN: string;
  supplierName: string;
  supplierAddress: string;
}

export const generateTaxInvoiceNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `INV-${year}${month}-${random}`;
};
