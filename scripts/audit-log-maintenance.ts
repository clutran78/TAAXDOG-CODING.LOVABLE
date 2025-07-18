#!/usr/bin/env tsx
/**
 * Audit Log Maintenance Script
 * 
 * This script should be run daily via cron to:
 * 1. Clean up audit logs older than 7 years
 * 2. Verify audit log integrity
 * 3. Generate daily integrity reports
 * 
 * Example cron entry (runs daily at 2 AM Sydney time):
 * 0 2 * * * cd /path/to/project && npm run audit:maintenance
 */

import { PrismaClient } from '@prisma/client';
import { cleanupOldAuditLogs, verifyAuditLogIntegrity } from '../lib/services/auditLogger';
import { generateAuditReport } from '../lib/services/auditReports';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const prisma = new PrismaClient();

interface MaintenanceResult {
  timestamp: string;
  cleanupResult: {
    success: boolean;
    deletedCount?: number;
    error?: string;
  };
  integrityResult: {
    success: boolean;
    valid?: boolean;
    errors?: string[];
    error?: string;
  };
  dailyReport: {
    success: boolean;
    totalOperations?: number;
    error?: string;
  };
}

async function runMaintenanceTasks(): Promise<MaintenanceResult> {
  const result: MaintenanceResult = {
    timestamp: new Date().toISOString(),
    cleanupResult: { success: false },
    integrityResult: { success: false },
    dailyReport: { success: false }
  };
  
  console.log('Starting audit log maintenance tasks...');
  
  // Task 1: Cleanup old audit logs
  try {
    console.log('Running audit log cleanup...');
    const deletedCount = await cleanupOldAuditLogs();
    result.cleanupResult = {
      success: true,
      deletedCount
    };
    console.log(`✓ Cleanup completed: ${deletedCount} logs archived and deleted`);
  } catch (error: any) {
    console.error('✗ Cleanup failed:', error.message);
    result.cleanupResult = {
      success: false,
      error: error.message
    };
  }
  
  // Task 2: Verify audit log integrity for the last 24 hours
  try {
    console.log('Verifying audit log integrity...');
    const yesterday = subDays(new Date(), 1);
    const today = new Date();
    
    const integrityCheck = await verifyAuditLogIntegrity(
      startOfDay(yesterday),
      endOfDay(today)
    );
    
    result.integrityResult = {
      success: true,
      valid: integrityCheck.valid,
      errors: integrityCheck.errors
    };
    
    if (integrityCheck.valid) {
      console.log('✓ Integrity check passed');
    } else {
      console.error('✗ Integrity check failed:', integrityCheck.errors);
      // In production, this would trigger an alert
    }
  } catch (error: any) {
    console.error('✗ Integrity verification failed:', error.message);
    result.integrityResult = {
      success: false,
      error: error.message
    };
  }
  
  // Task 3: Generate daily summary report
  try {
    console.log('Generating daily audit report...');
    const yesterday = subDays(new Date(), 1);
    
    const report = await generateAuditReport({
      startDate: startOfDay(yesterday),
      endDate: endOfDay(yesterday),
      includeDetails: false
    });
    
    result.dailyReport = {
      success: true,
      totalOperations: report.summary.totalOperations
    };
    
    console.log(`✓ Daily report generated: ${report.summary.totalOperations} operations logged`);
    
    // Log summary statistics
    console.log('\nDaily Summary:');
    console.log(`- Total Operations: ${report.summary.totalOperations}`);
    console.log(`- Successful: ${report.summary.successfulOperations}`);
    console.log(`- Failed: ${report.summary.failedOperations}`);
    console.log(`- Unique Users: ${report.summary.uniqueUsers}`);
    
    if (report.summary.totalAmount && report.summary.totalAmount > 0) {
      console.log(`- Total Financial Value: $${report.summary.totalAmount.toFixed(2)} AUD`);
      console.log(`- Total GST: $${report.summary.totalGstAmount?.toFixed(2) || '0.00'} AUD`);
    }
    
    // Check for anomalies
    if (report.summary.failedOperations > report.summary.successfulOperations * 0.1) {
      console.warn('⚠ Warning: High failure rate detected (>10%)');
    }
    
  } catch (error: any) {
    console.error('✗ Daily report generation failed:', error.message);
    result.dailyReport = {
      success: false,
      error: error.message
    };
  }
  
  // Store maintenance result in database (optional)
  try {
    await prisma.$executeRaw`
      INSERT INTO system_maintenance_logs (task_type, result, created_at)
      VALUES ('audit_log_maintenance', ${JSON.stringify(result)}::jsonb, NOW())
    `;
  } catch (error) {
    // Table might not exist, which is fine
  }
  
  return result;
}

// Run the maintenance tasks
runMaintenanceTasks()
  .then((result) => {
    console.log('\nMaintenance tasks completed');
    
    // Exit with error code if any task failed
    const allSuccess = result.cleanupResult.success && 
                      result.integrityResult.success && 
                      result.dailyReport.success;
    
    process.exit(allSuccess ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error during maintenance:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });