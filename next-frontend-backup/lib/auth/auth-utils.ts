import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from "@prisma/client";

// Environment variables with defaults for development
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-development-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = 12;

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT token management
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  sessionId?: string;
}

export function generateJWT(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'taaxdog',
    audience: 'taaxdog-users',
  });
}

export function verifyJWT(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'taaxdog',
      audience: 'taaxdog-users',
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

// Generate secure random tokens
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// Generate email verification token
export function generateEmailVerificationToken(): {
  token: string;
  expires: Date;
} {
  const token = generateSecureToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + 24); // 24 hour expiry
  
  return { token, expires };
}

// Generate password reset token
export function generatePasswordResetToken(): {
  token: string;
  expires: Date;
} {
  const token = generateSecureToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + 1); // 1 hour expiry
  
  return { token, expires };
}

// Validate password strength
export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

export function validatePasswordStrength(password: string): PasswordValidation {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Sanitize user object for response
export function sanitizeUser(user: Partial<User>): Partial<User> {
  const {
    password,
    emailVerificationToken,
    emailVerificationExpires,
    passwordResetToken,
    passwordResetExpires,
    twoFactorSecret,
    tfn, // Tax File Number should never be sent to client
    ...sanitized
  } = user;
  
  return sanitized;
}

// Generate CSRF token
export function generateCSRFToken(): string {
  return generateSecureToken(24);
}

// Verify CSRF token
export function verifyCSRFToken(token: string, sessionToken: string): boolean {
  // In a real implementation, you would store and verify against session
  return token === sessionToken;
}

// Account lockout check
export function isAccountLocked(user: Partial<User>): boolean {
  if (!user.lockedUntil) return false;
  return new Date() < new Date(user.lockedUntil);
}

// Calculate lockout duration based on failed attempts
export function calculateLockoutDuration(failedAttempts: number): Date | null {
  if (failedAttempts < 5) return null;
  
  const lockoutMinutes = Math.min(Math.pow(2, failedAttempts - 4) * 5, 1440); // Max 24 hours
  const lockoutUntil = new Date();
  lockoutUntil.setMinutes(lockoutUntil.getMinutes() + lockoutMinutes);
  
  return lockoutUntil;
}

// IP address extraction from request
export function getClientIP(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0] : req.connection?.remoteAddress;
  return ip || 'unknown';
}

// Session token generation
export function generateSessionToken(): string {
  return generateSecureToken(48);
}

// Cookie options for production
export function getAuthCookieOptions(isDevelopment: boolean = false) {
  return {
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}