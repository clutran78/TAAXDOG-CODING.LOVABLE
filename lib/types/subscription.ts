/**
 * Subscription and billing type definitions
 */

import { MoneyAmount } from './financial';
import { AuditInfo } from './common';

// Subscription plans
export enum PlanId {
  TAAX_SMART = 'taax-smart',
  TAAX_PRO = 'taax-pro',
  TAAX_ENTERPRISE = 'taax-enterprise',
}

// Billing intervals
export enum BillingInterval {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
}

// Subscription status
export enum SubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
  PAUSED = 'paused',
}

// Payment status
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELED = 'canceled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

// Plan details
export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  features: string[];

  // Pricing
  basePrice: MoneyAmount;
  billingIntervals: BillingInterval[];

  // Trial
  trialDays: number;
  trialPrice?: MoneyAmount;

  // Discounts
  introductoryPrice?: MoneyAmount;
  introductoryPeriodMonths?: number;

  // Limits
  limits: {
    bankAccounts: number | 'unlimited';
    transactions: number | 'unlimited';
    receipts: number | 'unlimited';
    goals: number | 'unlimited';
    budgets: number | 'unlimited';
    aiRequests: number | 'unlimited';
    supportLevel: 'basic' | 'priority' | 'dedicated';
  };

  // Metadata
  isPopular?: boolean;
  sortOrder: number;
}

// Main subscription interface
export interface Subscription extends AuditInfo {
  id: string;
  userId: string;

  // Plan details
  planId: PlanId;
  plan?: Plan;
  billingInterval: BillingInterval;

  // Status
  status: SubscriptionStatus;

  // Dates
  startDate: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  canceledAt?: Date | null;
  cancelAtPeriodEnd: boolean;
  endedAt?: Date | null;

  // Pricing
  amount: number;
  currency: 'AUD';
  taxRate: number; // GST rate

  // Payment
  defaultPaymentMethodId?: string | null;
  latestInvoiceId?: string | null;

  // Stripe references
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;

  // Metadata
  metadata?: Record<string, string>;
}

// Payment method
export interface StripePaymentMethod {
  id: string;
  userId: string;

  // Type
  type: 'card' | 'bank_account' | 'paypal';

  // Card details (masked)
  card?: {
    brand: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
    last4: string;
    expMonth: number;
    expYear: number;
    country?: string;
    funding?: 'credit' | 'debit' | 'prepaid' | 'unknown';
  };

  // Bank account details (masked)
  bankAccount?: {
    bankName: string;
    last4: string;
    accountHolderType: 'individual' | 'company';
  };

  // Status
  isDefault: boolean;
  isVerified: boolean;

  // Stripe reference
  stripePaymentMethodId: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Invoice
export interface Invoice {
  id: string;
  subscriptionId: string;
  userId: string;

  // Invoice details
  invoiceNumber: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

  // Amounts (in cents)
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  currency: 'AUD';

  // Dates
  createdAt: Date;
  dueDate?: Date | null;
  paidAt?: Date | null;

  // Period
  periodStart: Date;
  periodEnd: Date;

  // Line items
  lineItems: InvoiceLineItem[];

  // Payment
  paymentIntentId?: string | null;
  paymentMethodId?: string | null;

  // Documents
  invoicePdfUrl?: string | null;
  taxInvoiceUrl?: string | null;

  // Stripe reference
  stripeInvoiceId: string;
}

// Invoice line item
export interface InvoiceLineItem {
  id: string;
  invoiceId: string;

  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;

  // Tax
  taxAmount: number;
  taxRate: number;

  // Period
  periodStart?: Date;
  periodEnd?: Date;

  // Type
  type: 'subscription' | 'addon' | 'usage' | 'discount' | 'tax';
}

// Payment/transaction record
export interface Payment {
  id: string;
  userId: string;

  // Payment details
  amount: number;
  currency: 'AUD';
  status: PaymentStatus;

  // Related entities
  subscriptionId?: string | null;
  invoiceId?: string | null;
  paymentMethodId?: string | null;

  // Processing
  processedAt?: Date | null;
  failureReason?: string | null;
  failureCode?: string | null;

  // Refund
  refundedAmount?: number;
  refunds?: Refund[];

  // Stripe reference
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;

  // Metadata
  description?: string;
  receiptUrl?: string | null;
  createdAt: Date;
}

// Refund
export interface Refund {
  id: string;
  paymentId: string;

  amount: number;
  currency: 'AUD';
  reason: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'other';
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';

  // Metadata
  notes?: string;
  processedAt?: Date | null;
  stripeRefundId?: string | null;
  createdAt: Date;
}

// Usage tracking (for metered billing)
export interface UsageRecord {
  id: string;
  subscriptionId: string;
  userId: string;

  // Usage details
  metric: 'ai_requests' | 'bank_accounts' | 'transactions' | 'receipts';
  quantity: number;
  timestamp: Date;

  // Billing
  includedInCurrentPeriod: boolean;
  billedAt?: Date | null;
}

// Subscription change/upgrade/downgrade
export interface SubscriptionChange {
  currentPlan: PlanId;
  newPlan: PlanId;
  currentBillingInterval: BillingInterval;
  newBillingInterval: BillingInterval;

  // Proration
  proratedAmount: number;
  credit: number;
  amountDue: number;

  // Timing
  effectiveDate: Date;
  immediateChange: boolean;
}

// Coupon/discount
export interface Coupon {
  id: string;
  code: string;
  description?: string;

  // Discount
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;

  // Validity
  validFrom: Date;
  validUntil?: Date | null;
  maxRedemptions?: number | null;
  redemptionCount: number;

  // Restrictions
  applicablePlans?: PlanId[];
  minimumAmount?: number;
  firstTimeCustomersOnly?: boolean;

  // Status
  isActive: boolean;
}
