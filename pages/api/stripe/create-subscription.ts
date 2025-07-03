import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { subscriptionManager } from '@/lib/stripe/subscription-manager';
import { z } from 'zod';

// Request validation schema
const createSubscriptionSchema = z.object({
  planType: z.enum(['SMART', 'PRO']),
  billingInterval: z.enum(['monthly', 'annual']),
  paymentMethodId: z.string().optional(),
  couponCode: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate request body
    const validation = createSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      });
    }

    const { planType, billingInterval, paymentMethodId, couponCode, metadata } = validation.data;

    // Create subscription
    const result = await subscriptionManager.createSubscription({
      userId: session.user.id,
      customerEmail: session.user.email!,
      planType,
      billingInterval,
      paymentMethodId,
      couponCode,
      metadata: {
        ...metadata,
        source: 'web_app',
      },
    });

    // Return subscription details
    res.status(200).json({
      success: true,
      subscription: {
        id: result.subscription.id,
        status: result.subscription.status,
        trialEnd: result.subscription.trial_end,
        currentPeriodEnd: result.subscription.current_period_end,
        cancelAtPeriodEnd: result.subscription.cancel_at_period_end,
      },
      clientSecret: result.clientSecret,
    });

  } catch (error: any) {
    console.error('Create subscription error:', error);
    
    if (error.type === 'StripeCardError') {
      return res.status(400).json({ 
        error: 'Payment failed', 
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create subscription', 
      message: error.message 
    });
  }
}