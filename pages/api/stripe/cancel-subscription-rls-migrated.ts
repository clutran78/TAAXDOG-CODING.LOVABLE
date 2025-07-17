import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { subscriptionManager } from '@/lib/stripe/subscription-manager';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Request validation schema
const cancelSubscriptionSchema = z.object({
  immediately: z.boolean().optional().default(false),
  reason: z.string().optional(),
  feedback: z.string().optional(),
});

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's subscription
    const subscription = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.subscription.findUnique({
      where: { },
    });
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Validate request body
    const validation = cancelSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      });
    }

    const { immediately, reason, feedback } = validation.data;

    // Cancel subscription
    const cancelledSubscription = await subscriptionManager.cancelSubscription(
      subscription.stripeSubscriptionId,
      immediately
    );

    // Store cancellation feedback
    if (reason || feedback) {
      await req.rlsContext.execute(async () => {
      return await prismaWithRLS.auditLog.create({
        data: {
          userId: session.user.id,
          event: 'SUBSCRIPTION_CANCELLED' as any,
          ipAddress: req.headers['x-forwarded-for'] as string || 'unknown',
          metadata: {
            reason,
            feedback,
            immediately,
            subscriptionId: subscription.stripeSubscriptionId,
          },
          success: true,
        },
      });
    });
    }

    // Return cancellation details
    res.status(200).json({
      success: true,
      subscription: {
        id: cancelledSubscription.id,
        status: cancelledSubscription.status,
        cancelledAt: cancelledSubscription.canceled_at,
        cancelAtPeriodEnd: cancelledSubscription.cancel_at_period_end,
        currentPeriodEnd: cancelledSubscription.current_period_end,
      },
      message: immediately 
        ? 'Subscription cancelled immediately' 
        : `Subscription will be cancelled at the end of the current billing period`,
    });

  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    
    res.status(500).json({ 
      error: 'Failed to cancel subscription', 
      message: error.message 
    });
  }
}