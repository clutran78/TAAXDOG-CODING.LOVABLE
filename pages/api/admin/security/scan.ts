import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { SecurityValidationService } from '../../../../scripts/security/security-validation';
import { createAuditLog } from '../../../../lib/services/auditLogger';
import { FinancialOperation } from '@prisma/client';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const session = await getSession({ req });

  if (!session || session.user.role !== 'ADMIN') {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  try {
    // Log the security scan initiation
    await createAuditLog(
      {
        userId: session.user.id,
        operationType: 'COMPLIANCE_REPORT_GENERATED' as FinancialOperation,
        resourceType: 'security_scan',
        success: true,
        currentData: {
          initiatedBy: session.user.email,
          scanType: 'manual',
          action: 'security.scan.initiated',
        },
      },
      {
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '',
        request: req,
      },
    );

    // Run security validation
    const validator = new SecurityValidationService();
    const report = await validator.runValidation();

    // Log scan completion
    await createAuditLog(
      {
        userId: session.user.id,
        operationType: 'COMPLIANCE_REPORT_GENERATED' as FinancialOperation,
        resourceType: 'security_scan',
        success: true,
        currentData: {
          score: report.score,
          status: report.overallStatus,
          checksPerformed: report.checks.length,
          failures: report.checks.filter((c) => c.status === 'fail').length,
          action: 'security.scan.completed',
        },
      },
      {
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '',
        request: req,
      },
    );

    // If vulnerabilities found, create security events
    const criticalFailures = report.checks.filter(
      (c) => c.status === 'fail' && c.severity === 'critical',
    );

    for (const failure of criticalFailures) {
      await createAuditLog(
        {
          userId: session.user.id,
          operationType: 'COMPLIANCE_REPORT_GENERATED' as FinancialOperation,
          resourceType: 'security_vulnerability',
          success: false,
          errorMessage: failure.details,
          currentData: {
            category: failure.category,
            check: failure.check,
            severity: failure.severity,
            details: failure.details,
            action: 'security.vulnerability.detected',
          },
        },
        {
          ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '',
          request: req,
        },
      );
    }

    apiResponse.success(res, {
      success: true,
      report: {
        timestamp: report.timestamp,
        overallStatus: report.overallStatus,
        score: report.score,
        totalChecks: report.checks.length,
        passed: report.checks.filter((c) => c.status === 'pass').length,
        failed: report.checks.filter((c) => c.status === 'fail').length,
        warnings: report.checks.filter((c) => c.status === 'warning').length,
        recommendations: report.recommendations,
      },
    });
  } catch (error) {
    logger.error('Security scan error:', error);

    // Log scan failure with error handling
    try {
      await createAuditLog(
        {
          userId: session.user.id,
          operationType: 'COMPLIANCE_REPORT_GENERATED' as FinancialOperation,
          resourceType: 'security_scan',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          currentData: {
            action: 'security.scan.failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        {
          ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '',
          request: req,
        },
      );
    } catch (auditError) {
      // Log the audit error but don't let it affect the main error response
      logger.error('Failed to create audit log for security scan failure:', auditError);
    }

    apiResponse.internalError(res, { error: 'Security scan failed' });
  }
}
