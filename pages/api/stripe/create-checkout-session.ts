import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { SubscriptionService } from '../../../lib/stripe/subscription-service';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return apiResponse.unauthorized(res, { error: 'Unauthorized' });
    }

    const { planId, billingCycle } = req.body;

    if (!planId || !billingCycle) {
      return apiResponse.error(res, { error: 'Missing required parameters' });
    }

    if (!['monthly', 'annual'].includes(billingCycle)) {
      return apiResponse.error(res, { error: 'Invalid billing cycle' });
    }

    const subscriptionService = new SubscriptionService();

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    const checkoutSession = await subscriptionService.createCheckoutSession({
      userId: session.user.id,
      planId,
      billingCycle,
      successUrl: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/subscription/plans`,
    });

    apiResponse.success(res, { sessionId: checkoutSession.id });
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    apiResponse.internalError(res, {
      error: 'Failed to create checkout session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
