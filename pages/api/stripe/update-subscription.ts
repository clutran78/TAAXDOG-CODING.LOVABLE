import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { subscriptionManager } from '@/lib/stripe/subscription-manager';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

// Request validation schema
const updateSubscriptionSchema = z.object({
  planType: z.enum(['SMART', 'PRO']).optional(),
  billingInterval: z.enum(['monthly', 'annual']).optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  metadata: z.record(z.string()).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
      return apiResponse.unauthorized(res, { error: 'Unauthorized' });
    }

    // Get user's subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription) {
      return apiResponse.notFound(res, { error: 'No active subscription found' });
    }

    // Validate request body
    const validation = updateSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return apiResponse.error(res, {
        error: 'Invalid request data',
        details: validation.error.errors,
      });
    }

    const { planType, billingInterval, cancelAtPeriodEnd, metadata } = validation.data;

    // Update subscription
    const updatedSubscription = await subscriptionManager.updateSubscription({
      subscriptionId: subscription.stripeSubscriptionId,
      planType,
      billingInterval,
      cancelAtPeriodEnd,
      metadata,
    });

    // Return updated subscription details
    apiResponse.success(res, {
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        plan: planType || subscription.plan,
        billingInterval: billingInterval || subscription.interval,
        currentPeriodEnd: updatedSubscription.current_period_end,
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        trialEnd: updatedSubscription.trial_end,
      },
    });
  } catch (error: any) {
    logger.error('Update subscription error:', error);

    if (error.type === 'StripeInvalidRequestError') {
      return apiResponse.error(res, {
        error: 'Invalid request',
        message: error.message,
      });
    }

    apiResponse.internalError(res, {
      error: 'Failed to update subscription',
      message: error.message,
    });
  }
}
