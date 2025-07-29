import { logger } from '@/lib/logger';
import { showToast } from '@/lib/utils/helpers';

/**
 * Subscription Service
 * Handles subscription and billing operations using PostgreSQL via Next.js API routes
 */

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'TRIALING' | 'PAUSED';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingHistory {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  invoiceUrl?: string;
  created: string;
  periodStart: string;
  periodEnd: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  stripePriceId: string;
}

// Fetch current subscription
export const fetchCurrentSubscription = async (): Promise<Subscription | null> => {
  try {
    const response = await fetch('/api/stripe/subscription', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (response.status === 404) {
      return null; // No subscription found
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch subscription');
    }

    const data = await response.json();
    return data.data || data;
  } catch (error) {
    logger.error('Error fetching subscription:', error);
    showToast('Error loading subscription details', 'danger');
    throw error;
  }
};

// Fetch billing history
export const fetchBillingHistory = async (limit = 10): Promise<BillingHistory[]> => {
  try {
    const response = await fetch(`/api/stripe/billing-history?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch billing history');
    }

    const data = await response.json();
    return data.data || data.invoices || [];
  } catch (error) {
    logger.error('Error fetching billing history:', error);
    showToast('Error loading billing history', 'danger');
    return [];
  }
};

// Fetch available plans
export const fetchSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  try {
    const response = await fetch('/api/stripe/plans', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch subscription plans');
    }

    const data = await response.json();
    return data.data || data.plans || [];
  } catch (error) {
    logger.error('Error fetching subscription plans:', error);
    showToast('Error loading subscription plans', 'danger');
    return [];
  }
};

// Create or update subscription
export const createOrUpdateSubscription = async (priceId: string): Promise<{
  subscriptionId?: string;
  clientSecret?: string;
  requiresAction?: boolean;
}> => {
  try {
    const response = await fetch('/api/stripe/create-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ priceId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create subscription');
    }

    const data = await response.json();
    
    if (data.requiresAction) {
      showToast('Additional authentication required', 'info');
    } else {
      showToast('Subscription updated successfully', 'success');
    }
    
    return data;
  } catch (error) {
    logger.error('Error creating/updating subscription:', error);
    showToast('Error updating subscription', 'danger');
    throw error;
  }
};

// Cancel subscription
export const cancelSubscription = async (immediate = false): Promise<Subscription> => {
  try {
    const response = await fetch('/api/stripe/cancel-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ immediate }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to cancel subscription');
    }

    const data = await response.json();
    const canceledSubscription = data.data || data;
    
    if (immediate) {
      showToast('Subscription cancelled immediately', 'success');
    } else {
      showToast('Subscription will be cancelled at the end of the billing period', 'success');
    }
    
    return canceledSubscription;
  } catch (error) {
    logger.error('Error cancelling subscription:', error);
    showToast('Error cancelling subscription', 'danger');
    throw error;
  }
};

// Resume cancelled subscription
export const resumeSubscription = async (): Promise<Subscription> => {
  try {
    const response = await fetch('/api/stripe/resume-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to resume subscription');
    }

    const data = await response.json();
    const resumedSubscription = data.data || data;
    
    showToast('Subscription resumed successfully', 'success');
    return resumedSubscription;
  } catch (error) {
    logger.error('Error resuming subscription:', error);
    showToast('Error resuming subscription', 'danger');
    throw error;
  }
};

// Update payment method
export const updatePaymentMethod = async (paymentMethodId: string): Promise<void> => {
  try {
    const response = await fetch('/api/stripe/update-payment-method', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ paymentMethodId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update payment method');
    }

    showToast('Payment method updated successfully', 'success');
  } catch (error) {
    logger.error('Error updating payment method:', error);
    showToast('Error updating payment method', 'danger');
    throw error;
  }
};

// Get Stripe customer portal URL
export const getCustomerPortalUrl = async (): Promise<string> => {
  try {
    const response = await fetch('/api/stripe/customer-portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get customer portal URL');
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    logger.error('Error getting customer portal URL:', error);
    showToast('Error accessing billing portal', 'danger');
    throw error;
  }
};

// Check subscription status
export const checkSubscriptionStatus = async (): Promise<{
  hasActiveSubscription: boolean;
  isTrialing: boolean;
  daysUntilRenewal?: number;
  plan?: string;
}> => {
  try {
    const subscription = await fetchCurrentSubscription();
    
    if (!subscription) {
      return {
        hasActiveSubscription: false,
        isTrialing: false,
      };
    }

    const now = new Date();
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const daysUntilRenewal = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      hasActiveSubscription: subscription.status === 'ACTIVE' || subscription.status === 'TRIALING',
      isTrialing: subscription.status === 'TRIALING',
      daysUntilRenewal: daysUntilRenewal > 0 ? daysUntilRenewal : 0,
      plan: subscription.planId,
    };
  } catch (error) {
    logger.error('Error checking subscription status:', error);
    return {
      hasActiveSubscription: false,
      isTrialing: false,
    };
  }
};