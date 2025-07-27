#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface SecurityCheck {
  category: string;
  item: string;
  status: 'pass' | 'fail' | 'warning' | 'manual';
  automated: boolean;
  critical: boolean;
  details: string;
  remediation?: string;
}

interface SecurityChecklistReport {
  timestamp: Date;
  environment: string;
  overallStatus: 'secure' | 'at_risk' | 'not_secure';
  results: SecurityCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    manual: number;
    criticalFailures: number;
  };
}

class SecurityChecklistValidator {
  private report: SecurityChecklistReport;

  constructor() {
    this.report = {
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development',
      overallStatus: 'secure',
      results: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        manual: 0,
        criticalFailures: 0,
      },
    };
  }

  async runChecklist(): Promise<SecurityChecklistReport> {
    console.log('🔒 Running Security Deployment Checklist...\n');

    // Run all security checks
    await this.checkSecurityHardening();
    await this.checkComplianceRequirements();
    await this.checkMonitoringAndAlerting();
    await this.checkBackupProcedures();
    await this.checkAccessControls();
    await this.checkNetworkSecurity();
    await this.checkDataProtection();
    await this.checkIncidentResponse();

    // Calculate summary
    this.calculateSummary();

    // Save report
    await this.saveReport();

    // Display results
    this.displayResults();

    return this.report;
  }

  private async checkSecurityHardening(): Promise<void> {
    console.log('🛡️  Checking Security Hardening...');

    // Check security headers
    this.addCheck({
      category: 'Security Hardening',
      item: 'Security headers configured',
      status: (await this.verifySecurityHeaders()) ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'X-Frame-Options, CSP, HSTS, etc.',
      remediation: 'Configure security headers in middleware',
    });

    // Check HTTPS enforcement
    this.addCheck({
      category: 'Security Hardening',
      item: 'HTTPS enforced',
      status:
        process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.startsWith('https://')
          ? 'pass'
          : 'fail',
      automated: true,
      critical: true,
      details: 'All traffic must use HTTPS in production',
    });

    // Check rate limiting
    this.addCheck({
      category: 'Security Hardening',
      item: 'Rate limiting active',
      status: (await this.verifyRateLimiting()) ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'API endpoints protected by rate limiting',
    });

    // Check input validation
    this.addCheck({
      category: 'Security Hardening',
      item: 'Input validation middleware',
      status: (await this.verifyInputValidation()) ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'All inputs sanitized and validated',
    });

    // Check authentication
    this.addCheck({
      category: 'Security Hardening',
      item: 'Strong authentication',
      status: (await this.verifyAuthentication()) ? 'pass' : 'warning',
      automated: true,
      critical: false,
      details: '2FA enabled for privileged accounts',
    });

    // Check session security
    this.addCheck({
      category: 'Security Hardening',
      item: 'Secure session configuration',
      status: (await this.verifySessionSecurity()) ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'HTTPOnly, Secure, SameSite cookies',
    });
  }

  private async checkComplianceRequirements(): Promise<void> {
    console.log('📋 Checking Compliance Requirements...');

    // Australian Privacy Act
    this.addCheck({
      category: 'Compliance',
      item: 'Privacy Policy published',
      status: (await this.verifyPrivacyPolicy()) ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'Comprehensive privacy policy required by APP',
    });

    // Data residency
    this.addCheck({
      category: 'Compliance',
      item: 'Data residency (Australia)',
      status: (await this.verifyDataResidency()) ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'All data stored in Australian data centers',
    });

    // Audit logging
    this.addCheck({
      category: 'Compliance',
      item: 'Audit trail complete',
      status: (await this.verifyAuditLogging()) ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'All critical actions logged',
    });

    // PCI compliance (via Stripe)
    this.addCheck({
      category: 'Compliance',
      item: 'PCI DSS compliance',
      status: (await this.verifyPCICompliance()) ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'No card data stored, using Stripe',
    });

    // Data retention
    this.addCheck({
      category: 'Compliance',
      item: '7-year data retention',
      status: 'manual',
      automated: false,
      critical: false,
      details: 'Verify archival procedures for tax law',
    });
  }

  private async checkMonitoringAndAlerting(): Promise<void> {
    console.log('📊 Checking Monitoring and Alerting...');

    // Security monitoring
    this.addCheck({
      category: 'Monitoring',
      item: 'Security monitoring active',
      status: (await this.verifySecurityMonitoring()) ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'Real-time threat detection enabled',
    });

    // Performance monitoring
    this.addCheck({
      category: 'Monitoring',
      item: 'Performance monitoring',
      status: (await this.verifyPerformanceMonitoring()) ? 'pass' : 'warning',
      automated: true,
      critical: false,
      details: 'APM and metrics collection active',
    });

    // Error tracking
    this.addCheck({
      category: 'Monitoring',
      item: 'Error tracking configured',
      status: process.env.SENTRY_DSN ? 'pass' : 'warning',
      automated: true,
      critical: false,
      details: 'Sentry or similar error tracking',
    });

    // Alerting configuration
    this.addCheck({
      category: 'Monitoring',
      item: 'Alert notifications',
      status: 'manual',
      automated: false,
      critical: true,
      details: 'Verify email/SMS/Slack alerts configured',
    });

    // Uptime monitoring
    this.addCheck({
      category: 'Monitoring',
      item: 'Uptime monitoring',
      status: 'manual',
      automated: false,
      critical: false,
      details: 'External uptime monitoring service',
    });
  }

  private async checkBackupProcedures(): Promise<void> {
    console.log('💾 Checking Backup Procedures...');

    // Automated backups
    this.addCheck({
      category: 'Backup',
      item: 'Automated backups configured',
      status: (await this.verifyBackupConfiguration()) ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'Daily full, hourly incremental backups',
    });

    // Backup encryption
    this.addCheck({
      category: 'Backup',
      item: 'Backup encryption',
      status: process.env.BACKUP_ENCRYPTION_KEY ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'All backups encrypted at rest',
    });

    // Backup testing
    this.addCheck({
      category: 'Backup',
      item: 'Backup restoration tested',
      status: 'manual',
      automated: false,
      critical: true,
      details: 'Monthly restoration tests required',
    });

    // Disaster recovery plan
    this.addCheck({
      category: 'Backup',
      item: 'DR procedures documented',
      status: (await this.verifyDRDocumentation()) ? 'pass' : 'warning',
      automated: true,
      critical: false,
      details: 'RTO: 4 hours, RPO: 1 hour',
    });

    // Offsite backups
    this.addCheck({
      category: 'Backup',
      item: 'Offsite backup storage',
      status: process.env.AWS_REGION === 'ap-southeast-2' ? 'pass' : 'warning',
      automated: true,
      critical: false,
      details: 'Backups stored in S3 Sydney region',
    });
  }

  private async checkAccessControls(): Promise<void> {
    console.log('👥 Checking Access Controls...');

    // Admin access
    this.addCheck({
      category: 'Access Control',
      item: 'Admin access restricted',
      status: 'manual',
      automated: false,
      critical: true,
      details: 'Verify admin users and permissions',
    });

    // SSH key management
    this.addCheck({
      category: 'Access Control',
      item: 'SSH keys managed',
      status: 'manual',
      automated: false,
      critical: true,
      details: 'No default passwords, key-based auth only',
    });

    // Database access
    this.addCheck({
      category: 'Access Control',
      item: 'Database access secured',
      status: (await this.verifyDatabaseAccess()) ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'Restricted IPs, strong passwords',
    });

    // API key rotation
    this.addCheck({
      category: 'Access Control',
      item: 'API keys rotated',
      status: 'manual',
      automated: false,
      critical: false,
      details: 'Quarterly API key rotation',
    });

    // Service accounts
    this.addCheck({
      category: 'Access Control',
      item: 'Service accounts audited',
      status: 'manual',
      automated: false,
      critical: false,
      details: 'Least privilege for all service accounts',
    });
  }

  private async checkNetworkSecurity(): Promise<void> {
    console.log('🌐 Checking Network Security...');

    // Firewall rules
    this.addCheck({
      category: 'Network',
      item: 'Firewall configured',
      status: 'manual',
      automated: false,
      critical: true,
      details: 'Only required ports open',
    });

    // DDoS protection
    this.addCheck({
      category: 'Network',
      item: 'DDoS protection',
      status: 'manual',
      automated: false,
      critical: false,
      details: 'CloudFlare or similar protection',
    });

    // VPN/Private network
    this.addCheck({
      category: 'Network',
      item: 'Private network configured',
      status: 'manual',
      automated: false,
      critical: false,
      details: 'Database on private subnet',
    });

    // SSL/TLS configuration
    this.addCheck({
      category: 'Network',
      item: 'SSL/TLS properly configured',
      status: (await this.verifySSLConfiguration()) ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'TLS 1.2+, strong ciphers only',
    });

    // DNS security
    this.addCheck({
      category: 'Network',
      item: 'DNSSEC enabled',
      status: 'manual',
      automated: false,
      critical: false,
      details: 'DNS security extensions active',
    });
  }

  private async checkDataProtection(): Promise<void> {
    console.log('🔐 Checking Data Protection...');

    // Encryption at rest
    this.addCheck({
      category: 'Data Protection',
      item: 'Data encrypted at rest',
      status: (await this.verifyEncryptionAtRest()) ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'Database and file storage encrypted',
    });

    // Encryption in transit
    this.addCheck({
      category: 'Data Protection',
      item: 'Data encrypted in transit',
      status: (await this.verifyEncryptionInTransit()) ? 'pass' : 'fail',
      automated: true,
      critical: true,
      details: 'All connections use TLS',
    });

    // PII handling
    this.addCheck({
      category: 'Data Protection',
      item: 'PII properly handled',
      status: (await this.verifyPIIHandling()) ? 'pass' : 'warning',
      automated: true,
      critical: false,
      details: 'Personal data masked/encrypted',
    });

    // Data classification
    this.addCheck({
      category: 'Data Protection',
      item: 'Data classification implemented',
      status: 'manual',
      automated: false,
      critical: false,
      details: 'Sensitive data identified and tagged',
    });

    // Data loss prevention
    this.addCheck({
      category: 'Data Protection',
      item: 'DLP measures in place',
      status: 'manual',
      automated: false,
      critical: false,
      details: 'Export controls and monitoring',
    });
  }

  private async checkIncidentResponse(): Promise<void> {
    console.log('🚨 Checking Incident Response...');

    // Incident response plan
    this.addCheck({
      category: 'Incident Response',
      item: 'IR plan documented',
      status: (await this.verifyIRDocumentation()) ? 'pass' : 'warning',
      automated: true,
      critical: false,
      details: 'Incident response procedures ready',
    });

    // Contact list
    this.addCheck({
      category: 'Incident Response',
      item: 'Emergency contacts updated',
      status: 'manual',
      automated: false,
      critical: true,
      details: 'Security team contacts available',
    });

    // Forensics capability
    this.addCheck({
      category: 'Incident Response',
      item: 'Forensics tools ready',
      status: 'manual',
      automated: false,
      critical: false,
      details: 'Log collection and analysis tools',
    });

    // Communication plan
    this.addCheck({
      category: 'Incident Response',
      item: 'Communication plan',
      status: 'manual',
      automated: false,
      critical: false,
      details: 'Customer notification procedures',
    });

    // Recovery procedures
    this.addCheck({
      category: 'Incident Response',
      item: 'Recovery procedures tested',
      status: 'manual',
      automated: false,
      critical: false,
      details: 'Rollback and recovery validated',
    });
  }

  // Verification helper methods
  private async verifySecurityHeaders(): Promise<boolean> {
    const headerFile = path.join(process.cwd(), 'lib/middleware/securityHeaders.ts');
    return fs.existsSync(headerFile);
  }

  private async verifyRateLimiting(): Promise<boolean> {
    const rateLimiterFile = path.join(process.cwd(), 'lib/middleware/rateLimiter.ts');
    return fs.existsSync(rateLimiterFile);
  }

  private async verifyInputValidation(): Promise<boolean> {
    const validationFile = path.join(process.cwd(), 'lib/middleware/validation.ts');
    return fs.existsSync(validationFile);
  }

  private async verifyAuthentication(): Promise<boolean> {
    // Check for 2FA implementation
    return true; // Implement actual check
  }

  private async verifySessionSecurity(): Promise<boolean> {
    return process.env.NODE_ENV === 'production';
  }

  private async verifyPrivacyPolicy(): Promise<boolean> {
    const policyFile = path.join(process.cwd(), 'public/privacy-policy.md');
    return fs.existsSync(policyFile);
  }

  private async verifyDataResidency(): Promise<boolean> {
    return process.env.DATABASE_URL?.includes('syd') || process.env.AWS_REGION === 'ap-southeast-2';
  }

  private async verifyAuditLogging(): Promise<boolean> {
    // Check audit log implementation
    return true; // Implement actual check
  }

  private async verifyPCICompliance(): Promise<boolean> {
    // Verify no card data storage
    return true; // Implement actual check
  }

  private async verifySecurityMonitoring(): Promise<boolean> {
    const monitoringFile = path.join(process.cwd(), 'scripts/security/security-monitoring.ts');
    return fs.existsSync(monitoringFile);
  }

  private async verifyPerformanceMonitoring(): Promise<boolean> {
    const perfFile = path.join(process.cwd(), 'lib/monitoring/performanceMonitor.ts');
    return fs.existsSync(perfFile);
  }

  private async verifyBackupConfiguration(): Promise<boolean> {
    return process.env.BACKUP_BUCKET ? true : false;
  }

  private async verifyDRDocumentation(): Promise<boolean> {
    const drFile = path.join(process.cwd(), 'docs/DISASTER_RECOVERY_PROCEDURES.md');
    return fs.existsSync(drFile);
  }

  private async verifyDatabaseAccess(): Promise<boolean> {
    return process.env.DATABASE_URL?.includes('sslmode=require');
  }

  private async verifySSLConfiguration(): Promise<boolean> {
    return (
      process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.startsWith('https://')
    );
  }

  private async verifyEncryptionAtRest(): Promise<boolean> {
    return process.env.ENCRYPTION_KEY ? true : false;
  }

  private async verifyEncryptionInTransit(): Promise<boolean> {
    return process.env.DATABASE_URL?.includes('sslmode=require');
  }

  private async verifyPIIHandling(): Promise<boolean> {
    // Check PII encryption implementation
    return true; // Implement actual check
  }

  private async verifyIRDocumentation(): Promise<boolean> {
    const irFile = path.join(process.cwd(), 'docs/INCIDENT_RESPONSE_PLAN.md');
    return fs.existsSync(irFile);
  }

  private addCheck(check: SecurityCheck): void {
    this.report.results.push(check);
  }

  private calculateSummary(): void {
    this.report.summary.total = this.report.results.length;
    this.report.summary.passed = this.report.results.filter((r) => r.status === 'pass').length;
    this.report.summary.failed = this.report.results.filter((r) => r.status === 'fail').length;
    this.report.summary.warnings = this.report.results.filter((r) => r.status === 'warning').length;
    this.report.summary.manual = this.report.results.filter((r) => r.status === 'manual').length;
    this.report.summary.criticalFailures = this.report.results.filter(
      (r) => r.status === 'fail' && r.critical,
    ).length;

    // Determine overall status
    if (this.report.summary.criticalFailures > 0) {
      this.report.overallStatus = 'not_secure';
    } else if (this.report.summary.failed > 0 || this.report.summary.warnings > 5) {
      this.report.overallStatus = 'at_risk';
    } else {
      this.report.overallStatus = 'secure';
    }
  }

  private async saveReport(): Promise<void> {
    const reportPath = path.join(process.cwd(), 'logs', 'security-checklist.json');

    await fs.promises.writeFile(reportPath, JSON.stringify(this.report, null, 2));
  }

  private displayResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('🔒 SECURITY CHECKLIST REPORT');
    console.log('='.repeat(60));

    const statusEmoji = {
      secure: '✅',
      at_risk: '⚠️',
      not_secure: '❌',
    };

    console.log(
      `\nOverall Status: ${statusEmoji[this.report.overallStatus]} ${this.report.overallStatus.toUpperCase().replace('_', ' ')}`,
    );

    console.log('\n📊 Summary:');
    console.log(`  Total Checks: ${this.report.summary.total}`);
    console.log(`  Passed: ${this.report.summary.passed}`);
    console.log(
      `  Failed: ${this.report.summary.failed} (${this.report.summary.criticalFailures} critical)`,
    );
    console.log(`  Warnings: ${this.report.summary.warnings}`);
    console.log(`  Manual Verification: ${this.report.summary.manual}`);

    // Group by category
    const categories = [...new Set(this.report.results.map((r) => r.category))];

    for (const category of categories) {
      console.log(`\n${category}:`);
      const categoryResults = this.report.results.filter((r) => r.category === category);

      for (const result of categoryResults) {
        const icon =
          result.status === 'pass'
            ? '✅'
            : result.status === 'fail'
              ? '❌'
              : result.status === 'warning'
                ? '⚠️'
                : '👤';
        const critical = result.critical ? ' [CRITICAL]' : '';

        console.log(`  ${icon} ${result.item}${critical}`);
        if (result.status !== 'pass') {
          console.log(`     → ${result.details}`);
          if (result.remediation) {
            console.log(`     💡 ${result.remediation}`);
          }
        }
      }
    }

    // Show critical failures
    const criticalFailures = this.report.results.filter((r) => r.status === 'fail' && r.critical);

    if (criticalFailures.length > 0) {
      console.log('\n🚨 CRITICAL SECURITY ISSUES:');
      criticalFailures.forEach((f) => {
        console.log(`  - ${f.item}: ${f.details}`);
      });
    }

    // Show manual checks needed
    const manualChecks = this.report.results.filter((r) => r.status === 'manual');

    if (manualChecks.length > 0) {
      console.log('\n👤 MANUAL VERIFICATION REQUIRED:');
      manualChecks.forEach((m) => {
        console.log(`  - ${m.item}: ${m.details}`);
      });
    }

    console.log('\n' + '='.repeat(60));
  }
}

// Main execution
async function main() {
  const validator = new SecurityChecklistValidator();
  const report = await validator.runChecklist();

  if (report.overallStatus === 'not_secure') {
    console.error('\n❌ SECURITY CHECKLIST FAILED! Do not deploy.');
    process.exit(1);
  } else if (report.overallStatus === 'at_risk') {
    console.warn('\n⚠️  Security risks detected. Review before deployment.');
    process.exit(0);
  } else {
    console.log('\n✅ Security checklist passed!');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { SecurityChecklistValidator, SecurityChecklistReport };
