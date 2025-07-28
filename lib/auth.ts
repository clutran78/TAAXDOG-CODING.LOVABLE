import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';

import prisma from './prisma';
import { logger } from '@/lib/logger';

// Re-export commonly used auth utilities
export { logAuthEvent } from './auth/auth-utils';
export const hashPassword = async (password: string) => bcrypt.hash(password, 12);

// Validate required environment variables
const requiredEnvVars = {
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
};

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
  logger.error(errorMsg);
  
  // In production, log the error but don't throw to prevent app from crashing
  // The error will be handled in the NextAuth API route
  if (process.env.NODE_ENV === 'production') {
    console.error(`[CRITICAL] ${errorMsg}`);
  }
}

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
          logger.info('Missing credentials in authorize function');
          return null;
        }

        try {
          logger.info(`Attempting login for email: ${credentials.email}`);
          
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase() },
            select: {
              id: true,
              email: true,
              name: true,
              password: true,
              emailVerified: true,
              role: true,
              failedLoginAttempts: true,
              lockedUntil: true,
            },
          });

          if (!user) {
            logger.info(`User not found: ${credentials.email}`);
            return null;
          }

          if (!user.password) {
            logger.info(`User has no password set: ${credentials.email}`);
            return null;
          }

          // Check if account is locked
          if (user.lockedUntil && user.lockedUntil > new Date()) {
            logger.info(`Account locked: ${credentials.email}`);
            return null;
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

          if (!isPasswordValid) {
            logger.info(`Invalid password for user: ${credentials.email}`);
            
            // Update failed login attempts
            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: user.failedLoginAttempts + 1,
                lockedUntil: user.failedLoginAttempts >= 4 
                  ? new Date(Date.now() + 15 * 60 * 1000) // Lock for 15 minutes after 5 attempts
                  : null,
              },
            });
            
            return null;
          }

          // Reset failed attempts on successful login
          if (user.failedLoginAttempts > 0) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
                lastLoginAt: new Date(),
              },
            });
          }

          logger.info(`✅ Login successful for: ${user.email}`);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            emailVerified: user.emailVerified,
          };
        } catch (error) {
          logger.error('Auth error in authorize function:', error);
          return null;
        }
      },
    }),
    // Google OAuth - only if credentials are provided
    ...(process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET']
      ? [
          GoogleProvider({
            clientId: process.env['GOOGLE_CLIENT_ID']!,
            clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async session({ session, token }) {
      logger.info(`Session callback for user: ${session.user?.email}`);
      if (token && session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.emailVerified = token.emailVerified as Date | null;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        logger.info(`JWT callback for user: ${user.email}`);
        token.role = (user as any).role;
        token.emailVerified = (user as any).emailVerified;
      }
      
      // Log the provider for OAuth logins
      if (account) {
        logger.info(`User logged in via: ${account.provider}`);
      }
      
      return token;
    },
    async signIn({ user, account, profile, email, credentials }) {
      logger.info(`Sign in attempt:`, {
        userEmail: user.email,
        provider: account?.provider,
        profileEmail: (profile as any)?.email,
      });
      
      // Always allow sign in, let the authorize function handle validation
      return true;
    },
    async redirect({ url, baseUrl }) {
      logger.info(`Redirect callback:`, { url, baseUrl });
      
      // If the URL is the login page and we're already authenticated, redirect to dashboard
      if (url.includes('/auth/login') || url === baseUrl) {
        return `${baseUrl}/dashboard`;
      }
      
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      
      // Default to dashboard
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || 'fallback-secret-key-for-development',
  debug: process.env.NODE_ENV === 'development' || process.env['NEXTAUTH_DEBUG'] === 'true',
  logger: {
    error(code, metadata) {
      logger.error(`NextAuth Error [${code}]:`, metadata);
    },
    warn(code) {
      logger.warn(`NextAuth Warning [${code}]`);
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV === 'development') {
        logger.info(`NextAuth Debug [${code}]:`, metadata);
      }
    },
  },
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
    `🔗 Reset link: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`,
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
