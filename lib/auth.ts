import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// Re-export commonly used auth utilities
export { logAuthEvent } from './auth/auth-utils';
export const hashPassword = async (password: string) => bcrypt.hash(password, 12);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase() },
          });

          if (!user || !user.password) {
            return null;
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          logger.error('Auth error:', error);
          return null;
        }
      },
    }),
    // Google OAuth - only if credentials are provided
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

// Password validation function
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain lowercase letters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letters');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain numbers');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Create password reset token
export async function createPasswordResetToken(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600000); // 1 hour

  // Delete any existing tokens for this email
  await prisma.passwordResetToken.deleteMany({
    where: { email: email.toLowerCase() },
  });

  // Create new token
  await prisma.passwordResetToken.create({
    data: {
      email: email.toLowerCase(),
      token,
      expires,
    },
  });

  logger.info(`✅ Password reset token generated for: ${email}`);
  console.log(
    `🔗 Reset link: ${process.env.NEXTAUTH_URL || 'https://dev.taxreturnpro.com.au'}/auth/reset-password?token=${token}`,
  );

  return token;
}

// Verify password reset token
export async function verifyPasswordResetToken(token: string) {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetToken || resetToken.expires < new Date()) {
    return null;
  }

  return resetToken;
}

// Reset password
export async function resetPassword(token: string, newPassword: string) {
  const resetToken = await verifyPasswordResetToken(token);

  if (!resetToken) {
    throw new Error('Invalid or expired token');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update user password
  await prisma.user.update({
    where: { email: resetToken.email },
    data: { password: hashedPassword },
  });

  // Delete the token
  await prisma.passwordResetToken.delete({
    where: { id: resetToken.id },
  });

  return true;
}
