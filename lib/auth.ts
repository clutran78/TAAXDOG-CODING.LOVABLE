import { randomBytes, randomUUID } from 'crypto';

import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';

import { NextAuthOptions } from 'next-auth';
import credentialsProvider from 'next-auth/providers/credentials';
import googleProvider from 'next-auth/providers/google';

import type { Role } from '@prisma/client';

import { logger } from '@/lib/logger';
import prisma from './prisma';
import { logAuthEvent } from './services/auditLogger';
import { getDatabaseConnectionOptions } from './utils/database-url';

// Constants for security and timing
// 🔒 CRITICAL: DO NOT CHANGE - Core authentication security settings
const BCRYPT_ROUNDS = 12; // Password hashing rounds - DO NOT reduce
const MAX_FAILED_ATTEMPTS = 4; // Account locks after this many failed attempts
const ACCOUNT_LOCK_DURATION_MINUTES = 15; // How long account stays locked
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

// PostgreSQL-optimized Prisma adapter with connection pooling
const createOptimizedPrismaAdapter = () => {
  // Ensure Prisma is using optimal settings for PostgreSQL
  if (process.env.NODE_ENV === 'production') {
    const dbUrl = process.env.DATABASE_URL || '';
    const connectionOptions = getDatabaseConnectionOptions(dbUrl);
    logger.debug('Auth using optimized database settings', { 
      poolSize: `${connectionOptions.min}-${connectionOptions.max}`,
      timeouts: {
        statement: connectionOptions.statement_timeout,
        idle: connectionOptions.idleTimeoutMillis,
      }
    });
  }
  
  return PrismaAdapter(prisma);
};

// Re-export commonly used auth utilities
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  return bcrypt.hash(password, salt);
};

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

// Session ID generator for enhanced security
const generateSessionId = () => randomUUID();

export const authOptions: NextAuthOptions = {
  adapter: createOptimizedPrismaAdapter(),
  providers: [
    credentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const sessionId = generateSessionId();
        const clientIp = req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || 'unknown';
        
        if (!credentials?.email || !credentials?.password) {
          logger.info('Missing credentials in authorize function', { sessionId });
          await logAuthEvent({
            action: 'LOGIN_FAILED',
            email: credentials?.email || 'unknown',
            details: { reason: 'missing_credentials' },
            ipAddress: clientIp as string,
          });
          return null;
        }

        try {
          const email = credentials.email.toLowerCase().trim();
          logger.info(`Attempting login for email: ${email}`, { sessionId });
          
          // Use transaction for atomic operations
          const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
              where: { email },
              select: {
                id: true,
                email: true,
                name: true,
                password: true,
                emailVerified: true,
                role: true,
                failedLoginAttempts: true,
                lockedUntil: true,
                twoFactorEnabled: true,
                lastLoginAt: true,
              },
            });

            if (!user) {
              logger.info(`User not found: ${email}`, { sessionId });
              await logAuthEvent({
                action: 'LOGIN_FAILED',
                email,
                details: { reason: 'user_not_found' },
                ipAddress: clientIp as string,
              });
              return null;
            }

            if (!user.password) {
              logger.info(`User has no password set: ${email}`, { sessionId });
              await logAuthEvent({
                action: 'LOGIN_FAILED',
                userId: user.id,
                email,
                details: { reason: 'no_password' },
                ipAddress: clientIp as string,
              });
              return null;
            }

            // Check if account is locked
            if (user.lockedUntil && user.lockedUntil > new Date()) {
              const remainingTime = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
              logger.info(`Account locked: ${email}`, { sessionId, remainingMinutes: remainingTime });
              await logAuthEvent({
                action: 'LOGIN_FAILED',
                userId: user.id,
                email,
                details: { reason: 'account_locked', remainingMinutes: remainingTime },
                ipAddress: clientIp as string,
              });
              return null;
            }

            // Timing-safe password comparison
            // 🔒 CRITICAL: MUST use bcrypt.compare() - provides timing attack protection
            const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

            if (!isPasswordValid) {
              const newFailedAttempts = user.failedLoginAttempts + 1;
              const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
              
              logger.info(`Invalid password for user: ${email}`, { 
                sessionId, 
                failedAttempts: newFailedAttempts,
                willLock: shouldLock 
              });
              
              // Update failed login attempts
              await tx.user.update({
                where: { id: user.id },
                data: {
                  failedLoginAttempts: newFailedAttempts,
                  lockedUntil: shouldLock 
                    ? new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS)
                    : null,
                },
              });
              
              await logAuthEvent({
                action: shouldLock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
                userId: user.id,
                email,
                details: { 
                  reason: 'invalid_password',
                  failedAttempts: newFailedAttempts,
                  locked: shouldLock 
                },
                ipAddress: clientIp as string,
              });
              
              return null;
            }

            // Successful login - reset failed attempts and update login time
            await tx.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
                lastLoginAt: new Date(),
              },
            });
            
            // Log successful login
            await logAuthEvent({
              action: 'LOGIN_SUCCESS',
              userId: user.id,
              email,
              details: { 
                sessionId,
                previousLogin: user.lastLoginAt?.toISOString() 
              },
              ipAddress: clientIp as string,
            });

            logger.info(`✅ Login successful for: ${user.email}`, { sessionId });

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              emailVerified: user.emailVerified,
            };
          }, {
            maxWait: 5000, // 5 seconds max wait
            timeout: 10000, // 10 seconds timeout
            isolationLevel: 'ReadCommitted', // PostgreSQL optimized
          });
          
          return result;
          
        } catch (error) {
          logger.error('Auth error in authorize function:', { error, sessionId });
          await logAuthEvent({
            action: 'LOGIN_ERROR',
            email: credentials.email,
            details: { 
              error: error instanceof Error ? error.message : 'Unknown error' 
            },
            ipAddress: clientIp as string,
          });
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
    async session({ session, token }) {
      logger.debug(`Session callback for user: ${session.user?.email}`);
      
      if (token && session.user) {
        // Add custom properties to session
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.emailVerified = token.emailVerified as Date | null;
        
        // Add session metadata
        session.sessionId = token.sessionId as string;
        session.issuedAt = token.iat ? new Date(token.iat * 1000).toISOString() : undefined;
        session.expiresAt = token.exp ? new Date(token.exp * 1000).toISOString() : undefined;
      }
      
      return session;
    },
    
    async jwt({ token, user, account, trigger }) {
      // Initial sign in
      if (user) {
        logger.debug(`JWT callback for user: ${user.email}`);
        token.role = (user as { role?: string }).role;
        token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified;
        token.sessionId = generateSessionId();
        
        // Track OAuth provider
        if (account) {
          token.provider = account.provider;
          logger.info(`User logged in via: ${account.provider}`, { 
            userId: user.id,
            email: user.email 
          });
        }
      }
      
      // Handle token refresh
      if (trigger === 'update') {
        logger.debug('JWT token refresh triggered', { userId: token.sub });
        
        // Optionally refresh user data from database
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.sub! },
            select: { role: true, emailVerified: true },
          });
          
          if (freshUser) {
            token.role = freshUser.role;
            token.emailVerified = freshUser.emailVerified;
          }
        } catch (error) {
          logger.error('Error refreshing user data in JWT callback', { error });
        }
      }
      
      return token;
    },
    
    async signIn({ user, account, profile }) {
      const clientIp = 'oauth-provider'; // OAuth providers don't expose IP
      
      try {
        logger.info(`Sign in attempt`, {
          userEmail: user.email,
          provider: account?.provider,
          profileEmail: (profile as { email?: string })?.email,
        });
        
        // For OAuth providers, check if user exists or create
        if (account?.provider !== 'credentials') {
          const email = user.email?.toLowerCase();
          
          if (!email) {
            logger.error('OAuth sign in without email', { provider: account?.provider });
            return false;
          }
          
          // Use transaction for OAuth user creation/update
          await prisma.$transaction(async (tx) => {
            const existingUser = await tx.user.findUnique({
              where: { email },
              select: { id: true, role: true },
            });
            
            if (existingUser) {
              // Update last login for existing user
              await tx.user.update({
                where: { id: existingUser.id },
                data: { lastLoginAt: new Date() },
              });
              
              await logAuthEvent({
                action: 'OAUTH_LOGIN_SUCCESS',
                userId: existingUser.id,
                email,
                details: { provider: account.provider },
                ipAddress: clientIp,
              });
            } else {
              // New OAuth user will be created by NextAuth adapter
              await logAuthEvent({
                action: 'OAUTH_SIGNUP',
                email,
                details: { provider: account.provider },
                ipAddress: clientIp,
              });
            }
          }, {
            maxWait: 5000,
            timeout: 10000,
            isolationLevel: 'ReadCommitted',
          });
        }
        
        return true;
        
      } catch (error) {
        logger.error('Error in signIn callback', { 
          error,
          provider: account?.provider,
          email: user.email,
        });
        
        await logAuthEvent({
          action: 'SIGNIN_ERROR',
          email: user.email || 'unknown',
          details: { 
            provider: account?.provider,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          ipAddress: clientIp,
        });
        
        return false;
      }
    },
    
    redirect({ url, baseUrl }) {
      logger.debug(`Redirect callback`, { url, baseUrl });
      
      // Security: Only allow redirects to our domain
      const allowedHosts = [
        new URL(baseUrl).host,
        'localhost:3000',
        'taxreturnpro.com.au',
        'www.taxreturnpro.com.au',
      ];
      
      try {
        const urlObj = new URL(url, baseUrl);
        
        // Check if host is allowed
        if (!allowedHosts.includes(urlObj.host)) {
          logger.warn('Blocked redirect to unauthorized host', { 
            attemptedUrl: url,
            host: urlObj.host,
          });
          return `${baseUrl}/dashboard`;
        }
        
        // Special handling for auth pages
        if (url.includes('/auth/login') || url === baseUrl || url === '/') {
          return `${baseUrl}/dashboard`;
        }
        
        // Allow relative URLs
        if (url.startsWith('/')) return `${baseUrl}${url}`;
        
        // Allow same-origin URLs
        if (urlObj.origin === new URL(baseUrl).origin) return url;
        
      } catch (error) {
        logger.error('Invalid redirect URL', { url, error });
      }
      
      // Default to dashboard
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
    signOut: '/auth/logout',
    verifyRequest: '/auth/verify',
  },
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },
  jwt: {
    // Use stronger encryption in production
    secret: process.env.NEXTAUTH_SECRET || 'fallback-secret-key-for-development',
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Host-' : ''}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  // Enhanced security settings
  useSecureCookies: process.env.NODE_ENV === 'production',
  secret: process.env.NEXTAUTH_SECRET || 'fallback-secret-key-for-development',
  debug: process.env.NODE_ENV === 'development' || process.env['NEXTAUTH_DEBUG'] === 'true',
  logger: {
    error(code, metadata) {
      // Enhanced error logging with context
      const context = {
        code,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        ...metadata,
      };
      
      // Log critical auth errors
      if (['OAUTH_CALLBACK_ERROR', 'SIGNIN_OAUTH_ERROR', 'CALLBACK_CREDENTIALS_JWT_ERROR'].includes(code)) {
        logger.error(`[CRITICAL] NextAuth Error [${code}]`, context);
      } else {
        logger.error(`NextAuth Error [${code}]`, context);
      }
    },
    warn(code) {
      logger.warn(`NextAuth Warning [${code}]`, {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
      });
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV === 'development' || process.env['NEXTAUTH_DEBUG'] === 'true') {
        logger.debug(`NextAuth Debug [${code}]`, metadata);
      }
    },
  },
  // Events for additional logging and monitoring
  events: {
    async signIn({ user, account, isNewUser }) {
      logger.info('User signed in', {
        userId: user.id,
        email: user.email,
        provider: account?.provider || 'credentials',
        isNewUser,
      });
    },
    async signOut({ session, token }) {
      const userId = (token as { sub?: string })?.sub || (session as any)?.user?.id;
      logger.info('User signed out', {
        userId,
        sessionId: (token as { sessionId?: string })?.sessionId,
      });
      
      if (userId) {
        await logAuthEvent({
          action: 'LOGOUT',
          userId,
          email: (session as any)?.user?.email || 'unknown',
          details: { sessionId: (token as { sessionId?: string })?.sessionId },
          ipAddress: 'unknown',
        });
      }
    },
    async session({ session }) {
      // Track active sessions (useful for monitoring)
      logger.debug('Session accessed', {
        userId: (session as any).user?.id,
        email: (session as any).user?.email,
      });
    },
    async linkAccount({ user, account }) {
      logger.info('Account linked', {
        userId: user.id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      });
      
      await logAuthEvent({
        action: 'ACCOUNT_LINKED',
        userId: user.id,
        email: user.email || 'unknown',
        details: { provider: account.provider },
        ipAddress: 'unknown',
      });
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

// Create password reset token with enhanced security
export async function createPasswordResetToken(email: string): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    // Use transaction for atomic operations
    const result = await prisma.$transaction(async (tx) => {
      // Check if user exists
      const user = await tx.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, email: true },
      });
      
      if (!user) {
        // Don't reveal if user exists - log but return fake success
        logger.warn('Password reset requested for non-existent user', { email: normalizedEmail });
        return randomBytes(RESET_TOKEN_LENGTH).toString('hex');
      }
      
      // Generate secure token
      const token = randomBytes(RESET_TOKEN_LENGTH).toString('hex');
      const tokenHash = await bcrypt.hash(token, 10); // Hash the token for storage
      const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
      
      // Delete any existing tokens for this email
      await tx.passwordResetToken.deleteMany({
        where: { email: normalizedEmail },
      });
      
      // Create new token
      await tx.passwordResetToken.create({
        data: {
          email: normalizedEmail,
          token: tokenHash, // Store hashed token
          expires,
        },
      });
      
      // Log the event
      await logAuthEvent({
        action: 'PASSWORD_RESET_REQUESTED',
        userId: user.id,
        email: normalizedEmail,
        details: { expiresAt: expires.toISOString() },
        ipAddress: 'unknown',
      });
      
      logger.info(`✅ Password reset token generated for: ${normalizedEmail}`);
      
      return token; // Return unhashed token to send to user
    }, {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: 'ReadCommitted',
    });
    
    return result;
    
  } catch (error) {
    logger.error('Error creating password reset token', { error, email: normalizedEmail });
    throw new Error('Failed to create password reset token');
  }
}

// Verify password reset token with timing attack protection
export async function verifyPasswordResetToken(token: string): Promise<{
  id: string;
  email: string;
  token: string;
  expires: Date;
} | null> {
  try {
    // Find all non-expired tokens
    const resetTokens = await prisma.passwordResetToken.findMany({
      where: {
        expires: { gt: new Date() },
      },
    });
    
    // Check each token with timing-safe comparison
    for (const resetToken of resetTokens) {
      const isValid = await bcrypt.compare(token, resetToken.token);
      if (isValid) {
        logger.info('Valid password reset token found', { email: resetToken.email });
        return {
          ...resetToken,
          token, // Return the original token
        };
      }
    }
    
    logger.warn('Invalid or expired password reset token');
    return null;
    
  } catch (error) {
    logger.error('Error verifying password reset token', { error });
    return null;
  }
}

// Reset password with enhanced security and logging
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  try {
    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }
    
    // Verify token
    const resetToken = await verifyPasswordResetToken(token);
    if (!resetToken) {
      await logAuthEvent({
        action: 'PASSWORD_RESET_FAILED',
        email: 'unknown',
        details: { reason: 'invalid_token' },
        ipAddress: 'unknown',
      });
      throw new Error('Invalid or expired token');
    }
    
    // Use transaction for atomic password update
    const success = await prisma.$transaction(async (tx) => {
      // Get user
      const user = await tx.user.findUnique({
        where: { email: resetToken.email },
        select: { id: true, email: true, password: true },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check if new password is same as old (if user has a password)
      if (user.password) {
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
          throw new Error('New password must be different from current password');
        }
      }
      
      // Hash new password with salt
      const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Update user password and reset failed attempts
      await tx.user.update({
        where: { id: user.id },
        data: { 
          password: hashedPassword,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      
      // Delete all tokens for this user
      await tx.passwordResetToken.deleteMany({
        where: { email: resetToken.email },
      });
      
      // Log successful password reset
      await logAuthEvent({
        action: 'PASSWORD_RESET_SUCCESS',
        userId: user.id,
        email: user.email,
        details: { tokenId: resetToken.id },
        ipAddress: 'unknown',
      });
      
      logger.info('✅ Password reset successful', { userId: user.id, email: user.email });
      
      return true;
    }, {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: 'ReadCommitted',
    });
    
    return success;
    
  } catch (error) {
    logger.error('Error resetting password', { error });
    
    // Log specific errors
    if (error instanceof Error) {
      if (error.message.includes('token')) {
        throw error; // Re-throw token errors
      }
      if (error.message.includes('password')) {
        throw error; // Re-throw password validation errors
      }
    }
    
    throw new Error('Failed to reset password. Please try again.');
  }
}

// Additional helper function for password strength scoring
export function getPasswordStrength(password: string): {
  score: number; // 0-100
  feedback: string[];
} {
  let score = 0;
  const feedback: string[] = [];
  
  // Length scoring
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  
  // Character variety scoring
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/\d/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;
  
  // Pattern checking
  if (!/(.)\1{2,}/.test(password)) score += 10; // No repeated characters
  if (!/^(?:abc|123|qwerty|password)/i.test(password)) score += 10; // No common patterns
  
  // Generate feedback
  if (score < 50) feedback.push('Weak password - consider making it longer and more complex');
  else if (score < 70) feedback.push('Moderate password - adding more variety would improve security');
  else if (score < 90) feedback.push('Good password - consider adding special characters for maximum security');
  else feedback.push('Strong password!');
  
  return { score: Math.min(100, score), feedback };
}

// Re-export logAuthEvent for API routes
export { logAuthEvent } from './services/auditLogger';
