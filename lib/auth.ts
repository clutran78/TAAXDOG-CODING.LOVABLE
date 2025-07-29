import { randomBytes } from 'crypto';

import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';

import { NextAuthOptions } from 'next-auth';
import credentialsProvider from 'next-auth/providers/credentials';
import googleProvider from 'next-auth/providers/google';

import type { Role } from '@prisma/client';

import { logger } from '@/lib/logger';
import prisma from './prisma';

// Constants for security and timing
const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 4;
const ACCOUNT_LOCK_DURATION_MINUTES = 15;
const MINUTES_TO_MS = 60 * 1000;
const ACCOUNT_LOCK_DURATION_MS = ACCOUNT_LOCK_DURATION_MINUTES * MINUTES_TO_MS;
const SESSION_MAX_AGE_DAYS = 30;
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;
const SECONDS_IN_MINUTE = 60;
const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_DAYS * HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE;
const PASSWORD_MIN_LENGTH = 8;
const RESET_TOKEN_LENGTH = 32;
const RESET_TOKEN_EXPIRY_HOURS = 1;
const RESET_TOKEN_EXPIRY_MS = RESET_TOKEN_EXPIRY_HOURS * MINUTES_IN_HOUR * MINUTES_TO_MS;

// Re-export commonly used auth utilities
export { logAuthEvent } from './auth/auth-utils';
export const hashPassword = async (password: string): Promise<string> => bcrypt.hash(password, BCRYPT_ROUNDS);

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
    credentialsProvider({
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
                lockedUntil: user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS 
                  ? new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS)
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
          googleProvider({
            clientId: process.env['GOOGLE_CLIENT_ID']!,
            clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
          }),
        ]
      : []),
  ],
  callbacks: {
    session({ session, token }) {
      logger.info(`Session callback for user: ${session.user?.email}`);
      if (token && session.user) {
        // eslint-disable-next-line no-param-reassign
        session.user.id = token.sub!;
        // eslint-disable-next-line no-param-reassign
        session.user.role = token.role as string;
        // eslint-disable-next-line no-param-reassign
        session.user.emailVerified = token.emailVerified as Date | null;
      }
      return session;
    },
    jwt({ token, user, account }) {
      if (user) {
        logger.info(`JWT callback for user: ${user.email}`);
        // eslint-disable-next-line no-param-reassign
        token.role = (user as { role?: string }).role;
        // eslint-disable-next-line no-param-reassign
        token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified;
      }
      
      // Log the provider for OAuth logins
      if (account) {
        logger.info(`User logged in via: ${account.provider}`);
      }
      
      return token;
    },
    signIn({ user, account, profile }) {
      logger.info(`Sign in attempt:`, {
        userEmail: user.email,
        provider: account?.provider,
        profileEmail: (profile as { email?: string })?.email,
      });
      
      // Always allow sign in, let the authorize function handle validation
      return true;
    },
    redirect({ url, baseUrl }) {
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
    maxAge: SESSION_MAX_AGE_SECONDS,
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

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
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
  const token = randomBytes(RESET_TOKEN_LENGTH).toString('hex');
  const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

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

  return token;
}

// Verify password reset token
export async function verifyPasswordResetToken(token: string): Promise<{
  id: string;
  email: string;
  token: string;
  expires: Date;
} | null> {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetToken || resetToken.expires < new Date()) {
    return null;
  }

  return resetToken;
}

// Reset password
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const resetToken = await verifyPasswordResetToken(token);

  if (!resetToken) {
    throw new Error('Invalid or expired token');
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

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
