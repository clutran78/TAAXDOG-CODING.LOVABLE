#!/usr/bin/env ts-node

import { PrismaClient, IncidentStatus } from '@prisma/client';
import { APRAComplianceService } from '@/lib/services/compliance';
import { differenceInHours } from 'date-fns';

const prisma = new PrismaClient();

/**
 * Automated APRA compliance monitoring
 * Checks data residency, incident reporting deadlines, and system health
 */
async function runAPRAMonitoring() {
  console.log('Starting APRA compliance monitoring...');
  
  try {
    // 1. Check data residency compliance
    console.log('\n🌏 Data Residency Check:');
    const residencyCheck = await APRAComplianceService.checkDataResidency();
    
    if (residencyCheck.compliant) {
      console.log('✓ All data is stored in Australian regions');
    } else {
      console.log('❌ Data residency issues detected:');
      residencyCheck.issues.forEach(issue => console.log(`  - ${issue}`));
      console.log('\nRecommendations:');
      residencyCheck.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }

    // 2. Check business continuity
    console.log('\n💾 Business Continuity Check:');
    const bcpCheck = await APRAComplianceService.verifyBusinessContinuity();
    
    console.log(`- Last backup: ${bcpCheck.lastBackup?.toISOString() || 'Unknown'}`);
    console.log(`- Backup frequency: ${bcpCheck.backupFrequency}`);
    console.log(`- Recovery Time Objective: ${bcpCheck.recoveryTimeObjective} hours`);
    
    if (bcpCheck.issues.length > 0) {
      console.log('⚠️  Issues:');
      bcpCheck.issues.forEach(issue => console.log(`  - ${issue}`));
    }

    // 3. Check system health
    console.log('\n🏥 System Health Check:');
    const healthCheck = await APRAComplianceService.monitorSystemHealth();
    
    if (healthCheck.healthy) {
      console.log('✓ All systems operational');
    } else {
      console.log('❌ System health issues:');
      healthCheck.issues.forEach(issue => console.log(`  - ${issue}`));
    }

    // 4. Check unreported incidents
    const unreportedIncidents = await prisma.aPRAIncidentReport.findMany({
      where: {
        reportedToAPRA: false,
        status: {
          not: IncidentStatus.OPEN,
        },
      },
    });

    if (unreportedIncidents.length > 0) {
      console.log(`\n🚨 ${unreportedIncidents.length} incidents pending APRA reporting:`);
      
      unreportedIncidents.forEach(incident => {
        const hoursSinceDetection = differenceInHours(new Date(), incident.detectedAt);
        const hoursRemaining = 72 - hoursSinceDetection;
        
        console.log(`  - Incident: ${incident.id}`);
        console.log(`    Type: ${incident.incidentType} | Severity: ${incident.severity}`);
        console.log(`    Time remaining to report: ${hoursRemaining > 0 ? `${hoursRemaining} hours` : 'OVERDUE'}`);
        
        if (hoursRemaining <= 0) {
          console.log('    ⚠️  IMMEDIATE ACTION REQUIRED - Report to APRA');
        }
      });
    }

    // 5. Check incidents requiring OAIC notification
    const dataBreaches = await prisma.aPRAIncidentReport.findMany({
      where: {
        dataCompromised: true,
        reportedToOAIC: false,
        status: {
          not: IncidentStatus.OPEN,
        },
      },
    });

    if (dataBreaches.length > 0) {
      console.log(`\n🔐 ${dataBreaches.length} data breaches pending OAIC notification`);
    }

    // 6. Generate monthly summary
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyIncidents = await prisma.aPRAIncidentReport.count({
      where: {
        detectedAt: {
          gte: startOfMonth,
        },
      },
    });

    const criticalIncidents = await prisma.aPRAIncidentReport.count({
      where: {
        detectedAt: {
          gte: startOfMonth,
        },
        severity: 'CRITICAL',
      },
    });

    console.log('\n📊 APRA Compliance Summary:');
    console.log(`- Incidents this month: ${monthlyIncidents}`);
    console.log(`- Critical incidents: ${criticalIncidents}`);
    console.log(`- Data residency compliant: ${residencyCheck.compliant ? 'Yes' : 'No'}`);
    console.log(`- System health: ${healthCheck.healthy ? 'Healthy' : 'Issues detected'}`);
    console.log(`- Monitoring completion: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('APRA monitoring error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the monitoring
runAPRAMonitoring().catch(console.error);