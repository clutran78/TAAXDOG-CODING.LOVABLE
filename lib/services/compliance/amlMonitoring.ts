import { PrismaClient, AMLMonitoringType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

export interface TransactionData {
  userId: string;
  amount: number;
  currency?: string;
  transactionId?: string;
  transactionDate: Date;
  merchantName?: string;
  category?: string;
  description?: string;
}

export interface AMLRiskAssessment {
  riskScore: number;
  riskFactors: string[];
  monitoringType: AMLMonitoringType;
  requiresReview: boolean;
  patternType?: string;
  patternDetails?: any;
}

export class AMLMonitoringService {
  // AUSTRAC reporting thresholds
  private static readonly CASH_THRESHOLD = 10000; // AUD
  private static readonly INTERNATIONAL_THRESHOLD = 1000; // AUD
  private static readonly HIGH_RISK_SCORE = 0.75;
  private static readonly MEDIUM_RISK_SCORE = 0.50;

  /**
   * Monitor a transaction for AML/CTF compliance
   */
  static async monitorTransaction(transaction: TransactionData): Promise<AMLRiskAssessment> {
    const riskFactors: string[] = [];
    let riskScore = 0;
    let monitoringType: AMLMonitoringType = AMLMonitoringType.THRESHOLD_EXCEEDED;
    let requiresReview = false;

    // Check for cash threshold reporting (TTR)
    if (transaction.amount >= this.CASH_THRESHOLD) {
      riskFactors.push(`Transaction exceeds $${this.CASH_THRESHOLD} AUD threshold`);
      riskScore += 0.3;
      requiresReview = true;
    }

    // Check velocity patterns
    const velocityCheck = await this.checkVelocityPatterns(transaction.userId, transaction.transactionDate);
    if (velocityCheck.isHighVelocity) {
      riskFactors.push(velocityCheck.reason);
      riskScore += velocityCheck.riskContribution;
      monitoringType = AMLMonitoringType.VELOCITY_CHECK;
    }

    // Check for structuring patterns
    const structuringCheck = await this.checkStructuringPatterns(transaction.userId, transaction.amount);
    if (structuringCheck.detected) {
      riskFactors.push('Potential structuring pattern detected');
      riskScore += 0.4;
      monitoringType = AMLMonitoringType.PATTERN_DETECTION;
      requiresReview = true;
    }

    // Check for suspicious patterns
    const suspiciousPatterns = await this.checkSuspiciousPatterns(transaction);
    if (suspiciousPatterns.length > 0) {
      riskFactors.push(...suspiciousPatterns);
      riskScore += 0.2 * suspiciousPatterns.length;
      monitoringType = AMLMonitoringType.SUSPICIOUS_ACTIVITY;
    }

    // Normalize risk score
    riskScore = Math.min(riskScore, 1.0);

    // Determine if review is required
    if (riskScore >= this.HIGH_RISK_SCORE) {
      requiresReview = true;
    }

    // Save monitoring record
    await this.saveMonitoringRecord({
      userId: transaction.userId,
      transactionId: transaction.transactionId,
      monitoringType,
      riskScore,
      riskFactors,
      amount: transaction.amount,
      currency: transaction.currency || 'AUD',
      requiresReview,
    });

    return {
      riskScore,
      riskFactors,
      monitoringType,
      requiresReview,
      patternType: structuringCheck.detected ? 'STRUCTURING' : undefined,
      patternDetails: structuringCheck.details,
    };
  }

  /**
   * Check for high velocity transaction patterns
   */
  private static async checkVelocityPatterns(
    userId: string,
    transactionDate: Date
  ): Promise<{ isHighVelocity: boolean; reason: string; riskContribution: number }> {
    // Check transactions in the last 24 hours
    const oneDayAgo = new Date(transactionDate.getTime() - 24 * 60 * 60 * 1000);
    
    const recentTransactions = await prisma.bank_transactions.count({
      where: {
        bank_account: {
          basiq_user: {
            user_id: userId,
          },
        },
        transaction_date: {
          gte: oneDayAgo,
          lte: transactionDate,
        },
      },
    });

    if (recentTransactions > 20) {
      return {
        isHighVelocity: true,
        reason: `High transaction velocity: ${recentTransactions} transactions in 24 hours`,
        riskContribution: 0.3,
      };
    }

    // Check for rapid successive transactions
    const fiveMinutesAgo = new Date(transactionDate.getTime() - 5 * 60 * 1000);
    const rapidTransactions = await prisma.bank_transactions.count({
      where: {
        bank_account: {
          basiq_user: {
            user_id: userId,
          },
        },
        transaction_date: {
          gte: fiveMinutesAgo,
          lte: transactionDate,
        },
      },
    });

    if (rapidTransactions > 3) {
      return {
        isHighVelocity: true,
        reason: `Rapid transactions: ${rapidTransactions} in 5 minutes`,
        riskContribution: 0.4,
      };
    }

    return {
      isHighVelocity: false,
      reason: '',
      riskContribution: 0,
    };
  }

  /**
   * Check for structuring patterns (smurfing)
   */
  private static async checkStructuringPatterns(
    userId: string,
    amount: number
  ): Promise<{ detected: boolean; details?: any }> {
    // Check if amount is just below reporting threshold
    const thresholdProximity = this.CASH_THRESHOLD - amount;
    if (thresholdProximity > 0 && thresholdProximity < 1000) {
      // Check for similar amounts in recent history
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const similarTransactions = await prisma.bank_transactions.findMany({
        where: {
          bank_account: {
            basiq_user: {
              user_id: userId,
            },
          },
          transaction_date: {
            gte: sevenDaysAgo,
          },
          amount: {
            gte: amount - 500,
            lte: amount + 500,
          },
        },
        select: {
          amount: true,
          transaction_date: true,
        },
      });

      if (similarTransactions.length >= 3) {
        return {
          detected: true,
          details: {
            patternType: 'STRUCTURING',
            similarTransactionCount: similarTransactions.length,
            amountRange: {
              min: amount - 500,
              max: amount + 500,
            },
            timeframe: '7_DAYS',
          },
        };
      }
    }

    return { detected: false };
  }

  /**
   * Check for other suspicious patterns
   */
  private static async checkSuspiciousPatterns(transaction: TransactionData): Promise<string[]> {
    const suspiciousPatterns: string[] = [];

    // Round amount transactions
    if (transaction.amount % 1000 === 0 && transaction.amount >= 5000) {
      suspiciousPatterns.push('Large round amount transaction');
    }

    // High-risk merchant categories
    const highRiskCategories = ['GAMBLING', 'CRYPTOCURRENCY', 'MONEY_TRANSFER', 'CASH_ADVANCE'];
    if (transaction.category && highRiskCategories.includes(transaction.category.toUpperCase())) {
      suspiciousPatterns.push(`High-risk category: ${transaction.category}`);
    }

    // International transactions
    if (transaction.description?.toLowerCase().includes('international') ||
        transaction.description?.toLowerCase().includes('foreign')) {
      suspiciousPatterns.push('Possible international transaction');
    }

    // Check for dormant account suddenly active
    const dormancyCheck = await this.checkDormantAccount(transaction.userId);
    if (dormancyCheck) {
      suspiciousPatterns.push('Previously dormant account');
    }

    return suspiciousPatterns;
  }

  /**
   * Check if account was dormant
   */
  private static async checkDormantAccount(userId: string): Promise<boolean> {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const oldTransactions = await prisma.bank_transactions.count({
      where: {
        bank_account: {
          basiq_user: {
            user_id: userId,
          },
        },
        transaction_date: {
          gte: sixMonthsAgo,
          lt: oneMonthAgo,
        },
      },
    });

    return oldTransactions === 0;
  }

  /**
   * Save monitoring record to database
   */
  private static async saveMonitoringRecord(data: {
    userId: string;
    transactionId?: string;
    monitoringType: AMLMonitoringType;
    riskScore: number;
    riskFactors: string[];
    amount: number;
    currency: string;
    requiresReview: boolean;
    velocityScore?: number;
  }): Promise<void> {
    await prisma.aMLTransactionMonitoring.create({
      data: {
        userId: data.userId,
        transactionId: data.transactionId,
        monitoringType: data.monitoringType,
        riskScore: new Decimal(data.riskScore),
        riskFactors: data.riskFactors,
        amount: new Decimal(data.amount),
        currency: data.currency,
        requiresReview: data.requiresReview,
        velocityScore: data.velocityScore ? new Decimal(data.velocityScore) : undefined,
      },
    });
  }

  /**
   * Submit Suspicious Matter Report (SMR) to AUSTRAC
   */
  static async submitSMR(monitoringId: string, reportDetails: any): Promise<{ success: boolean; reference?: string }> {
    try {
      const monitoring = await prisma.aMLTransactionMonitoring.findUnique({
        where: { id: monitoringId },
        include: { user: true },
      });

      if (!monitoring) {
        throw new Error('Monitoring record not found');
      }

      // In production, this would integrate with AUSTRAC API
      // For now, we'll simulate the submission
      const reportReference = `SMR-${Date.now()}-${monitoring.id.substring(0, 8)}`;

      await prisma.aMLTransactionMonitoring.update({
        where: { id: monitoringId },
        data: {
          reportedToAUSTRAC: true,
          reportReference,
          reportedAt: new Date(),
          notes: reportDetails.notes,
        },
      });

      // Audit log the submission
      await prisma.financialAuditLog.create({
        data: {
          userId: monitoring.userId,
          operationType: 'AML_REPORT_SUBMITTED',
          resourceType: 'AML_MONITORING',
          resourceId: monitoringId,
          ipAddress: '127.0.0.1', // Should be actual IP in production
          currentData: {
            reportReference,
            reportDetails,
          },
          success: true,
          amount: monitoring.amount,
          currency: monitoring.currency,
        },
      });

      return { success: true, reference: reportReference };
    } catch (error) {
      console.error('Error submitting SMR:', error);
      return { success: false };
    }
  }

  /**
   * Get monitoring alerts requiring review
   */
  static async getPendingAlerts(limit = 50): Promise<any[]> {
    const alerts = await prisma.aMLTransactionMonitoring.findMany({
      where: {
        requiresReview: true,
        reviewedAt: null,
        falsePositive: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { riskScore: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return alerts;
  }

  /**
   * Review and close an alert
   */
  static async reviewAlert(
    monitoringId: string,
    reviewerId: string,
    decision: 'CLEAR' | 'REPORT' | 'FALSE_POSITIVE',
    notes?: string
  ): Promise<void> {
    const updateData: any = {
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      notes,
    };

    if (decision === 'FALSE_POSITIVE') {
      updateData.falsePositive = true;
      updateData.requiresReview = false;
    } else if (decision === 'CLEAR') {
      updateData.requiresReview = false;
    }

    await prisma.aMLTransactionMonitoring.update({
      where: { id: monitoringId },
      data: updateData,
    });
  }
}