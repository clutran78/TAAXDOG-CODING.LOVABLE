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

    // Get the host from various sources (handle potential array values)
    const forwardedHost = req.headers['x-forwarded-host'];
    const hostHeader = req.headers.host;
    const host = 
      (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ||
      (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader);
    
    // Construct base URL
    let baseUrl: string;
    if (host) {
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      baseUrl = `${protocol}://${host}`;
    } else {
      // Fallback to NEXTAUTH_URL if host is not available
      const fallbackUrl = process.env.NEXTAUTH_URL;
      if (!fallbackUrl) {
        return apiResponse.error(res, 'Unable to determine application URL', 500);
      }
      baseUrl = fallbackUrl;
    }

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
