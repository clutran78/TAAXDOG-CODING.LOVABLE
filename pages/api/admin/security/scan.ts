import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { SecurityValidationService } from '../../../../scripts/security/security-validation';
import { createAuditLog } from '../../../../lib/services/auditLogger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getSession({ req });
  
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Log the security scan initiation
    await createAuditLog(
      session.user.id,
      'security.scan.initiated',
      req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '',
      {
        initiatedBy: session.user.email,
        scanType: 'manual'
      }
    );

    // Run security validation
    const validator = new SecurityValidationService();
    const report = await validator.runValidation();

    // Log scan completion
    await createAuditLog(
      session.user.id,
      'security.scan.completed',
      req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '',
      {
        score: report.score,
        status: report.overallStatus,
        checksPerformed: report.checks.length,
        failures: report.checks.filter(c => c.status === 'fail').length
      }
    );

    // If vulnerabilities found, create security events
    const criticalFailures = report.checks.filter(
      c => c.status === 'fail' && c.severity === 'critical'
    );

    for (const failure of criticalFailures) {
      await createAuditLog(
        session.user.id,
        'security.vulnerability.detected',
        req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '',
        {
          category: failure.category,
          check: failure.check,
          severity: failure.severity,
          details: failure.details
        }
      );
    }

    res.status(200).json({
      success: true,
      report: {
        timestamp: report.timestamp,
        overallStatus: report.overallStatus,
        score: report.score,
        totalChecks: report.checks.length,
        passed: report.checks.filter(c => c.status === 'pass').length,
        failed: report.checks.filter(c => c.status === 'fail').length,
        warnings: report.checks.filter(c => c.status === 'warning').length,
        recommendations: report.recommendations
      }
    });
  } catch (error) {
    console.error('Security scan error:', error);
    
    // Log scan failure
    await createAuditLog(
      session.user.id,
      'security.scan.failed',
      req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '',
      {
        error: error.message
      }
    );

    res.status(500).json({ error: 'Security scan failed' });
  }
}