import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { subscriptionManager } from '@/lib/stripe/subscription-manager';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { apiResponse } from '@/lib/api/response';

// Request validation schema
const cancelSubscriptionSchema = z.object({
  immediately: z.boolean().optional().default(false),
  reason: z.string().optional(),
  feedback: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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
    const validation = cancelSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return apiResponse.error(res, {
        error: 'Invalid request data',
        details: validation.error.errors,
      });
    }

    const { immediately, reason, feedback } = validation.data;

    // Cancel subscription
    const cancelledSubscription = await subscriptionManager.cancelSubscription(
      subscription.stripeSubscriptionId,
      immediately,
    );

    // Store cancellation feedback
    if (reason || feedback) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          event: 'SUBSCRIPTION_CANCELLED' as any,
          ipAddress: (req.headers['x-forwarded-for'] as string) || 'unknown',
          metadata: {
            reason,
            feedback,
            immediately,
            subscriptionId: subscription.stripeSubscriptionId,
          },
          success: true,
        },
      });
    }

    // Return cancellation details
    apiResponse.success(res, {
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
    // Log sanitized error information
    console.error('[Cancel Subscription] Error occurred:', {
      error: error?.message || 'Unknown error',
      code: error?.code,
      type: error?.type,
      statusCode: error?.statusCode,
      timestamp: new Date().toISOString(),
    });

    // Send generic error response to client
    apiResponse.internalError(res, {
      error: 'Failed to cancel subscription',
      message:
        'An error occurred while cancelling your subscription. Please try again or contact support.',
    });
  }
}
