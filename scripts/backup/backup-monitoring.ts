#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { format, subHours, subDays } from 'date-fns';
import * as dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);

interface BackupStatus {
  type: 'full' | 'incremental';
  lastBackup: Date | null;
  nextScheduled: Date;
  isOverdue: boolean;
  lastVerification: Date | null;
  verificationStatus: 'passed' | 'failed' | 'not_verified';
  alerts: string[];
}

interface MonitoringReport {
  timestamp: Date;
  status: 'healthy' | 'warning' | 'critical';
  backupStatuses: BackupStatus[];
  metrics: {
    totalBackups: number;
    failedBackups: number;
    avgBackupDuration: number;
    storageUsed: number;
    estimatedRecoveryTime: number;
  };
  alerts: string[];
  recommendations: string[];
}

class BackupMonitoringService {
  private schedules = {
    full: { interval: 24 * 60 * 60 * 1000, tolerance: 2 * 60 * 60 * 1000 }, // Daily ± 2 hours
    incremental: { interval: 60 * 60 * 1000, tolerance: 15 * 60 * 1000 } // Hourly ± 15 minutes
  };

  async generateMonitoringReport(): Promise<MonitoringReport> {
    const report: MonitoringReport = {
      timestamp: new Date(),
      status: 'healthy',
      backupStatuses: [],
      metrics: {
        totalBackups: 0,
        failedBackups: 0,
        avgBackupDuration: 0,
        storageUsed: 0,
        estimatedRecoveryTime: 0
      },
      alerts: [],
      recommendations: []
    };

    try {
      // Check backup statuses
      const fullStatus = await this.checkBackupStatus('full');
      const incrementalStatus = await this.checkBackupStatus('incremental');
      
      report.backupStatuses = [fullStatus, incrementalStatus];

      // Calculate metrics
      report.metrics = await this.calculateMetrics();

      // Check for issues
      this.checkForIssues(report);

      // Generate recommendations
      this.generateRecommendations(report);

      // Determine overall status
      if (report.alerts.some(alert => alert.includes('CRITICAL'))) {
        report.status = 'critical';
      } else if (report.alerts.length > 0) {
        report.status = 'warning';
      }

      // Send alerts if needed
      if (report.status !== 'healthy') {
        await this.sendAlerts(report);
      }

      // Log report
      await this.logReport(report);

    } catch (error) {
      console.error('Failed to generate monitoring report:', error);
      report.status = 'critical';
      report.alerts.push(`CRITICAL: Monitoring system error: ${error}`);
    }

    return report;
  }

  private async checkBackupStatus(type: 'full' | 'incremental'): Promise<BackupStatus> {
    const status: BackupStatus = {
      type,
      lastBackup: null,
      nextScheduled: new Date(),
      isOverdue: false,
      lastVerification: null,
      verificationStatus: 'not_verified',
      alerts: []
    };

    try {
      // Get last backup info
      const metadata = await this.getBackupMetadata();
      const lastBackup = metadata
        .filter((m: any) => m.type === type)
        .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))[0];

      if (lastBackup) {
        status.lastBackup = new Date(lastBackup.timestamp);
        
        // Calculate next scheduled time
        const schedule = this.schedules[type];
        status.nextScheduled = new Date(
          status.lastBackup.getTime() + schedule.interval
        );

        // Check if overdue
        const now = new Date();
        if (now > new Date(status.nextScheduled.getTime() + schedule.tolerance)) {
          status.isOverdue = true;
          status.alerts.push(
            `${type.toUpperCase()} backup is overdue by ${
              Math.round((now.getTime() - status.nextScheduled.getTime()) / 60000)
            } minutes`
          );
        }

        // Check verification status
        const verificationLog = await this.getVerificationLog();
        const lastVerification = verificationLog
          .filter((v: any) => v.backup === lastBackup.s3Key)
          .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))[0];

        if (lastVerification) {
          status.lastVerification = new Date(lastVerification.timestamp);
          status.verificationStatus = lastVerification.status === 'success' ? 'passed' : 'failed';
          
          if (status.verificationStatus === 'failed') {
            status.alerts.push(`Last ${type} backup verification FAILED`);
          }
        } else {
          status.alerts.push(`${type} backup has not been verified`);
        }
      } else {
        status.alerts.push(`No ${type} backup found`);
      }

    } catch (error) {
      status.alerts.push(`Failed to check ${type} backup status: ${error}`);
    }

    return status;
  }

  private async calculateMetrics(): Promise<any> {
    const metrics = {
      totalBackups: 0,
      failedBackups: 0,
      avgBackupDuration: 0,
      storageUsed: 0,
      estimatedRecoveryTime: 0
    };

    try {
      const metadata = await this.getBackupMetadata();
      metrics.totalBackups = metadata.length;

      // Calculate failed backups (last 7 days)
      const weekAgo = subDays(new Date(), 7);
      const recentBackups = metadata.filter(
        (m: any) => new Date(m.timestamp) > weekAgo
      );

      // Get verification logs
      const verificationLog = await this.getVerificationLog();
      const failedVerifications = verificationLog.filter(
        (v: any) => v.status === 'failed' && new Date(v.timestamp) > weekAgo
      );
      metrics.failedBackups = failedVerifications.length;

      // Calculate average backup duration (mock for now)
      metrics.avgBackupDuration = 15; // minutes

      // Calculate storage used
      metrics.storageUsed = metadata.reduce(
        (sum: number, m: any) => sum + (m.size || 0), 
        0
      );

      // Estimate recovery time based on backup sizes and types
      const latestFull = metadata
        .filter((m: any) => m.type === 'full')
        .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))[0];

      if (latestFull) {
        // Base time for full restore + incremental backups
        metrics.estimatedRecoveryTime = 60; // minutes base
        
        // Add time for incremental backups since last full
        const incrementalsSince = metadata.filter(
          (m: any) => 
            m.type === 'incremental' && 
            new Date(m.timestamp) > new Date(latestFull.timestamp)
        ).length;
        
        metrics.estimatedRecoveryTime += incrementalsSince * 5; // 5 minutes per incremental
      }

    } catch (error) {
      console.error('Failed to calculate metrics:', error);
    }

    return metrics;
  }

  private checkForIssues(report: MonitoringReport): void {
    // Check backup frequency
    report.backupStatuses.forEach(status => {
      if (status.isOverdue) {
        report.alerts.push(
          `CRITICAL: ${status.type.toUpperCase()} backup is overdue`
        );
      }
    });

    // Check verification status
    const unverified = report.backupStatuses.filter(
      s => s.verificationStatus === 'not_verified'
    );
    if (unverified.length > 0) {
      report.alerts.push(
        `WARNING: ${unverified.length} backup(s) have not been verified`
      );
    }

    // Check failed backups
    if (report.metrics.failedBackups > 0) {
      report.alerts.push(
        `WARNING: ${report.metrics.failedBackups} backup(s) failed in the last 7 days`
      );
    }

    // Check recovery time against RTO
    const rto = 4 * 60; // 4 hours in minutes
    if (report.metrics.estimatedRecoveryTime > rto) {
      report.alerts.push(
        `WARNING: Estimated recovery time (${report.metrics.estimatedRecoveryTime} min) exceeds RTO (${rto} min)`
      );
    }

    // Check storage usage
    const storageLimit = 1000 * 1024 * 1024 * 1024; // 1TB
    if (report.metrics.storageUsed > storageLimit * 0.8) {
      report.alerts.push(
        `WARNING: Backup storage usage at ${
          Math.round(report.metrics.storageUsed / storageLimit * 100)
        }% of limit`
      );
    }
  }

  private generateRecommendations(report: MonitoringReport): void {
    // Based on issues found, generate recommendations
    if (report.metrics.failedBackups > 2) {
      report.recommendations.push(
        'Investigate root cause of backup failures - check database connectivity and permissions'
      );
    }

    if (report.metrics.estimatedRecoveryTime > 180) {
      report.recommendations.push(
        'Consider implementing parallel restore processes to reduce recovery time'
      );
    }

    const unverifiedCount = report.backupStatuses.filter(
      s => s.verificationStatus === 'not_verified'
    ).length;
    
    if (unverifiedCount > 0) {
      report.recommendations.push(
        'Schedule immediate verification of unverified backups'
      );
    }

    if (report.metrics.storageUsed > 500 * 1024 * 1024 * 1024) { // 500GB
      report.recommendations.push(
        'Review retention policies - consider archiving older backups to Glacier'
      );
    }
  }

  private async getBackupMetadata(): Promise<any[]> {
    try {
      const metadataPath = path.join(process.cwd(), 'logs', 'backup-metadata.json');
      const content = await fs.promises.readFile(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private async getVerificationLog(): Promise<any[]> {
    try {
      const logPath = path.join(process.cwd(), 'logs', 'backup-verification.log');
      const content = await fs.promises.readFile(logPath, 'utf-8');
      return content
        .split('\n')
        .filter(line => line)
        .map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }

  private async sendAlerts(report: MonitoringReport): Promise<void> {
    console.log('🚨 SENDING ALERTS:');
    report.alerts.forEach(alert => console.log(`  - ${alert}`));

    // In production, this would:
    // - Send emails to ops team
    // - Post to Slack/Teams
    // - Create PagerDuty incidents for critical issues
    // - Update monitoring dashboards
  }

  private async logReport(report: MonitoringReport): Promise<void> {
    const logPath = path.join(process.cwd(), 'logs', 'backup-monitoring.log');
    
    await fs.promises.appendFile(
      logPath,
      JSON.stringify(report) + '\n'
    );
  }

  async generateDashboard(): Promise<void> {
    console.log('\n📊 BACKUP SYSTEM DASHBOARD');
    console.log('=' .repeat(50));

    const report = await this.generateMonitoringReport();

    // Status Overview
    const statusEmoji = {
      healthy: '✅',
      warning: '⚠️',
      critical: '🚨'
    };

    console.log(`\nSystem Status: ${statusEmoji[report.status]} ${report.status.toUpperCase()}`);
    console.log(`Last Check: ${format(report.timestamp, 'yyyy-MM-dd HH:mm:ss')}`);

    // Backup Status
    console.log('\n📦 Backup Status:');
    report.backupStatuses.forEach(status => {
      const overdueText = status.isOverdue ? ' ⚠️ OVERDUE' : '';
      const lastBackupText = status.lastBackup 
        ? format(status.lastBackup, 'yyyy-MM-dd HH:mm')
        : 'Never';
      
      console.log(`  ${status.type.toUpperCase()}:`);
      console.log(`    Last Backup: ${lastBackupText}${overdueText}`);
      console.log(`    Next Scheduled: ${format(status.nextScheduled, 'yyyy-MM-dd HH:mm')}`);
      console.log(`    Verification: ${status.verificationStatus}`);
    });

    // Metrics
    console.log('\n📈 Metrics:');
    console.log(`  Total Backups: ${report.metrics.totalBackups}`);
    console.log(`  Failed (7 days): ${report.metrics.failedBackups}`);
    console.log(`  Avg Duration: ${report.metrics.avgBackupDuration} minutes`);
    console.log(`  Storage Used: ${this.formatBytes(report.metrics.storageUsed)}`);
    console.log(`  Est. Recovery Time: ${report.metrics.estimatedRecoveryTime} minutes`);

    // Alerts
    if (report.alerts.length > 0) {
      console.log('\n⚠️  Active Alerts:');
      report.alerts.forEach(alert => console.log(`  - ${alert}`));
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }

    console.log('\n' + '='.repeat(50));
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Main execution
async function main() {
  const monitoringService = new BackupMonitoringService();

  if (process.argv[2] === '--dashboard') {
    await monitoringService.generateDashboard();
  } else {
    const report = await monitoringService.generateMonitoringReport();
    
    console.log('Monitoring Report Generated:');
    console.log(`Status: ${report.status}`);
    console.log(`Alerts: ${report.alerts.length}`);
    
    if (report.status !== 'healthy') {
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main();
}

export { BackupMonitoringService, MonitoringReport };