import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { authMiddleware, AuthenticatedRequest } from '../../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../../lib/security/sanitizer';
import { getClientIp } from 'request-ip';
import { GSTComplianceService } from '../../../../lib/services/compliance/gstCompliance';
import { format } from 'date-fns';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../../lib/middleware/validation';
import { complianceSchemas } from '../../../../lib/validation/api-schemas';
import { logger } from '../../../../lib/utils/logger';
import { AuthEvent } from '@prisma/client';
import { apiResponse } from '@/lib/api/response';

/**
 * BAS Report Generation API endpoint with comprehensive validation
 * Generates Business Activity Statement reports for Australian GST compliance
 * Uses authentication middleware to ensure data isolation
 */
async function basReportHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const userId = req.userId!;
  const clientIp = getClientIp(req) || 'unknown';

  // Validate userId exists
  if (!userId) {
    logger.error('Missing userId in authenticated request', { requestId });
    return apiResponse.unauthorized(res, {
      error: 'Authentication Error',
      message: 'User ID not found in authenticated request',
      requestId,
    });
  }

  try {
    // Body is already validated by middleware
    const { taxPeriod, reportType } = req.body;

    logger.info('BAS report generation request', {
      userId,
      taxPeriod,
      reportType,
      clientIp,
      requestId,
    });

    // Check if user has business profile
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        abn: true,
        businessName: true,
        gstRegistered: true,
      },
    });

    if (!user?.abn) {
      logger.warn('BAS report attempted without ABN', {
        userId,
        requestId,
      });

      return apiResponse.error(res, {
        error: 'Business profile required',
        message: 'ABN is required to generate BAS reports. Please update your business profile.',
        requestId,
      });
    }

    // Log BAS report generation
    await prisma.auditLog
      .create({
        data: {
          event: 'BAS_REPORT_GENERATION' as AuthEvent,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            taxPeriod,
            reportType,
            abn: user.abn,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    // Generate BAS report
    const basReport = await GSTComplianceService.generateBASReport(userId, taxPeriod);

    // Check compliance issues
    const compliance = await GSTComplianceService.checkCompliance(userId);

    // Format report based on type
    let response: any = {
      success: true,
      data: {
        report: basReport,
        period: taxPeriod,
        businessDetails: {
          abn: user.abn,
          businessName: user.businessName || 'Not specified',
          gstRegistered: user.gstRegistered || false,
        },
        compliance: {
          status: compliance.compliant ? 'compliant' : 'issues-found',
          issues: compliance.issues,
          recommendations: compliance.recommendations,
          gstRegistrationRequired: compliance.gstRegistrationRequired,
        },
      },
    };

    if (reportType === 'detailed') {
      // Add detailed breakdown
      response.data.breakdown = await getDetailedBreakdown(userId, taxPeriod);
    } else if (reportType === 'export') {
      // Format for ATO submission
      response.data.atoFormat = formatForATO(basReport, user.abn);
    }

    // Add calculations and summaries
    response.data.calculations = {
      gstPayable: basReport.netGST > 0 ? basReport.netGST : 0,
      gstRefundable: basReport.netGST < 0 ? Math.abs(basReport.netGST) : 0,
      totalTaxableSales: basReport.totalSales - basReport.exportSales,
      inputTaxCredits: basReport.gstOnPurchases,
    };

    // Add important dates
    const periodDates = getPeriodDates(taxPeriod);
    response.data.dates = {
      periodStart: periodDates.start,
      periodEnd: periodDates.end,
      dueDate: periodDates.dueDate,
      isOverdue: new Date() > periodDates.dueDate,
    };

    logger.info('BAS report generated successfully', {
      userId,
      taxPeriod,
      reportType,
      gstPayable: response.data.calculations.gstPayable,
      gstRefundable: response.data.calculations.gstRefundable,
      requestId,
    });

    return apiResponse.success(res, response);
  } catch (error) {
    logger.error('BAS report generation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      requestId,
    });

    // Log error
    await prisma.auditLog
      .create({
        data: {
          event: 'BAS_REPORT_ERROR' as AuthEvent,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    return apiResponse.internalError(res, {
      error: 'BAS report generation failed',
      message: 'Unable to generate BAS report. Please try again.',
      requestId,
    });
  }
}

// Get detailed transaction breakdown
async function getDetailedBreakdown(userId: string, taxPeriod: string) {
  const periodDates = getPeriodDates(taxPeriod);

  // Get all transactions with GST for the period
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: {
        gte: periodDates.start,
        lte: periodDates.end,
      },
      gstAmount: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
      gstAmount: true,
      type: true,
      category: true,
      taxCategory: true,
      merchant: true,
      bankAccount: {
        select: {
          accountName: true,
          institution: true,
        },
      },
    },
    orderBy: { date: 'desc' },
  });

  // Group by category
  const byCategory: Record<string, any> = {};

  for (const tx of transactions) {
    const category = tx.taxCategory || tx.category || 'Other';
    if (!byCategory[category]) {
      byCategory[category] = {
        category,
        income: 0,
        expenses: 0,
        gstCollected: 0,
        gstPaid: 0,
        transactions: [],
      };
    }

    if (tx.type === 'INCOME') {
      byCategory[category].income += Math.abs(tx.amount);
      byCategory[category].gstCollected += Math.abs(tx.gstAmount || 0);
    } else {
      byCategory[category].expenses += Math.abs(tx.amount);
      byCategory[category].gstPaid += Math.abs(tx.gstAmount || 0);
    }

    byCategory[category].transactions.push({
      id: tx.id,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      gstAmount: tx.gstAmount,
      type: tx.type,
      merchant: tx.merchant,
      account: tx.bankAccount?.accountName || 'Unknown',
    });
  }

  return {
    transactionCount: transactions.length,
    byCategory: Object.values(byCategory),
    summary: {
      totalTransactions: transactions.length,
      withGST: transactions.filter((tx) => tx.gstAmount && tx.gstAmount !== 0).length,
      categories: Object.keys(byCategory).length,
    },
  };
}

// Format report for ATO submission
function formatForATO(report: any, abn: string) {
  return {
    abn: abn.replace(/\s/g, ''),
    taxPeriod: report.taxPeriod,
    // G1: Total sales
    g1: Math.round(report.totalSales),
    // G2: Export sales
    g2: Math.round(report.exportSales),
    // G3: Other GST-free sales
    g3: 0, // Would need to be calculated from transactions
    // G4: Input taxed sales
    g4: 0, // Would need to be calculated from transactions
    // G10: Capital purchases
    g10: Math.round(report.capitalPurchases),
    // G11: Non-capital purchases
    g11: Math.round(report.totalPurchases - report.capitalPurchases),
    // 1A: GST on sales
    '1a': Math.round(report.gstOnSales),
    // 1B: GST on purchases
    '1b': Math.round(report.gstOnPurchases),
    // Net GST (1A - 1B)
    netGst: Math.round(report.netGST),
  };
}

// Get period dates and due date
function getPeriodDates(taxPeriod: string) {
  const [year, period] = taxPeriod.split('-');
  let start: Date, end: Date, dueDate: Date;

  if (period.startsWith('Q')) {
    // Quarterly
    const quarter = parseInt(period.substring(1));
    const startMonth = (quarter - 1) * 3;
    start = new Date(parseInt(year), startMonth, 1);
    end = new Date(parseInt(year), startMonth + 3, 0);
    // Due 28 days after quarter end
    dueDate = new Date(end);
    dueDate.setDate(dueDate.getDate() + 28);
  } else {
    // Monthly
    const month = parseInt(period) - 1;
    start = new Date(parseInt(year), month, 1);
    end = new Date(parseInt(year), month + 1, 0);
    // Due 21 days after month end
    dueDate = new Date(end);
    dueDate.setDate(dueDate.getDate() + 21);
  }

  return {
    start,
    end,
    dueDate,
  };
}

// Export with validation, authentication and rate limiting middleware
export default composeMiddleware(
  validateMethod(['POST']),
  withValidation({
    body: complianceSchemas.basReport.body,
    response: complianceSchemas.basReport.response,
  }),
  authMiddleware.authenticated,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute (reports are resource intensive)
  }),
)(basReportHandler);
