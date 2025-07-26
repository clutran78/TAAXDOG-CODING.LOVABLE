import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions, logAuthEvent } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { logger } from '@/lib/logger';
import {
  generateTOTPSecret,
  verifyTOTP,
  generateSecureToken,
} from '../../../lib/security/encryption';
import { sendTwoFactorCode } from '../../../lib/email';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return apiResponse.unauthorized(res, { message: 'Unauthorized' });
  }

  switch (req.method) {
    case 'GET':
      return getTwoFactorStatus(req, res, session.user.id);
    case 'POST':
      return enableTwoFactor(req, res, session.user.id);
    case 'PUT':
      return verifyTwoFactor(req, res, session.user.id);
    case 'DELETE':
      return disableTwoFactor(req, res, session.user.id);
    default:
      return apiResponse.methodNotAllowed(res, { message: 'Method not allowed' });
  }
}

// Get two-factor authentication status
async function getTwoFactorStatus(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        email: true,
      },
    });

    if (!user) {
      return apiResponse.notFound(res, { message: 'User not found' });
    }

    apiResponse.success(res, {
      enabled: user.twoFactorEnabled,
      methods: user.twoFactorEnabled ? ['authenticator', 'email'] : [],
    });
  } catch (error) {
    logger.error('Get 2FA status error:', error);
    apiResponse.internalError(res, { message: 'Failed to get 2FA status' });
  }
}

// Enable two-factor authentication
async function enableTwoFactor(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const { method = 'authenticator' } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      return apiResponse.notFound(res, { message: 'User not found' });
    }

    if (user.twoFactorEnabled) {
      return apiResponse.error(res, {
        message: 'Two-factor authentication is already enabled',
        enabled: true,
      });
    }

    if (method === 'authenticator') {
      // Generate TOTP secret
      const secret = speakeasy.generateSecret({
        name: `TaxReturnPro (${user.email})`,
        issuer: 'TaxReturnPro',
        length: 32,
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

      // Store the secret temporarily (encrypted)
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorSecret: secret.base32, // In production, encrypt this
        },
      });

      apiResponse.success(res, {
        method: 'authenticator',
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32.match(/.{1,4}/g)?.join(' '), // Format for manual entry
        message: 'Scan the QR code with your authenticator app and enter the verification code',
      });
    } else if (method === 'email') {
      // Generate email verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Store code temporarily (expires in 10 minutes)
      await prisma.verificationToken.create({
        data: {
          identifier: user.email,
          token: `2fa_${code}`,
          expires: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      // Send email
      await sendTwoFactorCode(user.email, user.name, code);

      apiResponse.success(res, {
        method: 'email',
        message: 'Verification code sent to your email',
      });
    } else {
      return apiResponse.error(res, { message: 'Invalid 2FA method' });
    }

    // Log 2FA setup attempt
    await logAuthEvent({
      event: 'TWO_FACTOR_ENABLED',
      userId,
      success: true,
      metadata: { method, step: 'initiated' },
      req,
    });
  } catch (error) {
    logger.error('Enable 2FA error:', error);
    apiResponse.internalError(res, { message: 'Failed to enable 2FA' });
  }
}

// Verify two-factor code
async function verifyTwoFactor(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const { code, method = 'authenticator' } = req.body;

    if (!code) {
      return apiResponse.error(res, { message: 'Verification code is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return apiResponse.notFound(res, { message: 'User not found' });
    }

    let isValid = false;

    if (method === 'authenticator') {
      if (!user.twoFactorSecret) {
        return apiResponse.error(res, { message: '2FA setup not initiated' });
      }

      // Verify TOTP code
      isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 2, // Allow 2 time steps before/after
      });
    } else if (method === 'email') {
      // Verify email code
      const verificationToken = await prisma.verificationToken.findFirst({
        where: {
          identifier: user.email,
          token: `2fa_${code}`,
          expires: { gt: new Date() },
        },
      });

      if (verificationToken) {
        isValid = true;
        // Delete used token
        await prisma.verificationToken.delete({
          where: {
            identifier_token: {
              identifier: user.email,
              token: `2fa_${code}`,
            },
          },
        });
      }
    }

    if (!isValid) {
      await logAuthEvent({
        event: 'TWO_FACTOR_FAILED',
        userId,
        success: false,
        metadata: { method, reason: 'Invalid code' },
        req,
      });
      return apiResponse.error(res, { message: 'Invalid verification code' });
    }

    // Enable 2FA if not already enabled
    if (!user.twoFactorEnabled) {
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true },
      });

      // Generate backup codes
      const backupCodes = Array.from({ length: 8 }, () => generateSecureToken(4).toUpperCase());

      // Store backup codes (encrypted in production)
      // For now, return them to the user

      await logAuthEvent({
        event: 'TWO_FACTOR_ENABLED',
        userId,
        success: true,
        metadata: { method, step: 'completed' },
        req,
      });

      return apiResponse.success(res, {
        message: 'Two-factor authentication enabled successfully',
        enabled: true,
        backupCodes,
        warning: "Save these backup codes in a secure place. You won't be able to see them again.",
      });
    }

    // If already enabled, this is just a verification
    await logAuthEvent({
      event: 'TWO_FACTOR_SUCCESS',
      userId,
      success: true,
      metadata: { method },
      req,
    });

    apiResponse.success(res, {
      message: 'Verification successful',
      verified: true,
    });
  } catch (error) {
    logger.error('Verify 2FA error:', error);
    apiResponse.internalError(res, { message: 'Failed to verify 2FA code' });
  }
}

// Disable two-factor authentication
async function disableTwoFactor(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const { password } = req.body;

    if (!password) {
      return apiResponse.error(res, { message: 'Password is required to disable 2FA' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        password: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return apiResponse.notFound(res, { message: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return apiResponse.error(res, {
        message: 'Two-factor authentication is not enabled',
        enabled: false,
      });
    }

    // Verify password
    const bcrypt = await import('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, user.password!);

    if (!isPasswordValid) {
      await logAuthEvent({
        event: 'TWO_FACTOR_DISABLED',
        userId,
        success: false,
        metadata: { reason: 'Invalid password' },
        req,
      });
      return apiResponse.unauthorized(res, { message: 'Invalid password' });
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    await logAuthEvent({
      event: 'TWO_FACTOR_DISABLED',
      userId,
      success: true,
      req,
    });

    apiResponse.success(res, {
      message: 'Two-factor authentication disabled successfully',
      enabled: false,
    });
  } catch (error) {
    logger.error('Disable 2FA error:', error);
    apiResponse.internalError(res, { message: 'Failed to disable 2FA' });
  }
}

// Challenge endpoint for login with 2FA
export async function challengeTwoFactor(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { message: 'Method not allowed' });
  }

  try {
    const { email, code, method = 'authenticator' } = req.body;

    if (!email || !code) {
      return apiResponse.error(res, { message: 'Email and code are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user || !user.twoFactorEnabled) {
      return apiResponse.error(res, { message: 'Invalid request' });
    }

    let isValid = false;

    if (method === 'authenticator' && user.twoFactorSecret) {
      isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 2,
      });
    }
    // Add email method verification if needed

    if (!isValid) {
      await logAuthEvent({
        event: 'TWO_FACTOR_FAILED',
        userId: user.id,
        success: false,
        req,
      });
      return apiResponse.error(res, { message: 'Invalid verification code' });
    }

    await logAuthEvent({
      event: 'TWO_FACTOR_SUCCESS',
      userId: user.id,
      success: true,
      req,
    });

    // Return success - the actual login is handled by NextAuth
    apiResponse.success(res, {
      success: true,
      message: '2FA verification successful',
    });
  } catch (error) {
    logger.error('2FA challenge error:', error);
    apiResponse.internalError(res, { message: 'Failed to verify 2FA' });
  }
}
