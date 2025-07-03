import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { SubscriptionService } from '../../../lib/stripe/subscription-service';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscriptionService = new SubscriptionService();
    
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const returnUrl = `${protocol}://${host}/account/subscription`;

    const portalSession = await subscriptionService.createBillingPortalSession(
      session.user.id,
      returnUrl
    );

    res.status(200).json({ url: portalSession.url });
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    res.status(500).json({ 
      error: 'Failed to create billing portal session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}