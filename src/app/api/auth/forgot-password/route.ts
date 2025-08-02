import { NextRequest, NextResponse } from 'next/server';
import { unifiedMonitoredPrisma as prisma } from '@/lib/db/unifiedMonitoredPrisma';
import { z } from 'zod';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/services/email/email';

// Validation schema
const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

// POST /api/auth/forgot-password - Send password reset email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json(
        { message: 'If the email exists, a reset link has been sent.' },
        { status: 200 },
      );
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save token to database with 1-hour expiry
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour
      },
    });

    // Create reset URL
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;

    // Send email
    try {
      await sendPasswordResetEmail(
        user.email,
        user.name,
        resetToken, // Pass the unhashed token
      );
    } catch (emailError) {
      console.error('Error sending reset email:', emailError);
      // Don't expose email sending errors to the user
    }

    // Log the password reset request
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        event: 'PASSWORD_RESET_REQUEST',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: {
          email: user.email,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json(
      { message: 'If the email exists, a reset link has been sent.' },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
