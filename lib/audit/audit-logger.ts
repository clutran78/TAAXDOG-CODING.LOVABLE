import { AuthEvent, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { getClientIP } from '@/lib/auth/auth-utils';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCacheManager } from '@/lib/services/cache/cacheManager';
import encryption from '@/lib/encryption';

// Audit event categories for compliance tracking
export enum AuditCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  SECURITY = 'SECURITY',
  COMPLIANCE = 'COMPLIANCE',
  FINANCIAL = 'FINANCIAL',
  SYSTEM = 'SYSTEM',
  USER_ACTION = 'USER_ACTION',
  API_ACCESS = 'API_ACCESS',
}

// Severity levels for audit events
export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

// Compliance standards tracking
export enum ComplianceStandard {
  AUSTRALIAN_PRIVACY_ACT = 'AUSTRALIAN_PRIVACY_ACT',
  ATO_RECORD_KEEPING = 'ATO_RECORD_KEEPING',
  PCI_DSS = 'PCI_DSS',
  ISO_27001 = 'ISO_27001',
  GDPR = 'GDPR', // For EU users if applicable
}

// Audit log entry interface
export interface AuditLogEntry {
  id?: string;
  event: AuthEvent;
  category: AuditCategory;
  severity: AuditSeverity;
  userId?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  requestId?: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  complianceFlags?: ComplianceStandard[];
  retentionPeriod?: number; // Days to retain
  encryptedData?: string; // For sensitive data
  checksum?: string; // For integrity verification
  parentEventId?: string; // For linked events
  timestamp?: Date;
}

// Audit logger configuration
export interface AuditLoggerConfig {
  enableEncryption?: boolean;
  enableChecksum?: boolean;
  enableAsyncLogging?: boolean;
  retentionDays?: number;
  sensitiveFields?: string[];
  complianceMode?: boolean;
}

// Default configuration
const DEFAULT_CONFIG: AuditLoggerConfig = {
  enableEncryption: true,
  enableChecksum: true,
  enableAsyncLogging: true,
  retentionDays: 2555, // 7 years for Australian tax compliance
  sensitiveFields: ['password', 'token', 'apiKey', 'creditCard', 'bankAccount'],
  complianceMode: true,
};

/**
 * Comprehensive audit logger for security, compliance, and user actions
 */
export class AuditLogger {
  private static instance: AuditLogger;
  private config: AuditLoggerConfig;
  private logQueue: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor(config: AuditLoggerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start async flush interval if enabled
    if (this.config.enableAsyncLogging) {
      this.startFlushInterval();
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: AuditLoggerConfig): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger(config);
    }
    return AuditLogger.instance;
  }

  /**
   * Log authentication event
   */
  public async logAuth(
    event: AuthEvent,
    req: NextApiRequest,
    userId?: string,
    success: boolean = true,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      event,
      category: AuditCategory.AUTHENTICATION,
      severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      userId,
      ipAddress: getClientIP(req) || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: (req as any).session?.id,
      requestId: (req as any).requestId,
      success,
      metadata: this.sanitizeMetadata(metadata),
      complianceFlags: [ComplianceStandard.AUSTRALIAN_PRIVACY_ACT],
      retentionPeriod: this.config.retentionDays,
    };

    await this.log(entry);
  }

  /**
   * Log data access event
   */
  public async logDataAccess(
    resource: string,
    action: string,
    req: NextApiRequest,
    userId: string,
    resourceId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      event: AuthEvent.LOGIN_SUCCESS, // Using as placeholder for data access
      category: AuditCategory.DATA_ACCESS,
      severity: AuditSeverity.INFO,
      userId,
      ipAddress: getClientIP(req) || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: (req as any).session?.id,
      requestId: (req as any).requestId,
      success: true,
      metadata: {
        resource,
        action,
        resourceId,
        ...this.sanitizeMetadata(metadata),
      },
      complianceFlags: [ComplianceStandard.AUSTRALIAN_PRIVACY_ACT, ComplianceStandard.ISO_27001],
    };

    await this.log(entry);
  }

  /**
   * Log data modification event
   */
  public async logDataModification(
    resource: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    req: NextApiRequest,
    userId: string,
    resourceId: string,
    changes?: Record<string, any>,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      event: AuthEvent.LOGIN_SUCCESS, // Placeholder for data modification events
      category: AuditCategory.DATA_MODIFICATION,
      severity: AuditSeverity.INFO,
      userId,
      ipAddress: getClientIP(req) || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: (req as any).session?.id,
      requestId: (req as any).requestId,
      success: true,
      metadata: {
        resource,
        action,
        resourceId,
        changes: this.sanitizeMetadata(changes),
        ...this.sanitizeMetadata(metadata),
      },
      complianceFlags: [
        ComplianceStandard.AUSTRALIAN_PRIVACY_ACT,
        ComplianceStandard.ATO_RECORD_KEEPING,
      ],
      retentionPeriod: 2555, // 7 years for tax records
    };

    await this.log(entry);
  }

  /**
   * Log security event
   */
  public async logSecurity(
    event: AuthEvent,
    severity: AuditSeverity,
    req: NextApiRequest,
    userId?: string,
    description?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      event,
      category: AuditCategory.SECURITY,
      severity,
      userId,
      ipAddress: getClientIP(req) || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: (req as any).session?.id,
      requestId: (req as any).requestId,
      success: false,
      errorMessage: description,
      metadata: this.sanitizeMetadata(metadata),
      complianceFlags: [ComplianceStandard.AUSTRALIAN_PRIVACY_ACT, ComplianceStandard.ISO_27001],
    };

    await this.log(entry);
  }

  /**
   * Log financial transaction
   */
  public async logFinancial(
    action: string,
    req: NextApiRequest,
    userId: string,
    amount?: number,
    currency?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      event: AuthEvent.LOGIN_SUCCESS, // Placeholder for financial transaction
      category: AuditCategory.FINANCIAL,
      severity: AuditSeverity.INFO,
      userId,
      ipAddress: getClientIP(req) || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: (req as any).session?.id,
      requestId: (req as any).requestId,
      success: true,
      metadata: {
        action,
        amount,
        currency: currency || 'AUD',
        ...this.sanitizeMetadata(metadata),
      },
      complianceFlags: [ComplianceStandard.ATO_RECORD_KEEPING, ComplianceStandard.PCI_DSS],
      retentionPeriod: 2555, // 7 years for financial records
    };

    await this.log(entry);
  }

  /**
   * Log API access
   */
  public async logApiAccess(
    endpoint: string,
    method: string,
    req: NextApiRequest,
    userId?: string,
    statusCode?: number,
    responseTime?: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      event: AuthEvent.LOGIN_SUCCESS, // Placeholder for API access
      category: AuditCategory.API_ACCESS,
      severity: statusCode && statusCode >= 400 ? AuditSeverity.WARNING : AuditSeverity.INFO,
      userId,
      ipAddress: getClientIP(req) || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: (req as any).session?.id,
      requestId: (req as any).requestId,
      success: statusCode ? statusCode < 400 : true,
      metadata: {
        endpoint,
        method,
        statusCode,
        responseTime,
        ...this.sanitizeMetadata(metadata),
      },
    };

    await this.log(entry);
  }

  /**
   * Log compliance event
   */
  public async logCompliance(
    action: string,
    standard: ComplianceStandard,
    req: NextApiRequest,
    userId?: string,
    details?: Record<string, any>,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      event: AuthEvent.LOGIN_SUCCESS, // Placeholder for compliance event
      category: AuditCategory.COMPLIANCE,
      severity: AuditSeverity.INFO,
      userId,
      ipAddress: getClientIP(req) || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: (req as any).session?.id,
      requestId: (req as any).requestId,
      success: true,
      metadata: {
        action,
        standard,
        ...this.sanitizeMetadata(details),
      },
      complianceFlags: [standard],
      retentionPeriod: 2555, // 7 years for compliance
    };

    await this.log(entry);
  }

  /**
   * Core logging function
   */
  private async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Add timestamp
      entry.timestamp = entry.timestamp || new Date();
      entry.id = entry.id || crypto.randomUUID();

      // Encrypt sensitive data if enabled
      if (this.config.enableEncryption && entry.metadata) {
        const sensitiveData = this.extractSensitiveData(entry.metadata);
        if (Object.keys(sensitiveData).length > 0) {
          entry.encryptedData = encryption.encrypt(JSON.stringify(sensitiveData));
          // Remove sensitive data from metadata
          this.removeSensitiveData(entry.metadata);
        }
      }

      // Generate checksum if enabled
      if (this.config.enableChecksum) {
        entry.checksum = this.generateChecksum(entry);
      }

      // Add to queue or write directly
      if (this.config.enableAsyncLogging) {
        this.logQueue.push(entry);

        // Flush if queue is getting large
        if (this.logQueue.length >= 100) {
          await this.flush();
        }
      } else {
        await this.writeLog(entry);
      }
    } catch (error) {
      logger.error('Audit logging error', { error, entry });
      // Don't throw - audit logging should not break the application
    }
  }

  /**
   * Write log entry to database
   */
  private async writeLog(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          id: entry.id,
          event: entry.event,
          userId: entry.userId,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          success: entry.success,
          metadata: entry.metadata as any,
          createdAt: entry.timestamp,
          // Additional fields stored in metadata
          category: entry.category,
          severity: entry.severity,
          sessionId: entry.sessionId,
          requestId: entry.requestId,
          errorCode: entry.errorCode,
          errorMessage: entry.errorMessage,
          complianceFlags: entry.complianceFlags,
          retentionPeriod: entry.retentionPeriod,
          encryptedData: entry.encryptedData,
          checksum: entry.checksum,
          parentEventId: entry.parentEventId,
        } as any,
      });
    } catch (error) {
      logger.error('Failed to write audit log', { error, entry });
    }
  }

  /**
   * Flush queued logs
   */
  private async flush(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const logsToWrite = [...this.logQueue];
    this.logQueue = [];

    try {
      // Batch insert for better performance
      await prisma.auditLog.createMany({
        data: logsToWrite.map((entry) => ({
          id: entry.id,
          event: entry.event,
          userId: entry.userId,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          success: entry.success,
          metadata: {
            ...entry.metadata,
            category: entry.category,
            severity: entry.severity,
            sessionId: entry.sessionId,
            requestId: entry.requestId,
            errorCode: entry.errorCode,
            errorMessage: entry.errorMessage,
            complianceFlags: entry.complianceFlags,
            retentionPeriod: entry.retentionPeriod,
            encryptedData: entry.encryptedData,
            checksum: entry.checksum,
            parentEventId: entry.parentEventId,
          } as any,
          createdAt: entry.timestamp,
        })),
      });
    } catch (error) {
      logger.error('Failed to flush audit logs', { error, count: logsToWrite.length });
      // Re-add to queue on failure
      this.logQueue.unshift(...logsToWrite);
    }
  }

  /**
   * Start flush interval
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch((error) => {
        logger.error('Flush interval error', { error });
      });
    }, 5000); // Flush every 5 seconds
  }

  /**
   * Stop flush interval
   */
  public stopFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Sanitize metadata to remove sensitive information
   */
  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined;

    const sanitized = { ...metadata };

    // Remove sensitive fields
    for (const field of this.config.sensitiveFields || []) {
      delete sanitized[field];
    }

    return sanitized;
  }

  /**
   * Extract sensitive data for encryption
   */
  private extractSensitiveData(metadata: Record<string, any>): Record<string, any> {
    const sensitive: Record<string, any> = {};

    for (const field of this.config.sensitiveFields || []) {
      if (metadata[field] !== undefined) {
        sensitive[field] = metadata[field];
      }
    }

    return sensitive;
  }

  /**
   * Remove sensitive data from metadata
   */
  private removeSensitiveData(metadata: Record<string, any>): void {
    for (const field of this.config.sensitiveFields || []) {
      delete metadata[field];
    }
  }

  /**
   * Generate checksum for integrity verification
   */
  private generateChecksum(entry: AuditLogEntry): string {
    const data = JSON.stringify({
      event: entry.event,
      userId: entry.userId,
      ipAddress: entry.ipAddress,
      timestamp: entry.timestamp?.toISOString(),
      metadata: entry.metadata,
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify checksum integrity
   */
  public verifyChecksum(entry: AuditLogEntry): boolean {
    if (!entry.checksum) return true;

    const calculatedChecksum = this.generateChecksum(entry);
    return calculatedChecksum === entry.checksum;
  }

  /**
   * Query audit logs with filters
   */
  public async query(filters: {
    userId?: string;
    event?: AuthEvent;
    category?: AuditCategory;
    severity?: AuditSeverity;
    startDate?: Date;
    endDate?: Date;
    ipAddress?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.event) where.event = filters.event;
    if (filters.ipAddress) where.ipAddress = filters.ipAddress;
    if (filters.success !== undefined) where.success = filters.success;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    // Category and severity are stored in metadata
    if (filters.category || filters.severity) {
      where.metadata = {};
      if (filters.category) {
        where.metadata.path = ['category'];
        where.metadata.equals = filters.category;
      }
      if (filters.severity) {
        where.metadata.path = ['severity'];
        where.metadata.equals = filters.severity;
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    });

    // Decrypt sensitive data if needed
    return Promise.all(
      logs.map(async (log) => {
        const metadata = log.metadata as any;

        if (metadata?.encryptedData && this.config.enableEncryption) {
          try {
            const decrypted = encryption.decrypt(metadata.encryptedData);
            const sensitiveData = JSON.parse(decrypted);
            return {
              ...log,
              metadata: {
                ...metadata,
                ...sensitiveData,
              },
            };
          } catch (error) {
            logger.error('Failed to decrypt audit log', { error, logId: log.id });
          }
        }

        return log;
      }),
    );
  }

  /**
   * Generate compliance report
   */
  public async generateComplianceReport(
    standard: ComplianceStandard,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        metadata: {
          path: ['complianceFlags'],
          array_contains: [standard],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by category and event type
    const summary: Record<string, any> = {};

    for (const log of logs) {
      const metadata = log.metadata as any;
      const category = metadata?.category || 'UNKNOWN';
      const event = log.event;

      if (!summary[category]) {
        summary[category] = {
          total: 0,
          successful: 0,
          failed: 0,
          events: {},
        };
      }

      summary[category].total++;
      if (log.success) {
        summary[category].successful++;
      } else {
        summary[category].failed++;
      }

      if (!summary[category].events[event]) {
        summary[category].events[event] = 0;
      }
      summary[category].events[event]++;
    }

    return {
      standard,
      period: {
        start: startDate,
        end: endDate,
      },
      totalEvents: logs.length,
      summary,
      logs: logs.slice(0, 1000), // Limit to 1000 for performance
    };
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  public async cleanupOldLogs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (this.config.retentionDays || 2555));

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        // Don't delete logs with extended retention
        NOT: {
          metadata: {
            path: ['retentionPeriod'],
            gt: this.config.retentionDays,
          },
        },
      },
    });

    logger.info('Cleaned up old audit logs', {
      deleted: result.count,
      cutoffDate,
    });

    return result.count;
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance();

// Middleware helper for automatic API logging
export function withAuditLogging(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const startTime = Date.now();
    const originalEnd = res.end;
    const originalJson = res.json;
    let statusCode = 200;

    // Intercept response
    res.json = function (body: any) {
      statusCode = res.statusCode;
      return originalJson.call(this, body);
    };

    res.end = function (...args: any[]) {
      const responseTime = Date.now() - startTime;

      // Log API access
      auditLogger
        .logApiAccess(
          req.url || 'unknown',
          req.method || 'unknown',
          req,
          (req as any).userId,
          statusCode,
          responseTime,
        )
        .catch((error) => {
          logger.error('Failed to log API access', { error });
        });

      return originalEnd.apply(this, args as any);
    };

    await handler(req, res);
  };
}
