import {
  PrismaClient,
  ConsentType,
  ConsentStatus,
  DataRequestType,
  DataRequestStatus,
} from '@prisma/client';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

export interface ConsentRequest {
  userId: string;
  consentType: ConsentType;
  purposes: string[];
  dataCategories: string[];
  thirdParties?: string[];
  expiryDays?: number;
  ipAddress: string;
  userAgent?: string;
}

export interface DataRequest {
  userId: string;
  requestType: DataRequestType;
  requestDetails?: any;
  verificationMethod?: string;
}

export class PrivacyComplianceService {
  private static readonly CONSENT_VERSION = '2.0';
  private static readonly DEFAULT_CONSENT_EXPIRY_DAYS = 365;
  private static readonly DATA_REQUEST_DUE_DAYS = 30;
  private static readonly DATA_EXPORT_RETENTION_DAYS = 7;

  /**
   * Record user consent
   */
  static async recordConsent(
    request: ConsentRequest,
  ): Promise<{ success: boolean; consentId?: string }> {
    try {
      // Check for existing active consent
      const existingConsent = await prisma.privacyConsent.findFirst({
        where: {
          userId: request.userId,
          consentType: request.consentType,
          consentVersion: this.CONSENT_VERSION,
          consentStatus: ConsentStatus.GRANTED,
        },
      });

      if (existingConsent) {
        // Update existing consent
        await prisma.privacyConsent.update({
          where: { id: existingConsent.id },
          data: {
            consentStatus: ConsentStatus.WITHDRAWN,
            withdrawnAt: new Date(),
          },
        });
      }

      // Calculate expiry date
      const expiryDays = request.expiryDays || this.DEFAULT_CONSENT_EXPIRY_DAYS;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);

      // Create new consent record
      const consent = await prisma.privacyConsent.create({
        data: {
          userId: request.userId,
          consentType: request.consentType,
          consentVersion: this.CONSENT_VERSION,
          consentStatus: ConsentStatus.GRANTED,
          consentDate: new Date(),
          expiryDate,
          purposes: request.purposes,
          dataCategories: request.dataCategories,
          thirdParties: request.thirdParties || [],
          legalBasis: this.determineLegalBasis(request.consentType),
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
        },
      });

      // Audit log
      await prisma.financialAuditLog.create({
        data: {
          userId: request.userId,
          operationType: 'COMPLIANCE_CONSENT_GRANTED',
          resourceType: 'PRIVACY_CONSENT',
          resourceId: consent.id,
          ipAddress: request.ipAddress,
          currentData: {
            consentType: request.consentType,
            purposes: request.purposes,
            dataCategories: request.dataCategories,
          },
          success: true,
        },
      });

      return { success: true, consentId: consent.id };
    } catch (error) {
      logger.error('Error recording consent:', error);
      return { success: false };
    }
  }

  /**
   * Withdraw consent
   */
  static async withdrawConsent(
    userId: string,
    consentType: ConsentType,
    reason?: string,
  ): Promise<{ success: boolean }> {
    try {
      const consent = await prisma.privacyConsent.findFirst({
        where: {
          userId,
          consentType,
          consentStatus: ConsentStatus.GRANTED,
        },
      });

      if (!consent) {
        return { success: false };
      }

      await prisma.privacyConsent.update({
        where: { id: consent.id },
        data: {
          consentStatus: ConsentStatus.WITHDRAWN,
          withdrawnAt: new Date(),
          withdrawalReason: reason,
        },
      });

      // Audit log
      await prisma.financialAuditLog.create({
        data: {
          userId,
          operationType: 'COMPLIANCE_CONSENT_REVOKED',
          resourceType: 'PRIVACY_CONSENT',
          resourceId: consent.id,
          ipAddress: '127.0.0.1', // Should be actual IP
          currentData: {
            consentType,
            reason,
          },
          success: true,
        },
      });

      return { success: true };
    } catch (error) {
      logger.error('Error withdrawing consent:', error);
      return { success: false };
    }
  }

  /**
   * Check if user has valid consent
   */
  static async hasValidConsent(
    userId: string,
    consentType: ConsentType,
    purposes?: string[],
  ): Promise<boolean> {
    const consent = await prisma.privacyConsent.findFirst({
      where: {
        userId,
        consentType,
        consentStatus: ConsentStatus.GRANTED,
        expiryDate: {
          gt: new Date(),
        },
      },
    });

    if (!consent) {
      return false;
    }

    // Check if all required purposes are covered
    if (purposes && purposes.length > 0) {
      return purposes.every((purpose) => consent.purposes.includes(purpose));
    }

    return true;
  }

  /**
   * Create data access request
   */
  static async createDataRequest(
    request: DataRequest,
  ): Promise<{ success: boolean; requestId?: string }> {
    try {
      // Calculate due date (30 days as per Privacy Act)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + this.DATA_REQUEST_DUE_DAYS);

      const dataRequest = await prisma.dataAccessRequest.create({
        data: {
          userId: request.userId,
          requestType: request.requestType,
          requestStatus: DataRequestStatus.PENDING,
          requestDetails: request.requestDetails,
          verificationMethod: request.verificationMethod,
          dueDate,
        },
      });

      // Audit log
      await prisma.financialAuditLog.create({
        data: {
          userId: request.userId,
          operationType: 'COMPLIANCE_DATA_ACCESS',
          resourceType: 'DATA_REQUEST',
          resourceId: dataRequest.id,
          ipAddress: '127.0.0.1', // Should be actual IP
          currentData: {
            requestType: request.requestType,
            requestDetails: request.requestDetails,
          },
          success: true,
        },
      });

      return { success: true, requestId: dataRequest.id };
    } catch (error) {
      logger.error('Error creating data request:', error);
      return { success: false };
    }
  }

  /**
   * Process data access request
   */
  static async processDataRequest(
    requestId: string,
    processedBy: string,
  ): Promise<{ success: boolean; exportUrl?: string }> {
    try {
      const request = await prisma.dataAccessRequest.findUnique({
        where: { id: requestId },
        include: { user: true },
      });

      if (!request || request.requestStatus !== DataRequestStatus.VERIFIED) {
        return { success: false };
      }

      // Update request status
      await prisma.dataAccessRequest.update({
        where: { id: requestId },
        data: {
          requestStatus: DataRequestStatus.PROCESSING,
          processedBy,
          processedAt: new Date(),
        },
      });

      let exportUrl: string | undefined;

      switch (request.requestType) {
        case DataRequestType.ACCESS_REQUEST:
          exportUrl = await this.generateDataExport(request.userId);
          break;

        case DataRequestType.DELETION_REQUEST:
          await this.processDataDeletion(request.userId);
          break;

        case DataRequestType.PORTABILITY_REQUEST:
          exportUrl = await this.generatePortableDataExport(request.userId);
          break;

        case DataRequestType.CORRECTION_REQUEST:
          // Handle correction requests separately
          break;
      }

      // Mark as completed
      const responseExpiryDate = new Date();
      responseExpiryDate.setDate(responseExpiryDate.getDate() + this.DATA_EXPORT_RETENTION_DAYS);

      await prisma.dataAccessRequest.update({
        where: { id: requestId },
        data: {
          requestStatus: DataRequestStatus.COMPLETED,
          completedAt: new Date(),
          responseUrl: exportUrl,
          responseExpiryDate: exportUrl ? responseExpiryDate : undefined,
        },
      });

      return { success: true, exportUrl };
    } catch (error) {
      logger.error('Error processing data request:', error);
      return { success: false };
    }
  }

  /**
   * Generate data export for user
   */
  private static async generateDataExport(userId: string): Promise<string> {
    // Collect all user data
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: true,
        taxReturns: true,
        subscriptions: true,
        receipts: true,
        budgets: true,
        goals: true,
        financialInsights: true,
        basiq_users: {
          include: {
            bank_connections: true,
            bank_accounts: {
              include: {
                bank_transactions: true,
              },
            },
          },
        },
      },
    });

    // Generate secure export token
    const exportToken = crypto.randomBytes(32).toString('hex');

    // In production, this would:
    // 1. Save data to secure S3 bucket
    // 2. Generate signed URL with expiry
    // 3. Return the URL

    // For now, return a placeholder URL
    return `/api/data-export/${exportToken}`;
  }

  /**
   * Generate portable data export (machine-readable)
   */
  private static async generatePortableDataExport(userId: string): Promise<string> {
    const userData = await this.collectUserData(userId);

    // Format data according to data portability standards
    const portableData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      format: 'JSON',
      data: {
        personal: this.sanitizePersonalData(userData.user),
        financial: {
          transactions: userData.transactions,
          taxReturns: userData.taxReturns,
          receipts: userData.receipts,
        },
        insights: userData.insights,
      },
    };

    // Generate export token and URL
    const exportToken = crypto.randomBytes(32).toString('hex');
    return `/api/data-export/portable/${exportToken}`;
  }

  /**
   * Process data deletion request
   */
  private static async processDataDeletion(userId: string): Promise<void> {
    // Check for data that must be retained for legal reasons
    const retentionRequired = await this.checkRetentionRequirements(userId);

    if (retentionRequired.hasActiveSubscription) {
      throw new Error('Cannot delete data for active subscriptions');
    }

    if (retentionRequired.hasTaxObligations) {
      // Anonymize instead of delete
      await this.anonymizeUserData(userId);
    } else {
      // Full deletion
      await this.deleteUserData(userId);
    }

    // Audit log
    await prisma.financialAuditLog.create({
      data: {
        userId,
        operationType: 'COMPLIANCE_DATA_DELETION',
        resourceType: 'USER_DATA',
        resourceId: userId,
        ipAddress: '127.0.0.1',
        currentData: {
          method: retentionRequired.hasTaxObligations ? 'ANONYMIZED' : 'DELETED',
        },
        success: true,
      },
    });
  }

  /**
   * Check data retention requirements
   */
  private static async checkRetentionRequirements(userId: string): Promise<{
    hasActiveSubscription: boolean;
    hasTaxObligations: boolean;
  }> {
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    // Check for tax returns in last 7 years (ATO requirement)
    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

    const recentTaxReturns = await prisma.taxReturn.count({
      where: {
        userId,
        createdAt: {
          gte: sevenYearsAgo,
        },
      },
    });

    return {
      hasActiveSubscription: !!activeSubscription,
      hasTaxObligations: recentTaxReturns > 0,
    };
  }

  /**
   * Anonymize user data
   */
  private static async anonymizeUserData(userId: string): Promise<void> {
    const anonymizedEmail = `deleted-${crypto.randomBytes(16).toString('hex')}@anonymous.com`;

    await prisma.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        name: 'Deleted User',
        phone: null,
        abn: null,
        tfn: null,
        image: null,
        twoFactorSecret: null,
      },
    });
  }

  /**
   * Delete user data (where legally permissible)
   */
  private static async deleteUserData(userId: string): Promise<void> {
    // Delete in correct order due to foreign key constraints
    await prisma.aIConversation.deleteMany({ where: { userId } });
    await prisma.aIInsight.deleteMany({ where: { userId } });
    await prisma.aIUsageTracking.deleteMany({ where: { userId } });
    await prisma.receipt.deleteMany({ where: { userId } });
    await prisma.budgetTracking.deleteMany({ where: { userId } });
    await prisma.budget.deleteMany({ where: { userId } });
    await prisma.goal.deleteMany({ where: { userId } });
    await prisma.financialInsight.deleteMany({ where: { userId } });

    // Finally delete the user
    await prisma.user.delete({ where: { id: userId } });
  }

  /**
   * Collect user data for export
   */
  private static async collectUserData(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        taxReturns: true,
        receipts: true,
        budgets: true,
        goals: true,
        financialInsights: true,
      },
    });

    const transactions = await prisma.bank_transactions.findMany({
      where: {
        bank_account: {
          basiq_user: {
            user_id: userId,
          },
        },
      },
    });

    return {
      user,
      transactions,
      taxReturns: user?.taxReturns || [],
      receipts: user?.receipts || [],
      insights: user?.financialInsights || [],
    };
  }

  /**
   * Sanitize personal data for export
   */
  private static sanitizePersonalData(user: any): any {
    if (!user) return null;

    const { password, twoFactorSecret, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Determine legal basis for consent
   */
  private static determineLegalBasis(consentType: ConsentType): string {
    switch (consentType) {
      case ConsentType.TERMS_OF_SERVICE:
        return 'CONTRACT';
      case ConsentType.MARKETING_COMMUNICATIONS:
        return 'CONSENT';
      case ConsentType.DATA_SHARING:
        return 'LEGITIMATE_INTEREST';
      default:
        return 'CONSENT';
    }
  }

  /**
   * Get user's consent history
   */
  static async getConsentHistory(userId: string): Promise<any[]> {
    const consents = await prisma.privacyConsent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return consents;
  }

  /**
   * Check and expire old consents
   */
  static async expireOldConsents(): Promise<number> {
    const result = await prisma.privacyConsent.updateMany({
      where: {
        consentStatus: ConsentStatus.GRANTED,
        expiryDate: {
          lt: new Date(),
        },
      },
      data: {
        consentStatus: ConsentStatus.EXPIRED,
      },
    });

    return result.count;
  }
}
