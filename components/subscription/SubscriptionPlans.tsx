import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { SUBSCRIPTION_PLANS, formatCurrency, getStripePublishableKey } from '../../lib/stripe';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { logger } from '@/lib/logger';

// Only load Stripe on the client side
let stripePromise: ReturnType<typeof loadStripe> | null = null;

const getStripe = (): ReturnType<typeof loadStripe> | null => {
  if (!stripePromise && typeof window !== 'undefined') {
    try {
      stripePromise = loadStripe(getStripePublishableKey());
    } catch (error) {
      logger.error('Failed to load Stripe:', error);
    }
  }
  return stripePromise;
};

export const SubscriptionPlans: React.FC = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const handleSubscribe = async (planId: string) => {
    if (!session?.user) {
      void router.push('/auth/login');
      return;
    }

    setLoading(planId);

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          billingCycle,
        }),
      });

      const { sessionId } = await response.json();
      const stripe = await getStripe();

      if (stripe) {
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          logger.error('Stripe error:', error);
        }
      }
    } catch (error) {
      logger.error('Error creating checkout session:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Choose Your TAAX Plan</h2>
        <p className="mt-4 text-lg text-gray-600">Start with a free trial. Cancel anytime.</p>

        <div className="mt-6 flex justify-center">
          <div className="bg-gray-100 p-1 rounded-lg inline-flex">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'annual'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Annual (Save 17%)
            </button>
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:gap-12">
        {Object.values(SUBSCRIPTION_PLANS).map((plan) => (
          <div
            key={plan.id}
            className="relative rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-shadow"
          >
            {plan.id === 'pro' && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
            )}

            <div className="p-8">
              <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
              <p className="mt-4 text-gray-600">{plan.description}</p>

              <div className="mt-6">
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-gray-900">
                    {formatCurrency(
                      billingCycle === 'annual'
                        ? plan.annualPrice / 12
                        : plan.promotionalMonthlyPrice,
                    )}
                  </span>
                  <span className="ml-1 text-gray-600">/month</span>
                </div>

                {billingCycle === 'monthly' && (
                  <p className="mt-2 text-sm text-green-600">
                    Early access price for first {plan.promotionalMonths} months
                  </p>
                )}

                {billingCycle === 'annual' && (
                  <p className="mt-2 text-sm text-green-600">
                    Billed annually at {formatCurrency(plan.annualPrice)}
                  </p>
                )}

                <p className="mt-2 text-sm text-gray-500">
                  {plan.trialDays}-day free trial • Cancel anytime
                </p>

                {billingCycle === 'monthly' && (
                  <p className="mt-1 text-sm text-gray-500">
                    Then {formatCurrency(plan.monthlyPrice)}/month
                  </p>
                )}
              </div>

              <ul className="mt-8 space-y-4">
                {plan.features.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-start"
                  >
                    <svg
                      className="h-5 w-5 text-green-500 mt-0.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="ml-3 text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading !== null}
                className={`mt-8 w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  plan.id === 'pro'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === plan.id ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 mr-2"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  `Start ${plan.trialDays}-Day Free Trial`
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <p className="text-sm text-gray-500">
          All prices include 10% GST • Australian dollars (AUD)
        </p>
        <p className="mt-2 text-sm text-gray-500">
          By subscribing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};
