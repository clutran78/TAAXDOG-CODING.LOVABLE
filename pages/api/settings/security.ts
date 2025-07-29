import bcrypt from 'bcryptjs';
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { ApiResponse } from '../../../lib/api/response';
import { withAuth } from '../../../lib/middleware/auth';
import prisma from '../../../lib/prisma';
import { auditLogger } from '../../../lib/services/auditLogger';
import { authOptions } from '../auth/[...nextauth]';

// Security update schema
const securityUpdateSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
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
    const validationResult = securityUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json(
        ApiResponse.error(validationResult.error.errors[0].message)
      );
    }

    const { currentPassword, newPassword } = validationResult.data;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });

    if (!user || !user.password) {
      return res.status(400).json(ApiResponse.error('Invalid user account'));
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json(ApiResponse.error('Current password is incorrect'));
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
      },
    });

    // Log the password change
    await auditLogger.log({
      action: 'PASSWORD_CHANGE',
      userId: session.user.id,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json(ApiResponse.success({
      message: 'Password updated successfully',
    }));
  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(500).json(ApiResponse.error('Failed to update password'));
  }
}

export default withAuth(handler);