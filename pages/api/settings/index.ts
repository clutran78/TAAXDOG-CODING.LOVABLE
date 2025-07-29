import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';

import { ApiResponse } from '../../../lib/api/response';
import { withAuth } from '../../../lib/middleware/auth';
import prisma from '../../../lib/prisma';
import { authOptions } from '../auth/[...nextauth]';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(ApiResponse.error('Method not allowed'));
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json(ApiResponse.error('Unauthorized'));
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        postcode: true,
        abn: true,
        businessName: true,
        taxFileNumber: true,
        preferences: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return res.status(404).json(ApiResponse.error('User not found'));
    }

    // Parse preferences if stored as JSON
    let preferences = {
      currency: 'AUD',
      taxYear: 'current',
      emailNotifications: true,
      smsNotifications: false,
      marketingEmails: false,
      autoSync: true,
      syncFrequency: 'weekly',
      theme: 'light',
    };

    if (user.preferences && typeof user.preferences === 'string') {
      try {
        preferences = { ...preferences, ...JSON.parse(user.preferences) };
      } catch (e) {
        // Use defaults if parsing fails
      }
    } else if (user.preferences && typeof user.preferences === 'object') {
      preferences = { ...preferences, ...user.preferences };
    }

    const settings = {
      profile: {
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        abn: user.abn || '',
        businessName: user.businessName || '',
        taxFileNumber: user.taxFileNumber || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        postcode: user.postcode || '',
      },
      preferences,
      security: {
        twoFactorEnabled: user.twoFactorEnabled || false,
      },
      profileImage: user.image,
    };

    return res.status(200).json(ApiResponse.success(settings));
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return res.status(500).json(ApiResponse.error('Failed to fetch settings'));
  }
}

export default withAuth(handler);