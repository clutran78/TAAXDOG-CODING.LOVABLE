import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { authMiddleware, AuthenticatedRequest } from '../../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../../lib/security/sanitizer';
import { getClientIp } from 'request-ip';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../../lib/middleware/validation';
import { complianceSchemas } from '../../../../lib/validation/api-schemas';
import { logger } from '../../../../lib/utils/logger';
import { AuthEvent } from '@prisma/client';
import { apiResponse } from '@/lib/api/response';
import {
  APRAComplianceService,
  GSTComplianceService,
  PrivacyComplianceService,
} from '../../../../lib/services/compliance';

/**
 * Comprehensive Compliance Report API endpoint with validation
 * Generates comprehensive compliance reports across all domains
 * Restricted to ADMIN role users only
 */
async function comprehensiveReportHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const userId = req.userId!;
  const userRole = req.userRole;
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

  // Only admin can generate comprehensive reports
  if (userRole !== 'ADMIN') {
    logger.warn('Non-admin attempt to generate comprehensive report', {
      userId,
      userRole,
      requestId,
    });

    return apiResponse.forbidden(res, {
      error: 'Forbidden',
      message: 'Admin access required to generate comprehensive reports',
      requestId,
    });
  }

  try {
    // Body is already validated by middleware
    const { startDate, endDate, includeAML, includePrivacy, includeAPRA, includeGST } = req.body;

    const start = new Date(startDate);
    const end = new Date(endDate);

    logger.info('Comprehensive report generation started', {
      userId,
      startDate,
      endDate,
      sections: { includeAML, includePrivacy, includeAPRA, includeGST },
      clientIp,
      requestId,
    });

    const report: any = {
      reportPeriod: { startDate: start, endDate: end },
      generatedAt: new Date(),
      generatedBy: userId,
    };

    // AML/CTF Compliance
    if (includeAML) {
      const amlMonitoring = await prisma.aMLTransactionMonitoring.findMany({
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
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
      });

      report.amlCompliance = {
        totalAlerts: amlMonitoring.length,
        highRiskAlerts: amlMonitoring.filter((m) => m.riskScore.toNumber() >= 0.75).length,
        pendingReview: amlMonitoring.filter((m) => m.requiresReview && !m.reviewedAt).length,
        reportedToAUSTRAC: amlMonitoring.filter((m) => m.reportedToAUSTRAC).length,
        falsePositives: amlMonitoring.filter((m) => m.falsePositive).length,
        averageRiskScore:
          amlMonitoring.length > 0
            ? amlMonitoring.reduce((sum, m) => sum + m.riskScore.toNumber(), 0) /
              amlMonitoring.length
            : 0,
      };
    }

    // Privacy Act Compliance
    if (includePrivacy) {
      const consents = await prisma.privacyConsent.count({
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      });

      const dataRequests = await prisma.dataAccessRequest.findMany({
        where: {
          requestDate: {
            gte: start,
            lte: end,
          },
        },
      });

      // Expire old consents
      const expiredCount = await PrivacyComplianceService.expireOldConsents();

      report.privacyCompliance = {
        newConsents: consents,
        expiredConsents: expiredCount,
        dataAccessRequests: dataRequests.length,
        pendingRequests: dataRequests.filter((r) => r.requestStatus === 'PENDING').length,
        completedRequests: dataRequests.filter((r) => r.requestStatus === 'COMPLETED').length,
        averageProcessingTime: calculateAverageProcessingTime(dataRequests),
      };
    }

    // APRA Compliance
    if (includeAPRA) {
      const apraReport = await APRAComplianceService.generateComplianceReport(start, end);
      report.apraCompliance = apraReport;
    }

    // GST Compliance
    if (includeGST) {
      const gstTransactions = await prisma.gSTTransactionDetail.count({
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      });

      const gstTotal = await prisma.gSTTransactionDetail.aggregate({
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
        _sum: {
          gstAmount: true,
        },
      });

      // Use a dummy user ID for overall compliance check
      const complianceCheck = await GSTComplianceService.checkCompliance(userId);

      report.gstCompliance = {
        totalTransactions: gstTransactions,
        totalGSTCollected: gstTotal._sum.gstAmount?.toNumber() || 0,
        complianceCheck,
      };
    }

    // Save report generation audit
    await prisma.auditLog
      .create({
        data: {
          event: 'COMPLIANCE_REPORT_GENERATED' as AuthEvent,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            reportType: 'COMPREHENSIVE',
            period: { startDate: start, endDate: end },
            includedSections: {
              aml: includeAML,
              privacy: includePrivacy,
              apra: includeAPRA,
              gst: includeGST,
            },
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    logger.info('Comprehensive report generated successfully', {
      userId,
      reportSections: Object.keys(report).filter(
        (k) => k !== 'reportPeriod' && k !== 'generatedAt' && k !== 'generatedBy',
      ),
      requestId,
    });

    return apiResponse.success(res, {
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Comprehensive report generation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      requestId,
    });

    // Log error
    await prisma.auditLog
      .create({
        data: {
          event: 'COMPLIANCE_REPORT_ERROR' as AuthEvent,
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
      error: 'Failed to generate compliance report',
      message: 'Unable to generate comprehensive compliance report. Please try again.',
      requestId,
    });
  }
}

function calculateAverageProcessingTime(requests: any[]): number {
  const completedRequests = requests.filter((r) => r.completedAt);
  if (completedRequests.length === 0) return 0;

  const totalTime = completedRequests.reduce((sum, request) => {
    const processingTime = request.completedAt.getTime() - request.requestDate.getTime();
    return sum + processingTime;
  }, 0);

  // Return average time in days
  return Math.round(totalTime / completedRequests.length / (1000 * 60 * 60 * 24));
}

// Export with validation, authentication and rate limiting middleware
export default composeMiddleware(
  validateMethod(['POST']),
  withValidation({
    body: complianceSchemas.comprehensiveReport.body,
    response: complianceSchemas.comprehensiveReport.response,
  }),
  authMiddleware.authenticated,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute (reports are very resource intensive)
  }),
)(comprehensiveReportHandler);
