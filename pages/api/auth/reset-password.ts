import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import {
  hashPassword,
  verifyPassword,
  getClientIP,
  validatePasswordStrength,
} from "../../../lib/auth/auth-utils";
import { resetPasswordSchema, validateInput } from "../../../lib/auth/validation";
import { passwordResetRateLimiter } from "../../../lib/auth/rate-limiter";
import { AuthEvent } from "../../../generated/prisma";
import { withSecurity } from "../../../lib/middleware/security";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Apply rate limiting
  const rateLimitOk = await passwordResetRateLimiter(req, res);
  if (!rateLimitOk) return;

  const startTime = Date.now();
  const clientIp = getClientIP(req);

  try {
    // Validate input
    const validation = validateInput(resetPasswordSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: validation.errors,
      });
    }

    const { token, password } = validation.data;

    // Additional password strength check
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet requirements',
        errors: { password: passwordValidation.errors }
      });
    }

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(), // Token must not be expired
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
      },
    });

    if (!user) {
      // Log failed attempt
      await prisma.auditLog.create({
        data: {
          event: AuthEvent.PASSWORD_RESET,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            reason: 'Invalid or expired token',
            token: token.substring(0, 8) + '...', // Log partial token for debugging
          },
        },
      });

      return res.status(400).json({
        error: 'Invalid or expired token',
        message: 'This password reset link is invalid or has expired. Please request a new one.',
      });
    }

    // Check if new password is same as current password
    if (user.password && await verifyPassword(password, user.password)) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'New password must be different from your current password',
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update user password and clear reset token in transaction
    await prisma.$transaction(async (tx) => {
      // Update password and clear reset token
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
          failedLoginAttempts: 0, // Reset failed login attempts
          lockedUntil: null, // Clear any lockout
          emailVerified: new Date(), // Verify email if not already verified
        },
      });

      // Log successful password reset
      await tx.auditLog.create({
        data: {
          event: AuthEvent.PASSWORD_RESET,
          userId: user.id,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            action: 'password_reset_completed',
          },
        },
      });

      // Clear all existing sessions for security
      await tx.session.deleteMany({
        where: { userId: user.id },
      });
    });

    const duration = Date.now() - startTime;
    console.log('[ResetPassword] Password reset successful:', {
      userId: user.id,
      email: user.email,
      duration: `${duration}ms`,
      ip: clientIp,
    });

    // Return success response
    return res.status(200).json({
      message: 'Password reset successfully. You can now login with your new password.',
      success: true,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Log error
    console.error('[ResetPassword] Password reset error:', {
      error: error.message,
      code: error.code,
      duration: `${duration}ms`,
      ip: clientIp,
    });

    // Generic error response
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
}

// Export with CSRF protection
export default withSecurity(handler, {
  requireAuth: false,
  csrf: true,
  rateLimit: 'auth',
  allowedMethods: ['POST']
});