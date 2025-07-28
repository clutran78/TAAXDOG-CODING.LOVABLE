// BASIQ Security Utilities
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Security configuration
const SECURITY_CONFIG = {
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  ENCRYPTION_KEY_LENGTH: 32,
  IV_LENGTH: 16,
  AUTH_TAG_LENGTH: 16,
  SALT_LENGTH: 32,
  ITERATIONS: 100000,
  KEY_LENGTH: 32,
  DIGEST: 'sha256',
};

// Encryption utilities for sensitive data
export class EncryptionService {
  private encryptionKey: Buffer;

  constructor() {
    // Use environment variable or generate from master key
    const masterKey = process.env.BASIQ_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
    if (!masterKey) {
      throw new Error('Encryption key not configured');
    }

    // Derive encryption key from master key
    this.encryptionKey = crypto.pbkdf2Sync(
      masterKey,
      'basiq-encryption-salt',
      SECURITY_CONFIG.ITERATIONS,
      SECURITY_CONFIG.KEY_LENGTH,
      SECURITY_CONFIG.DIGEST,
    );
  }

  // Encrypt sensitive data
  encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(SECURITY_CONFIG.IV_LENGTH);
    const cipher = crypto.createCipheriv(
      SECURITY_CONFIG.ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      iv,
    );

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  // Decrypt sensitive data
  decrypt(encryptedData: { encrypted: string; iv: string; authTag: string }): string {
    const decipher = crypto.createDecipheriv(
      SECURITY_CONFIG.ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      Buffer.from(encryptedData.iv, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Hash sensitive data for comparison
  hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}

// Security audit logging
export class SecurityAuditLogger {
  async logSecurityEvent(event: {
    type: SecurityEventType;
    userId?: string;
    resource?: string;
    action: string;
    result: 'success' | 'failure';
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: event.userId,
          event: event.type as any,
          ipAddress: event.ipAddress || 'unknown',
          userAgent: event.userAgent,
          metadata: {
            resource: event.resource,
            action: event.action,
            result: event.result,
            ...event.metadata,
          },
          success: event.result === 'success',
        },
      });
    } catch (error) {
      logger.error('Failed to log security event:', error);
      // Don't throw - logging should not break the application
    }
  }

  async logBankingAccess(
    userId: string,
    action: string,
    accountId?: string,
    metadata?: any,
  ): Promise<void> {
    await this.logSecurityEvent({
      type: SecurityEventType.BANKING_ACCESS,
      userId,
      resource: accountId,
      action,
      result: 'success',
      metadata,
    });
  }

  async logDataExport(
    userId: string,
    dataType: string,
    recordCount: number,
    filters?: any,
  ): Promise<void> {
    await this.logSecurityEvent({
      type: SecurityEventType.DATA_EXPORT,
      userId,
      action: `Export ${dataType}`,
      result: 'success',
      metadata: {
        recordCount,
        filters,
      },
    });
  }
}

// Security event types
export enum SecurityEventType {
  BANKING_ACCESS = 'BANKING_ACCESS',
  DATA_EXPORT = 'DATA_EXPORT',
  CONSENT_GRANTED = 'CONSENT_GRANTED',
  CONSENT_REVOKED = 'CONSENT_REVOKED',
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',
  API_KEY_USAGE = 'API_KEY_USAGE',
  WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

// Data sanitization utilities
export const DataSanitizer = {
  // Mask sensitive account numbers
  maskAccountNumber(accountNumber: string): string {
    if (!accountNumber || accountNumber.length < 4) return '****';
    const lastFour = accountNumber.slice(-4);
    const masked = '*'.repeat(accountNumber.length - 4);
    return masked + lastFour;
  },

  // Mask BSB (show bank code only)
  maskBSB(bsb: string): string {
    if (!bsb || bsb.length < 3) return '***-***';
    const cleaned = bsb.replace(/[^0-9]/g, '');
    return `${cleaned.substring(0, 2)}*-***`;
  },

  // Remove sensitive fields from objects
  sanitizeObject(obj: any, sensitiveFields: string[] = []): any {
    const defaultSensitiveFields = [
      'password',
      'tfn',
      'taxFileNumber',
      'credentials',
      'securityCode',
      'pin',
      'cvv',
      'creditCardNumber',
    ];

    const fieldsToRemove = [...defaultSensitiveFields, ...sensitiveFields];

    const sanitized = { ...obj };

    for (const field of fieldsToRemove) {
      if (field in sanitized) {
        delete sanitized[field];
      }
    }

    // Mask account numbers and BSBs
    if (sanitized.accountNumber) {
      sanitized.accountNumber = this.maskAccountNumber(sanitized.accountNumber);
    }
    if (sanitized.bsb) {
      sanitized.bsb = this.maskBSB(sanitized.bsb);
    }

    return sanitized;
  },

  // Sanitize error messages
  sanitizeError(error: Error): string {
    // Remove any potential sensitive data from error messages
    let message = error.message;

    // Common patterns to remove
    message = message.replace(/password[=:]\s*\S+/gi, 'password=***');
    message = message.replace(/key[=:]\s*\S+/gi, 'key=***');
    message = message.replace(/token[=:]\s*\S+/gi, 'token=***');
    message = message.replace(/\b\d{8,}\b/g, '********'); // Long numbers

    return message;
  },
};

// Access control utilities
export class AccessControl {
  // Check if user can access bank account
  async canAccessBankAccount(userId: string, accountId: string): Promise<boolean> {
    const account = await prisma.bank_accounts.findFirst({
      where: {
        basiq_account_id: accountId,
        basiq_user: {
          user_id: userId,
        },
      },
    });

    return !!account;
  }

  // Check if user can access transaction
  async canAccessTransaction(userId: string, transactionId: string): Promise<boolean> {
    const transaction = await prisma.bank_transactions.findFirst({
      where: {
        basiq_transaction_id: transactionId,
        bank_account: {
          basiq_user: {
            user_id: userId,
          },
        },
      },
    });

    return !!transaction;
  }

  // Check if user has valid consent
  async hasValidConsent(userId: string): Promise<boolean> {
    const basiqUser = await prisma.basiq_users.findUnique({
      where: { user_id: userId },
    });

    if (!basiqUser) return false;

    return (
      basiqUser.consent_status === 'active' &&
      basiqUser.consent_expires_at !== null &&
      basiqUser.consent_expires_at > new Date()
    );
  }
}

// Rate limiting for BASIQ operations
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private readonly maxRequests: number = 10,
    private readonly windowMs: number = 60000, // 1 minute
  ) {}

  async checkLimit(userId: string, operation: string): Promise<boolean> {
    const key = `${userId}:${operation}`;
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter((time) => now - time < this.windowMs);

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);

    return true;
  }

  getRemainingRequests(userId: string, operation: string): number {
    const key = `${userId}:${operation}`;
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter((time) => now - time < this.windowMs);

    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

// Export singleton instances
export const encryptionService = new EncryptionService();
export const securityAuditLogger = new SecurityAuditLogger();
export const accessControl = new AccessControl();
export const rateLimiter = new RateLimiter();
