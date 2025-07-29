import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { ApiResponse } from '../../../lib/api/response';
import { withAuth } from '../../../lib/middleware/auth';
import prisma from '../../../lib/prisma';
import { auditLogger } from '../../../lib/services/auditLogger';
import { authOptions } from '../auth/[...nextauth]';

// 2FA toggle schema
const twoFactorSchema = z.object({
  enabled: z.boolean(),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiResponse.error('Method not allowed'));
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json(ApiResponse.error('Unauthorized'));
    }

    // Validate request body
    const validationResult = twoFactorSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json(
        ApiResponse.error(validationResult.error.errors[0].message)
      );
    }

    const { enabled } = validationResult.data;

    // Update 2FA status
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: enabled,
      },
    });

    // Log the 2FA change
    await auditLogger.log({
      action: enabled ? '2FA_ENABLED' : '2FA_DISABLED',
      userId: session.user.id,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json(ApiResponse.success({
      message: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'} successfully`,
      twoFactorEnabled: enabled,
    }));
  } catch (error) {
    console.error('Error updating 2FA settings:', error);
    return res.status(500).json(ApiResponse.error('Failed to update 2FA settings'));
  }
}

export default withAuth(handler);