import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions, logAuthEvent } from '../../../lib/auth';
import prisma from '../../../lib/prisma';
import { InputValidator } from '../../../lib/security/middleware';
import { encryptTFN, decryptTFN, maskSensitiveData } from '../../../lib/security/encryption';
import { TaxResidency } from '@prisma/client';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return apiResponse.unauthorized(res, { message: 'Unauthorized' });
  }

  switch (req.method) {
    case 'GET':
      return getProfile(req, res, session.user.id);
    case 'PUT':
      return updateProfile(req, res, session.user.id);
    case 'DELETE':
      return deleteAccount(req, res, session.user.id);
    default:
      return apiResponse.methodNotAllowed(res, { message: 'Method not allowed' });
  }
}

// Get user profile
async function getProfile(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        image: true,
        role: true,
        abn: true,
        tfn: true,
        taxResidency: true,
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
        lastLoginAt: true,
        // Include subscription info
        subscriptions: {
          where: { status: { in: ['active', 'trialing'] } },
          select: {
            plan: true,
            status: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    if (!user) {
      return apiResponse.notFound(res, { message: 'User not found' });
    }

    // Decrypt and mask sensitive data
    const profile = {
      ...user,
      tfn: user.tfn ? maskSensitiveData(decryptTFN(user.tfn) || '', 3, 3) : null,
      subscription: user.subscriptions[0] || null,
    };

    // Remove the subscriptions array
    delete (profile as any).subscriptions;

    apiResponse.success(res, { profile });
  } catch (error) {
    logger.error('Get profile error:', error);
    apiResponse.internalError(res, { message: 'Failed to retrieve profile' });
  }
}

// Update user profile
async function updateProfile(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const { name, phone, abn, tfn, taxResidency, image } = req.body;

    // Validate inputs
    const updates: any = {};

    if (name !== undefined) {
      if (!name || name.trim().length < 2) {
        return apiResponse.error(res, { message: 'Name must be at least 2 characters' });
      }
      updates.name = InputValidator.sanitizeInput(name);
    }

    if (phone !== undefined) {
      if (phone && !InputValidator.isValidAustralianPhone(phone)) {
        return apiResponse.error(res, { message: 'Invalid Australian phone number format' });
      }
      updates.phone = phone ? phone.replace(/\s/g, '') : null;
    }

    if (abn !== undefined) {
      if (abn && !InputValidator.isValidABN(abn)) {
        return apiResponse.error(res, { message: 'Invalid ABN format' });
      }
      updates.abn = abn ? abn.replace(/\s/g, '') : null;
    }

    if (tfn !== undefined) {
      if (tfn && !InputValidator.isValidTFNFormat(tfn)) {
        return apiResponse.error(res, { message: 'Invalid TFN format' });
      }
      updates.tfn = tfn ? encryptTFN(tfn) : null;
    }

    if (taxResidency !== undefined) {
      if (!Object.values(TaxResidency).includes(taxResidency)) {
        return apiResponse.error(res, { message: 'Invalid tax residency status' });
      }
      updates.taxResidency = taxResidency;
    }

    if (image !== undefined) {
      // Basic URL validation
      if (image && !image.startsWith('http')) {
        return apiResponse.error(res, { message: 'Invalid image URL' });
      }
      updates.image = image;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        image: true,
        abn: true,
        taxResidency: true,
      },
    });

    // Log profile update
    await logAuthEvent({
      event: 'REGISTER', // Using REGISTER as profile update event
      userId,
      success: true,
      metadata: {
        action: 'profile_update',
        fieldsUpdated: Object.keys(updates),
      },
      req,
    });

    apiResponse.success(res, {
      message: 'Profile updated successfully',
      profile: updatedUser,
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    apiResponse.internalError(res, { message: 'Failed to update profile' });
  }
}

// Delete account (GDPR/APP compliance)
async function deleteAccount(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const { password, reason } = req.body;

    if (!password) {
      return apiResponse.error(res, { message: 'Password is required to delete account' });
    }

    // Verify user password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, email: true },
    });

    if (!user || !user.password) {
      return apiResponse.error(res, { message: 'Cannot delete this account type' });
    }

    const bcrypt = await import('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await logAuthEvent({
        event: 'SUSPICIOUS_ACTIVITY',
        userId,
        success: false,
        metadata: {
          action: 'account_deletion_failed',
          reason: 'Invalid password',
        },
        req,
      });
      return apiResponse.unauthorized(res, { message: 'Invalid password' });
    }

    // Create deletion record for audit
    await logAuthEvent({
      event: 'REGISTER', // Using REGISTER for account events
      userId,
      success: true,
      metadata: {
        action: 'account_deletion_requested',
        reason: reason || 'User requested',
        deletionDate: new Date().toISOString(),
      },
      req,
    });

    // Anonymize user data instead of hard delete (data retention compliance)
    const anonymizedEmail = `deleted_${Date.now()}@taxreturnpro.com.au`;

    await prisma.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        name: 'Deleted User',
        phone: null,
        image: null,
        abn: null,
        tfn: null,
        password: null,
        // Keep the record but mark as deleted
        emailVerified: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    // Cancel any active subscriptions
    await prisma.subscription.updateMany({
      where: {
        userId,
        status: { in: ['active', 'trialing'] },
      },
      data: {
        status: 'canceled',
        cancelledAt: new Date(),
      },
    });

    apiResponse.success(res, {
      message:
        'Account deleted successfully. Your data has been anonymized in compliance with privacy regulations.',
    });
  } catch (error) {
    logger.error('Delete account error:', error);
    apiResponse.internalError(res, { message: 'Failed to delete account' });
  }
}

// Data export endpoint (GDPR/APP compliance)
export async function exportUserData(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return apiResponse.unauthorized(res, { message: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return apiResponse.methodNotAllowed(res, { message: 'Method not allowed' });
  }

  try {
    // Collect all user data
    const userData = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        accounts: true,
        sessions: {
          select: {
            id: true,
            expires: true,
            createdAt: true,
          },
        },
        auditLogs: {
          select: {
            event: true,
            ipAddress: true,
            createdAt: true,
            success: true,
          },
        },
        subscriptions: true,
        taxReturns: true,
        payments: true,
        aiConversations: {
          select: {
            id: true,
            createdAt: true,
            tokensUsed: true,
          },
        },
        receipts: true,
        budgets: true,
      },
    });

    if (!userData) {
      return apiResponse.notFound(res, { message: 'User not found' });
    }

    // Decrypt sensitive data for export
    if (userData.tfn) {
      userData.tfn = decryptTFN(userData.tfn) || '[Encrypted]';
    }

    // Remove sensitive fields
    delete (userData as any).password;
    delete (userData as any).twoFactorSecret;

    // Log data export
    await logAuthEvent({
      event: 'REGISTER',
      userId: session.user.id,
      success: true,
      metadata: {
        action: 'data_export',
        timestamp: new Date().toISOString(),
      },
      req,
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="taxreturnpro-data-${Date.now()}.json"`,
    );

    apiResponse.success(res, {
      exportDate: new Date().toISOString(),
      userData,
    });
  } catch (error) {
    logger.error('Data export error:', error);
    apiResponse.internalError(res, { message: 'Failed to export user data' });
  }
}
