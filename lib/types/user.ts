/**
 * User-related type definitions
 */

import { Address, AuditInfo } from './common';

// User roles
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  ACCOUNTANT = 'ACCOUNTANT',
  SUPPORT = 'SUPPORT',
}

// User status
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

// Tax residency types
export type TaxResidency = 'resident' | 'foreign' | 'temporary';

// User profile interface
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  emailVerifiedAt?: Date | null;
  phone?: string | null;
  abn?: string | null;
  taxFileNumber?: string | null;
  dateOfBirth?: Date | null;
  address?: Address | null;
  taxResidency?: TaxResidency | null;
  hasHELP?: boolean;
  hasTSL?: boolean;
  hasSFSS?: boolean;
  profileImage?: string | null;
  lastLoginAt?: Date | null;
  lastLoginIp?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

// User preferences
export interface UserPreferences {
  id: string;
  userId: string;
  currency: 'AUD';
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  language: string;
  emailNotifications: EmailNotificationSettings;
  pushNotifications: boolean;
  twoFactorEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
}

// Email notification settings
export interface EmailNotificationSettings {
  transactionAlerts: boolean;
  weeklyReports: boolean;
  monthlyStatements: boolean;
  taxReminders: boolean;
  goalProgress: boolean;
  securityAlerts: boolean;
  productUpdates: boolean;
  marketingEmails: boolean;
}

// User creation/update DTOs
export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  abn?: string;
  taxFileNumber?: string;
  dateOfBirth?: Date;
  address?: Address;
  taxResidency?: TaxResidency;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  abn?: string;
  taxFileNumber?: string;
  dateOfBirth?: Date;
  address?: Address;
  taxResidency?: TaxResidency;
  hasHELP?: boolean;
  hasTSL?: boolean;
  hasSFSS?: boolean;
}

// User session interface
export interface UserSession {
  id: string;
  userId: string;
  token: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: Date;
  createdAt: Date;
}

// User activity tracking
export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  resource?: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

// Password reset
export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
}
