import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { ApiResponse } from '../../../lib/api/response';
import { withAuth } from '../../../lib/middleware/auth';
import prisma from '../../../lib/prisma';
import { authOptions } from '../auth/[...nextauth]';


// Preferences schema
const preferencesSchema = z.object({
  currency: z.enum(['AUD', 'USD', 'EUR', 'GBP']),
  taxYear: z.enum(['current', 'previous']),
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  marketingEmails: z.boolean(),
  autoSync: z.boolean(),
  syncFrequency: z.enum(['daily', 'weekly', 'monthly']),
  theme: z.enum(['light', 'dark', 'system']),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json(ApiResponse.error('Method not allowed'));
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json(ApiResponse.error('Unauthorized'));
    }

    // Validate request body
    const validationResult = preferencesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json(
        ApiResponse.error(validationResult.error.errors[0].message)
      );
    }

    const preferences = validationResult.data;

    // Update user preferences
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: JSON.stringify(preferences),
      },
    });

    return res.status(200).json(ApiResponse.success({
      message: 'Preferences updated successfully',
      preferences,
    }));
  } catch (error) {
    console.error('Error updating preferences:', error);
    return res.status(500).json(ApiResponse.error('Failed to update preferences'));
  }
}

export default withAuth(handler);