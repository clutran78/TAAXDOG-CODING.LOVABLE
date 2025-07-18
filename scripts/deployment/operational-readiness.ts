#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

interface OperationalCheck {
  category: string;
  item: string;
  status: 'ready' | 'not_ready' | 'partial' | 'manual';
  automated: boolean;
  details: string;
  action?: string;
}

interface OperationalReport {
  timestamp: Date;
  overallStatus: 'ready' | 'not_ready' | 'needs_review';
  results: OperationalCheck[];
  summary: {
    total: number;
    ready: number;
    notReady: number;
    partial: number;
    manual: number;
  };
  teamReadiness: {
    documentation: boolean;
    training: boolean;
    support: boolean;
    rollback: boolean;
  };
}

class OperationalReadinessValidator {
  private report: OperationalReport;

  constructor() {
    this.report = {
      timestamp: new Date(),
      overallStatus: 'ready',
      results: [],
      summary: {
        total: 0,
        ready: 0,
        notReady: 0,
        partial: 0,
        manual: 0
      },
      teamReadiness: {
        documentation: false,
        training: false,
        support: false,
        rollback: false
      }
    };
  }

  async validate(): Promise<OperationalReport> {
    console.log('📋 Starting Operational Readiness Validation...\n');

    // Check all operational areas
    await this.checkDocumentation();
    await this.checkTeamTraining();
    await this.checkSupportProcedures();
    await this.checkRollbackProcedures();
    await this.checkMonitoringSetup();
    await this.checkAlertingSetup();
    await this.checkRunbooks();
    await this.checkCapacityPlanning();
    await this.checkCommunicationChannels();
    await this.checkMaintenanceWindows();

    // Calculate summary
    this.calculateSummary();

    // Save report
    await this.saveReport();

    // Display results
    this.displayResults();

    return this.report;
  }

  private async checkDocumentation(): Promise<void> {
    console.log('📚 Checking Documentation...');

    const requiredDocs = [
      {
        file: 'README.md',
        description: 'Project overview and setup'
      },
      {
        file: 'CLAUDE.md',
        description: 'AI assistant instructions'
      },
      {
        file: 'docs/DEPLOYMENT.md',
        description: 'Deployment procedures'
      },
      {
        file: 'docs/API.md',
        description: 'API documentation'
      },
      {
        file: 'docs/TROUBLESHOOTING.md',
        description: 'Troubleshooting guide'
      },
      {
        file: 'docs/DISASTER_RECOVERY_PROCEDURES.md',
        description: 'Disaster recovery procedures'
      },
      {
        file: 'docs/SECURITY_TESTING_PROCEDURES.md',
        description: 'Security procedures'
      }
    ];

    let allDocsPresent = true;

    for (const doc of requiredDocs) {
      const docPath = path.join(process.cwd(), doc.file);
      const exists = fs.existsSync(docPath);
      
      this.addCheck({
        category: 'Documentation',
        item: doc.description,
        status: exists ? 'ready' : 'not_ready',
        automated: true,
        details: exists ? `${doc.file} present` : `${doc.file} missing`,
        action: exists ? undefined : `Create ${doc.file}`
      });

      if (!exists) allDocsPresent = false;
    }

    this.report.teamReadiness.documentation = allDocsPresent;

    // Check documentation completeness
    if (allDocsPresent) {
      await this.verifyDocumentationCompleteness();
    }
  }

  private async verifyDocumentationCompleteness(): Promise<void> {
    // Check if key sections exist in documentation
    const deploymentDoc = path.join(process.cwd(), 'docs/DEPLOYMENT.md');
    
    if (fs.existsSync(deploymentDoc)) {
      const content = await fs.promises.readFile(deploymentDoc, 'utf-8');
      const requiredSections = [
        'Prerequisites',
        'Environment Variables',
        'Deployment Steps',
        'Rollback Procedures',
        'Monitoring'
      ];

      for (const section of requiredSections) {
        const hasSection = content.includes(section);
        
        this.addCheck({
          category: 'Documentation',
          item: `Deployment docs: ${section} section`,
          status: hasSection ? 'ready' : 'partial',
          automated: true,
          details: hasSection ? 'Section documented' : 'Section missing or incomplete'
        });
      }
    }
  }

  private async checkTeamTraining(): Promise<void> {
    console.log('🎓 Checking Team Training...');

    const trainingChecks = [
      {
        item: 'Development team trained on deployment',
        file: 'docs/training/deployment-training.md'
      },
      {
        item: 'Support team trained on troubleshooting',
        file: 'docs/training/support-training.md'
      },
      {
        item: 'Security procedures training completed',
        file: 'docs/training/security-training.md'
      },
      {
        item: 'Incident response training completed',
        file: 'docs/training/incident-response-training.md'
      }
    ];

    let allTrained = true;

    for (const training of trainingChecks) {
      const exists = fs.existsSync(path.join(process.cwd(), training.file));
      
      this.addCheck({
        category: 'Team Training',
        item: training.item,
        status: exists ? 'ready' : 'manual',
        automated: false,
        details: exists ? 'Training materials available' : 'Verify training completion',
        action: exists ? undefined : 'Complete team training'
      });

      if (!exists) allTrained = false;
    }

    this.report.teamReadiness.training = allTrained;

    // Manual verification items
    this.addCheck({
      category: 'Team Training',
      item: 'On-call rotation established',
      status: 'manual',
      automated: false,
      details: 'Verify on-call schedule and contacts'
    });
  }

  private async checkSupportProcedures(): Promise<void> {
    console.log('🛟 Checking Support Procedures...');

    // Check support documentation
    const supportDocs = [
      {
        item: 'Customer support procedures',
        file: 'docs/SUPPORT_PROCEDURES.md'
      },
      {
        item: 'Escalation procedures',
        file: 'docs/ESCALATION_PROCEDURES.md'
      },
      {
        item: 'Known issues documentation',
        file: 'docs/KNOWN_ISSUES.md'
      },
      {
        item: 'FAQ documentation',
        file: 'docs/FAQ.md'
      }
    ];

    let allSupport = true;

    for (const doc of supportDocs) {
      const exists = fs.existsSync(path.join(process.cwd(), doc.file));
      
      this.addCheck({
        category: 'Support Procedures',
        item: doc.item,
        status: exists ? 'ready' : 'partial',
        automated: true,
        details: exists ? 'Documentation exists' : 'Documentation needed',
        action: exists ? undefined : `Create ${doc.file}`
      });

      if (!exists) allSupport = false;
    }

    this.report.teamReadiness.support = allSupport;

    // Check support tools
    this.addCheck({
      category: 'Support Procedures',
      item: 'Support ticketing system',
      status: 'manual',
      automated: false,
      details: 'Verify ticketing system configured'
    });

    this.addCheck({
      category: 'Support Procedures',
      item: 'Customer communication channels',
      status: 'manual',
      automated: false,
      details: 'Email, phone, chat support ready'
    });
  }

  private async checkRollbackProcedures(): Promise<void> {
    console.log('↩️  Checking Rollback Procedures...');

    // Check rollback documentation
    const rollbackDoc = path.join(process.cwd(), 'docs/ROLLBACK_PROCEDURES.md');
    const exists = fs.existsSync(rollbackDoc);

    this.addCheck({
      category: 'Rollback Procedures',
      item: 'Rollback documentation',
      status: exists ? 'ready' : 'not_ready',
      automated: true,
      details: exists ? 'Procedures documented' : 'Documentation missing',
      action: exists ? undefined : 'Document rollback procedures'
    });

    // Check database rollback capability
    this.addCheck({
      category: 'Rollback Procedures',
      item: 'Database rollback scripts',
      status: await this.verifyDatabaseRollback() ? 'ready' : 'partial',
      automated: true,
      details: 'Migration rollback scripts available'
    });

    // Check backup availability
    this.addCheck({
      category: 'Rollback Procedures',
      item: 'Recent backup available',
      status: await this.verifyRecentBackup() ? 'ready' : 'not_ready',
      automated: true,
      details: 'Backup less than 24 hours old'
    });

    // Manual checks
    this.addCheck({
      category: 'Rollback Procedures',
      item: 'Rollback tested',
      status: 'manual',
      automated: false,
      details: 'Verify rollback procedure tested in staging'
    });

    this.addCheck({
      category: 'Rollback Procedures',
      item: 'Rollback decision criteria',
      status: 'manual',
      automated: false,
      details: 'Clear criteria for rollback decision'
    });

    this.report.teamReadiness.rollback = exists;
  }

  private async checkMonitoringSetup(): Promise<void> {
    console.log('📊 Checking Monitoring Setup...');

    // Application monitoring
    this.addCheck({
      category: 'Monitoring',
      item: 'Application monitoring',
      status: await this.verifyAppMonitoring() ? 'ready' : 'partial',
      automated: true,
      details: 'Performance and error monitoring active'
    });

    // Infrastructure monitoring
    this.addCheck({
      category: 'Monitoring',
      item: 'Infrastructure monitoring',
      status: 'manual',
      automated: false,
      details: 'Server, database, network monitoring'
    });

    // Business metrics
    this.addCheck({
      category: 'Monitoring',
      item: 'Business metrics dashboard',
      status: await this.verifyBusinessMetrics() ? 'ready' : 'partial',
      automated: true,
      details: 'User activity, revenue, conversion tracking'
    });

    // Log aggregation
    this.addCheck({
      category: 'Monitoring',
      item: 'Log aggregation',
      status: await this.verifyLogAggregation() ? 'ready' : 'partial',
      automated: true,
      details: 'Centralized logging configured'
    });

    // Custom dashboards
    this.addCheck({
      category: 'Monitoring',
      item: 'Custom dashboards',
      status: 'manual',
      automated: false,
      details: 'Operations and business dashboards ready'
    });
  }

  private async checkAlertingSetup(): Promise<void> {
    console.log('🚨 Checking Alerting Setup...');

    // Critical alerts
    const criticalAlerts = [
      'Server down',
      'Database connection failure',
      'High error rate',
      'Security breach attempt',
      'Payment processing failure'
    ];

    for (const alert of criticalAlerts) {
      this.addCheck({
        category: 'Alerting',
        item: `Alert: ${alert}`,
        status: 'manual',
        automated: false,
        details: 'Verify alert configured and tested'
      });
    }

    // Alert channels
    this.addCheck({
      category: 'Alerting',
      item: 'Email alerts configured',
      status: process.env.ALERT_EMAIL ? 'ready' : 'not_ready',
      automated: true,
      details: 'Email notification channel'
    });

    this.addCheck({
      category: 'Alerting',
      item: 'SMS/Phone alerts',
      status: 'manual',
      automated: false,
      details: 'Critical alerts via SMS/phone'
    });

    this.addCheck({
      category: 'Alerting',
      item: 'Slack/Teams integration',
      status: 'manual',
      automated: false,
      details: 'Team communication channel alerts'
    });

    // Alert fatigue prevention
    this.addCheck({
      category: 'Alerting',
      item: 'Alert deduplication',
      status: 'manual',
      automated: false,
      details: 'Prevent alert fatigue with smart grouping'
    });
  }

  private async checkRunbooks(): Promise<void> {
    console.log('📖 Checking Runbooks...');

    const runbooks = [
      {
        scenario: 'High CPU usage',
        file: 'docs/runbooks/high-cpu.md'
      },
      {
        scenario: 'Database connection issues',
        file: 'docs/runbooks/database-issues.md'
      },
      {
        scenario: 'Payment processing failure',
        file: 'docs/runbooks/payment-failure.md'
      },
      {
        scenario: 'Security incident',
        file: 'docs/runbooks/security-incident.md'
      },
      {
        scenario: 'Data corruption',
        file: 'docs/runbooks/data-corruption.md'
      }
    ];

    for (const runbook of runbooks) {
      const exists = fs.existsSync(path.join(process.cwd(), runbook.file));
      
      this.addCheck({
        category: 'Runbooks',
        item: `Runbook: ${runbook.scenario}`,
        status: exists ? 'ready' : 'partial',
        automated: true,
        details: exists ? 'Runbook available' : 'Runbook needed',
        action: exists ? undefined : `Create ${runbook.file}`
      });
    }
  }

  private async checkCapacityPlanning(): Promise<void> {
    console.log('📈 Checking Capacity Planning...');

    // Current capacity
    this.addCheck({
      category: 'Capacity Planning',
      item: 'Current capacity documented',
      status: 'manual',
      automated: false,
      details: 'Server, database, bandwidth limits documented'
    });

    // Growth projections
    this.addCheck({
      category: 'Capacity Planning',
      item: 'Growth projections',
      status: 'manual',
      automated: false,
      details: '3-month and 1-year capacity projections'
    });

    // Scaling procedures
    this.addCheck({
      category: 'Capacity Planning',
      item: 'Scaling procedures',
      status: await this.verifyScalingDocs() ? 'ready' : 'partial',
      automated: true,
      details: 'Horizontal and vertical scaling procedures'
    });

    // Load testing results
    this.addCheck({
      category: 'Capacity Planning',
      item: 'Load testing completed',
      status: await this.verifyLoadTestResults() ? 'ready' : 'not_ready',
      automated: true,
      details: 'System limits identified through testing'
    });

    // Auto-scaling configuration
    this.addCheck({
      category: 'Capacity Planning',
      item: 'Auto-scaling configured',
      status: 'manual',
      automated: false,
      details: 'Auto-scaling rules for traffic spikes'
    });
  }

  private async checkCommunicationChannels(): Promise<void> {
    console.log('📢 Checking Communication Channels...');

    // Internal communication
    this.addCheck({
      category: 'Communication',
      item: 'Team communication channel',
      status: 'manual',
      automated: false,
      details: 'Slack/Teams channel for operations'
    });

    // Status page
    this.addCheck({
      category: 'Communication',
      item: 'Public status page',
      status: 'manual',
      automated: false,
      details: 'Status page for customer updates'
    });

    // Customer notifications
    this.addCheck({
      category: 'Communication',
      item: 'Customer notification system',
      status: process.env.SENDGRID_API_KEY ? 'ready' : 'partial',
      automated: true,
      details: 'Email notifications configured'
    });

    // Stakeholder contacts
    this.addCheck({
      category: 'Communication',
      item: 'Stakeholder contact list',
      status: 'manual',
      automated: false,
      details: 'Emergency contacts documented'
    });

    // Communication templates
    this.addCheck({
      category: 'Communication',
      item: 'Communication templates',
      status: await this.verifyCommTemplates() ? 'ready' : 'partial',
      automated: true,
      details: 'Incident and maintenance templates'
    });
  }

  private async checkMaintenanceWindows(): Promise<void> {
    console.log('🔧 Checking Maintenance Windows...');

    // Maintenance schedule
    this.addCheck({
      category: 'Maintenance',
      item: 'Maintenance schedule defined',
      status: 'manual',
      automated: false,
      details: 'Regular maintenance windows scheduled'
    });

    // Maintenance procedures
    this.addCheck({
      category: 'Maintenance',
      item: 'Maintenance procedures',
      status: await this.verifyMaintenanceDocs() ? 'ready' : 'partial',
      automated: true,
      details: 'Standard maintenance procedures documented'
    });

    // Customer notification process
    this.addCheck({
      category: 'Maintenance',
      item: 'Customer notification process',
      status: 'manual',
      automated: false,
      details: 'Process for notifying customers of maintenance'
    });

    // Zero-downtime deployment
    this.addCheck({
      category: 'Maintenance',
      item: 'Zero-downtime deployment',
      status: 'manual',
      automated: false,
      details: 'Blue-green or rolling deployment capability'
    });
  }

  // Helper verification methods
  private async verifyDatabaseRollback(): Promise<boolean> {
    const migrationDir = path.join(process.cwd(), 'prisma/migrations');
    return fs.existsSync(migrationDir);
  }

  private async verifyRecentBackup(): Promise<boolean> {
    const backupLog = path.join(process.cwd(), 'logs/backup-metadata.json');
    
    if (fs.existsSync(backupLog)) {
      try {
        const content = await fs.promises.readFile(backupLog, 'utf-8');
        const metadata = JSON.parse(content);
        
        if (metadata.length > 0) {
          const lastBackup = metadata[metadata.length - 1];
          const backupTime = new Date(lastBackup.timestamp);
          const hoursSinceBackup = (Date.now() - backupTime.getTime()) / (1000 * 60 * 60);
          
          return hoursSinceBackup < 24;
        }
      } catch {
        return false;
      }
    }
    
    return false;
  }

  private async verifyAppMonitoring(): Promise<boolean> {
    return fs.existsSync(path.join(process.cwd(), 'lib/monitoring'));
  }

  private async verifyBusinessMetrics(): Promise<boolean> {
    return fs.existsSync(path.join(process.cwd(), 'pages/admin/analytics.tsx'));
  }

  private async verifyLogAggregation(): Promise<boolean> {
    return fs.existsSync(path.join(process.cwd(), 'logs'));
  }

  private async verifyScalingDocs(): Promise<boolean> {
    return fs.existsSync(path.join(process.cwd(), 'docs/SCALING.md'));
  }

  private async verifyLoadTestResults(): Promise<boolean> {
    return fs.existsSync(path.join(process.cwd(), 'logs/performance-validation.json'));
  }

  private async verifyCommTemplates(): Promise<boolean> {
    const templateDir = path.join(process.cwd(), 'docs/templates');
    return fs.existsSync(templateDir);
  }

  private async verifyMaintenanceDocs(): Promise<boolean> {
    return fs.existsSync(path.join(process.cwd(), 'docs/MAINTENANCE.md'));
  }

  private addCheck(check: OperationalCheck): void {
    this.report.results.push(check);
  }

  private calculateSummary(): void {
    this.report.summary.total = this.report.results.length;
    this.report.summary.ready = this.report.results.filter(r => r.status === 'ready').length;
    this.report.summary.notReady = this.report.results.filter(r => r.status === 'not_ready').length;
    this.report.summary.partial = this.report.results.filter(r => r.status === 'partial').length;
    this.report.summary.manual = this.report.results.filter(r => r.status === 'manual').length;

    // Determine overall status
    const teamReady = Object.values(this.report.teamReadiness).every(v => v);
    
    if (this.report.summary.notReady > 0 || !teamReady) {
      this.report.overallStatus = 'not_ready';
    } else if (this.report.summary.manual > 10 || this.report.summary.partial > 5) {
      this.report.overallStatus = 'needs_review';
    } else {
      this.report.overallStatus = 'ready';
    }
  }

  private async saveReport(): Promise<void> {
    const reportPath = path.join(process.cwd(), 'logs', 'operational-readiness.json');
    
    await fs.promises.writeFile(
      reportPath,
      JSON.stringify(this.report, null, 2)
    );
  }

  private displayResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📋 OPERATIONAL READINESS REPORT');
    console.log('='.repeat(60));
    
    const statusEmoji = {
      ready: '✅',
      needs_review: '⚠️',
      not_ready: '❌'
    };
    
    console.log(`\nOverall Status: ${statusEmoji[this.report.overallStatus]} ${this.report.overallStatus.toUpperCase().replace('_', ' ')}`);
    
    console.log('\n📊 Summary:');
    console.log(`  Total Checks: ${this.report.summary.total}`);
    console.log(`  Ready: ${this.report.summary.ready}`);
    console.log(`  Not Ready: ${this.report.summary.notReady}`);
    console.log(`  Partial: ${this.report.summary.partial}`);
    console.log(`  Manual Verification: ${this.report.summary.manual}`);
    
    console.log('\n👥 Team Readiness:');
    console.log(`  Documentation: ${this.report.teamReadiness.documentation ? '✅' : '❌'}`);
    console.log(`  Training: ${this.report.teamReadiness.training ? '✅' : '❌'}`);
    console.log(`  Support: ${this.report.teamReadiness.support ? '✅' : '❌'}`);
    console.log(`  Rollback: ${this.report.teamReadiness.rollback ? '✅' : '❌'}`);
    
    // Show items needing attention
    const notReady = this.report.results.filter(r => r.status === 'not_ready');
    if (notReady.length > 0) {
      console.log('\n❌ NOT READY:');
      notReady.forEach(item => {
        console.log(`  - ${item.item}: ${item.details}`);
        if (item.action) {
          console.log(`    → Action: ${item.action}`);
        }
      });
    }
    
    // Show manual verifications needed
    const manual = this.report.results.filter(r => r.status === 'manual');
    if (manual.length > 0) {
      console.log('\n👤 MANUAL VERIFICATION NEEDED:');
      manual.forEach(item => {
        console.log(`  - ${item.item}: ${item.details}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Main execution
async function main() {
  const validator = new OperationalReadinessValidator();
  const report = await validator.validate();
  
  if (report.overallStatus === 'not_ready') {
    console.error('\n❌ Operations team is NOT ready for deployment!');
    process.exit(1);
  } else if (report.overallStatus === 'needs_review') {
    console.warn('\n⚠️  Operational readiness needs review.');
    process.exit(0);
  } else {
    console.log('\n✅ Operations team is ready!');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { OperationalReadinessValidator, OperationalReport };