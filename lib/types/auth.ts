/**
 * Authentication and authorization type definitions
 */

import { User, UserRole } from './user';

// Authentication types
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  acceptTerms: boolean;
  marketingConsent?: boolean;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthSession {
  user: User;
  token: AuthToken;
  permissions?: string[];
}

// JWT token payload
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  sessionId?: string;
  iat: number;
  exp: number;
}

// OAuth providers
export type OAuthProvider = 'google' | 'facebook' | 'apple';

export interface OAuthCredentials {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  name?: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
}

// Password reset
export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Two-factor authentication
export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface TwoFactorVerification {
  code: string;
  rememberDevice?: boolean;
}

// Security events
export enum AuthEvent {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  REGISTER = 'REGISTER',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  TWO_FACTOR_ENABLED = 'TWO_FACTOR_ENABLED',
  TWO_FACTOR_DISABLED = 'TWO_FACTOR_DISABLED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

export interface AuthAuditLog {
  id: string;
  event: AuthEvent;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// Permission types
export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface RolePermission {
  role: UserRole;
  permissions: Permission[];
}

// API Key for service accounts
export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  key: string;
  permissions: string[];
  expiresAt?: Date | null;
  lastUsedAt?: Date | null;
  createdAt: Date;
  revokedAt?: Date | null;
}
