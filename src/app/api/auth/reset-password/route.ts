import { NextRequest, NextResponse } from 'next/server';
import { unifiedMonitoredPrisma as prisma } from '@/lib/db/unifiedMonitoredPrisma';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { validatePassword } from '@/lib/auth';

// Validation schema
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /api/auth/reset-password - Reset password with token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = resetPasswordSchema.parse(body);

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: `Password validation failed: ${passwordValidation.errors.join(', ')}` },
        { status: 400 },
      );
    }

    // Hash the provided token to match what's stored in database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: {
          gt: new Date(), // Token hasn't expired
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token. Please request a new password reset.' },
        { status: 400 },
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        // Reset failed login attempts on successful password reset
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Log the successful password reset
    await prisma.auditLog.create({
      data: {
        action: 'PASSWORD_RESET',
        userId: user.id,
        details: JSON.stringify({
          email: user.email,
          timestamp: new Date().toISOString(),
        }),
        ipAddress:
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json(
      { message: 'Password reset successfully! You can now login with your new password.' },
      { status: 200 },
    );
  } catch (error: any) {
    console.error('Password reset error:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data provided.' }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to reset password. Please try again.' },
      { status: 500 },
    );
  }
}
