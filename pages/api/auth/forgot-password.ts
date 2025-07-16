import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { 
  generatePasswordResetToken,
  getClientIP,
} from "../../../lib/auth/auth-utils";
import { forgotPasswordSchema, validateInput } from "../../../lib/auth/validation";
import { passwordResetRateLimiter } from "../../../lib/auth/rate-limiter";
import { sendPasswordResetEmail } from "../../../lib/email";
import { AuthEvent } from "../../../generated/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const validation = validateInput(forgotPasswordSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: validation.errors,
      });
    }

    const { email } = validation.data;

    // Always return success to prevent email enumeration
    const successResponse = {
      message: 'If an account exists with this email, you will receive password reset instructions.',
    };

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        passwordResetToken: true,
        passwordResetExpires: true,
      },
    });

    if (!user) {
      // Don't reveal if user exists
      await new Promise(resolve => setTimeout(resolve, 1000)); // Prevent timing attacks
      console.log('[ForgotPassword] User not found:', email);
      return res.status(200).json(successResponse);
    }

    // Check if email is verified
    if (!user.emailVerified) {
      console.log('[ForgotPassword] Email not verified:', email);
      return res.status(200).json(successResponse);
    }
    
    // Check if there's an existing valid reset token
    if (user.passwordResetToken && user.passwordResetExpires && new Date() < new Date(user.passwordResetExpires)) {
      console.log('[ForgotPassword] Existing valid reset token found:', email);
      
      // Log the attempt
      await prisma.auditLog.create({
        data: {
          event: AuthEvent.PASSWORD_RESET,
          userId: user.id,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            reason: 'Existing token still valid',
            existingTokenExpires: user.passwordResetExpires,
          },
        },
      });

      return res.status(200).json(successResponse);
    }

    // Generate new reset token
    const { token: resetToken, expires: resetExpires } = generatePasswordResetToken();

    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Log password reset request
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.PASSWORD_RESET,
        userId: user.id,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: {
          action: 'reset_requested',
          tokenExpires: resetExpires,
        },
      },
    });

    // Send password reset email
    try {
      await sendPasswordResetEmail(
        user.email,
        user.name,
        resetToken
      );
      
      console.log('[ForgotPassword] Password reset email sent:', {
        userId: user.id,
        email: user.email,
        ip: clientIp,
      });
    } catch (emailError) {
      console.error('[ForgotPassword] Failed to send reset email:', emailError);
      
      // Remove the token if email fails
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });

      return res.status(500).json({
        error: 'Email service error',
        message: 'Unable to send password reset email. Please try again later.',
      });
    }

    const duration = Date.now() - startTime;
    console.log('[ForgotPassword] Password reset requested:', {
      email: user.email,
      duration: `${duration}ms`,
      ip: clientIp,
    });

    // Return success response
    return res.status(200).json(successResponse);
  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Log error
    console.error('[ForgotPassword] Password reset error:', {
      error: error.message,
      code: error.code,
      duration: `${duration}ms`,
      ip: clientIp,
      email: req.body.email,
    });

    // Generic error response
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
}