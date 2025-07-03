import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Security configuration constants
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secure-secret-key-change-this-in-production';
const SALT_ROUNDS = 12; // High salt rounds for better security
const TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Interface for JWT payload structure
 * Ensures type safety for token data
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role?: string;
  iat: number;
  exp: number;
}

/**
 * Interface for authentication result
 * Standardizes auth response structure
 */
export interface AuthResult {
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  error?: string;
}

/**
 * Securely hashes passwords using bcrypt with high salt rounds
 * Critical for protecting user credentials
 */
export const hashPassword = async (password: string): Promise<string> => {
  if (!password || typeof password !== 'string') {
    throw new Error('Invalid password provided for hashing');
  }

  // Additional password validation before hashing
  if (password.length < 8 || password.length > 128) {
    throw new Error('Password must be between 8 and 128 characters');
  }

  try {
    return await bcrypt.hash(password, SALT_ROUNDS);
  } catch (error) {
    throw new Error('Password hashing failed');
  }
};

/**
 * Verifies password against stored hash
 * Uses timing-safe comparison to prevent timing attacks
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  if (!password || !hash || typeof password !== 'string' || typeof hash !== 'string') {
    return false;
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    // Log security event but don't expose details
    console.error('Password verification error:', error);
    return false;
  }
};

/**
 * Generates secure JWT access token
 * Includes user information and expiration
 */
export const generateToken = (userId: string, email: string, role: string = 'user'): string => {
  if (!userId || !email) {
    throw new Error('User ID and email are required for token generation');
  }

  const payload = {
    userId,
    email,
    role,
    iat: Math.floor(Date.now() / 1000)
  };

  try {
    return jwt.sign(payload, JWT_SECRET, { 
      expiresIn: TOKEN_EXPIRY,
      issuer: 'taaxdog-finance',
      audience: 'taaxdog-users'
    });
  } catch (error) {
    throw new Error('Token generation failed');
  }
};

/**
 * Generates refresh token for extended authentication
 * Longer expiry but more restricted usage
 */
export const generateRefreshToken = (userId: string): string => {
  if (!userId) {
    throw new Error('User ID is required for refresh token generation');
  }

  const payload = {
    userId,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000)
  };

  try {
    return jwt.sign(payload, JWT_SECRET, { 
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: 'taaxdog-finance',
      audience: 'taaxdog-refresh'
    });
  } catch (error) {
    throw new Error('Refresh token generation failed');
  }
};

/**
 * Verifies and decodes JWT token
 * Returns null for invalid tokens to prevent errors
 */
export const verifyToken = (token: string): JWTPayload | null => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'taaxdog-finance',
      audience: 'taaxdog-users'
    }) as JWTPayload;

    // Additional validation
    if (!decoded.userId || !decoded.email) {
      return null;
    }

    return decoded;
  } catch (error) {
    // Token is invalid, expired, or malformed
    return null;
  }
};

/**
 * Verifies refresh token specifically
 * Separate verification for refresh token flow
 */
export const verifyRefreshToken = (token: string): { userId: string } | null => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'taaxdog-finance',
      audience: 'taaxdog-refresh'
    }) as any;

    if (!decoded.userId || decoded.type !== 'refresh') {
      return null;
    }

    return { userId: decoded.userId };
  } catch (error) {
    return null;
  }
};

/**
 * Extracts token from Authorization header
 * Handles Bearer token format securely
 */
export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Generates secure session ID
 * Used for additional session tracking
 */
export const generateSecureSessionId = (): string => {
  const timestamp = Date.now().toString();
  const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `${timestamp}_${randomBytes}`;
};

/**
 * Creates secure cookie options
 * Ensures proper cookie security settings
 */
export const getSecureCookieOptions = (isProduction: boolean = false) => {
  return {
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: 'strict' as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/'
  };
};

/**
 * Validates token expiration
 * Checks if token is still valid
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
};

/**
 * Blacklists a token (for logout functionality)
 * In a real application, this would store in Redis or database
 */
const tokenBlacklist = new Set<string>();

export const blacklistToken = (token: string): void => {
  if (token && typeof token === 'string') {
    tokenBlacklist.add(token);
  }
};

export const isTokenBlacklisted = (token: string): boolean => {
  return tokenBlacklist.has(token);
};

/**
 * Validates authentication state
 * Comprehensive auth check for protected routes
 */
export const validateAuthState = (token: string): AuthResult => {
  if (!token) {
    return {
      success: false,
      error: 'No authentication token provided'
    };
  }

  if (isTokenBlacklisted(token)) {
    return {
      success: false,
      error: 'Token has been revoked'
    };
  }

  if (isTokenExpired(token)) {
    return {
      success: false,
      error: 'Authentication token has expired'
    };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return {
      success: false,
      error: 'Invalid authentication token'
    };
  }

  return {
    success: true,
    user: {
      id: payload.userId,
      email: payload.email,
      role: payload.role || 'user'
    }
  };
};

/**
 * Rate limiting helper for authentication attempts
 * Prevents brute force attacks
 */
const authAttempts = new Map<string, { count: number; lastAttempt: number }>();

export const checkAuthRateLimit = (identifier: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean => {
  const now = Date.now();
  const attempts = authAttempts.get(identifier);

  if (!attempts) {
    authAttempts.set(identifier, { count: 1, lastAttempt: now });
    return true;
  }

  // Reset count if outside time window
  if (now - attempts.lastAttempt > windowMs) {
    authAttempts.set(identifier, { count: 1, lastAttempt: now });
    return true;
  }

  // Check if under rate limit
  if (attempts.count < maxAttempts) {
    attempts.count++;
    attempts.lastAttempt = now;
    return true;
  }

  return false;
};

/**
 * Clears authentication rate limit for an identifier
 * Used after successful authentication
 */
export const clearAuthRateLimit = (identifier: string): void => {
  authAttempts.delete(identifier);
}; 