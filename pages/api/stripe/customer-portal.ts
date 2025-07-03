import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { subscriptionManager } from '@/lib/stripe/subscription-manager';
import { prisma } from '@/lib/prisma';

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

    // Get user's subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription || !subscription.stripeCustomerId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Get return URL from request or use default
    const returnUrl = req.body.returnUrl || `${process.env.NEXTAUTH_URL}/dashboard/billing`;

    // Create portal session
    const portalUrl = await subscriptionManager.createPortalSession(
      subscription.stripeCustomerId,
      returnUrl
    );

    // Log portal access
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        event: 'SUBSCRIPTION_PORTAL_ACCESS' as any,
        ipAddress: req.headers['x-forwarded-for'] as string || 'unknown',
        metadata: {
          customerId: subscription.stripeCustomerId,
          returnUrl,
        },
        success: true,
      },
    });

    // Return portal URL
    res.status(200).json({
      success: true,
      url: portalUrl,
    });

  } catch (error: any) {
    console.error('Customer portal error:', error);
    
    res.status(500).json({ 
      error: 'Failed to create portal session', 
      message: error.message 
    });
  }
}