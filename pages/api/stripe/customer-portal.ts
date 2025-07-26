import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { subscriptionManager } from '@/lib/stripe/subscription-manager';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

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

    if (!subscription || !subscription.stripeCustomerId) {
      return apiResponse.notFound(res, { error: 'No active subscription found' });
    }

    // Get return URL from request or use default
    const returnUrl = req.body.returnUrl || `${process.env.NEXTAUTH_URL}/dashboard/billing`;

    // Create portal session
    const portalUrl = await subscriptionManager.createPortalSession(
      subscription.stripeCustomerId,
      returnUrl,
    );

    // Log portal access
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        event: 'SUBSCRIPTION_PORTAL_ACCESS' as any,
        ipAddress: (req.headers['x-forwarded-for'] as string) || 'unknown',
        metadata: {
          customerId: subscription.stripeCustomerId,
          returnUrl,
        },
        success: true,
      },
    });

    // Return portal URL
    apiResponse.success(res, {
      success: true,
      url: portalUrl,
    });
  } catch (error: any) {
    logger.error('Customer portal error:', error);

    apiResponse.internalError(res, {
      error: 'Failed to create portal session',
      message: error.message,
    });
  }
}
