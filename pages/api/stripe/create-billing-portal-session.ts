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

    const subscriptionService = new SubscriptionService();

    // Get the host from various sources (handle potential array values)
    const forwardedHost = req.headers['x-forwarded-host'];
    const hostHeader = req.headers.host;
    const host = 
      (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ||
      (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader);
    
    // Construct return URL
    let returnUrl: string;
    if (host) {
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      returnUrl = `${protocol}://${host}/account/subscription`;
    } else {
      // Fallback to NEXTAUTH_URL if host is not available
      const fallbackUrl = process.env.NEXTAUTH_URL;
      if (!fallbackUrl) {
        return apiResponse.error(res, 'Unable to determine application URL', 500);
      }
      returnUrl = `${fallbackUrl}/account/subscription`;
    }

    const portalSession = await subscriptionService.createBillingPortalSession(
      session.user.id,
      returnUrl,
    );

    apiResponse.success(res, { url: portalSession.url });
  } catch (error) {
    logger.error('Error creating billing portal session:', error);
    apiResponse.internalError(res, {
      error: 'Failed to create billing portal session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
