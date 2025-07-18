#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';
import { AMLMonitoringService } from '@/lib/services/compliance';

const prisma = new PrismaClient();

/**
 * Check for critical compliance alerts that need immediate attention
 * This script runs hourly to ensure timely response to compliance issues
 */
async function checkCriticalAlerts() {
  console.log('Checking for critical compliance alerts...');
  
  try {
    const alerts = [];

    // 1. Check high-risk AML transactions
    const highRiskAML = await prisma.aMLTransactionMonitoring.findMany({
      where: {
        requiresReview: true,
        reviewedAt: null,
        riskScore: {
          gte: 0.75,
        },
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        riskScore: 'desc',
      },
      take: 10,
    });

    if (highRiskAML.length > 0) {
      alerts.push({
        type: 'AML_HIGH_RISK',
        severity: 'CRITICAL',
        count: highRiskAML.length,
        message: `${highRiskAML.length} high-risk AML transactions require immediate review`,
        details: highRiskAML.map(t => ({
          id: t.id,
          riskScore: t.riskScore.toNumber(),
          amount: t.amount.toNumber(),
          user: t.user.email,
        })),
      });
    }

    // 2. Check overdue data requests
    const overdueRequests = await prisma.dataAccessRequest.count({
      where: {
        requestStatus: {
          notIn: ['COMPLETED', 'REJECTED'],
        },
        dueDate: {
          lt: new Date(),
        },
      },
    });

    if (overdueRequests > 0) {
      alerts.push({
        type: 'PRIVACY_OVERDUE',
        severity: 'HIGH',
        count: overdueRequests,
        message: `${overdueRequests} data access requests are overdue`,
      });
    }

    // 3. Check unreported APRA incidents
    const unreportedIncidents = await prisma.aPRAIncidentReport.findMany({
      where: {
        reportedToAPRA: false,
        severity: {
          in: ['CRITICAL', 'HIGH'],
        },
      },
    });

    for (const incident of unreportedIncidents) {
      const hoursSinceDetection = (Date.now() - incident.detectedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceDetection > 48) {
        alerts.push({
          type: 'APRA_REPORT_OVERDUE',
          severity: 'CRITICAL',
          message: `APRA incident ${incident.id} approaching 72-hour reporting deadline`,
          details: {
            incidentType: incident.incidentType,
            severity: incident.severity,
            hoursRemaining: Math.max(0, 72 - hoursSinceDetection),
          },
        });
      }
    }

    // 4. Check system health
    const lastBackupCheck = await prisma.complianceConfiguration.findFirst({
      where: {
        configType: 'LAST_BACKUP_CHECK',
      },
    });

    if (lastBackupCheck) {
      const lastBackupTime = new Date(lastBackupCheck.configData as any);
      const hoursSinceBackup = (Date.now() - lastBackupTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceBackup > 24) {
        alerts.push({
          type: 'BACKUP_OVERDUE',
          severity: 'HIGH',
          message: 'Backup is more than 24 hours old',
          details: {
            lastBackup: lastBackupTime,
            hoursOverdue: hoursSinceBackup - 24,
          },
        });
      }
    }

    // Output results
    if (alerts.length === 0) {
      console.log('✅ No critical alerts at this time');
    } else {
      console.log(`\n🚨 ${alerts.length} CRITICAL ALERTS REQUIRE ATTENTION:\n`);
      
      alerts.forEach((alert, index) => {
        console.log(`${index + 1}. [${alert.severity}] ${alert.type}`);
        console.log(`   ${alert.message}`);
        if (alert.details) {
          console.log(`   Details:`, JSON.stringify(alert.details, null, 2));
        }
        console.log('');
      });

      // In production, send notifications
      if (process.env.NODE_ENV === 'production') {
        await sendAlertNotifications(alerts);
      }
    }

    console.log(`\nAlert check completed: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('Error checking alerts:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function sendAlertNotifications(alerts: any[]) {
  // In production, this would:
  // 1. Send emails to compliance team
  // 2. Post to Slack/Teams
  // 3. Create dashboard notifications
  // 4. Log to monitoring system
  
  console.log('📧 Alert notifications would be sent in production');
}

// Run the alert check
checkCriticalAlerts().catch(console.error);