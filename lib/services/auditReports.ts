import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import prisma from '../prisma';
import { FinancialOperation } from "@prisma/client";

export interface AuditReportFilter {
  userId?: string;
  operationType?: FinancialOperation | FinancialOperation[];
  resourceType?: string;
  startDate: Date;
  endDate: Date;
  success?: boolean;
  includeDetails?: boolean;
}

export interface AuditReportSummary {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  operationsByType: Record<string, number>;
  operationsByResource: Record<string, number>;
  uniqueUsers: number;
  totalAmount?: number;
  totalGstAmount?: number;
}

export interface AuditReportEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  operationType: string;
  resourceType: string;
  resourceId?: string;
  ipAddress: string;
  success: boolean;
  errorMessage?: string;
  amount?: number;
  gstAmount?: number;
  changedFields?: string[];
  endpoint?: string;
}

/**
 * Convert UTC date to Australian timezone
 */
function toAustralianTime(date: Date): Date {
  return toZonedTime(date, 'Australia/Sydney');
}

/**
 * Generate audit report for compliance
 */
export async function generateAuditReport(
  filter: AuditReportFilter
): Promise<{
  summary: AuditReportSummary;
  entries: AuditReportEntry[];
  metadata: {
    reportGeneratedAt: string;
    reportPeriod: string;
    timezone: string;
  };
}> {
  // Ensure dates are in Australian timezone
  const startDate = startOfDay(toAustralianTime(filter.startDate));
  const endDate = endOfDay(toAustralianTime(filter.endDate));
  
  // Build where clause
  const where: any = {
    createdAt: {
      gte: startDate,
      lte: endDate
    }
  };
  
  if (filter.userId) {
    where.userId = filter.userId;
  }
  
  if (filter.operationType) {
    if (Array.isArray(filter.operationType)) {
      where.operationType = { in: filter.operationType };
    } else {
      where.operationType = filter.operationType;
    }
  }
  
  if (filter.resourceType) {
    where.resourceType = filter.resourceType;
  }
  
  if (filter.success !== undefined) {
    where.success = filter.success;
  }
  
  // Fetch audit logs with user details
  const logs = await prisma.financialAuditLog.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  // Calculate summary
  const summary: AuditReportSummary = {
    totalOperations: logs.length,
    successfulOperations: logs.filter(log => log.success).length,
    failedOperations: logs.filter(log => !log.success).length,
    operationsByType: {},
    operationsByResource: {},
    uniqueUsers: new Set(logs.map(log => log.userId)).size,
    totalAmount: 0,
    totalGstAmount: 0
  };
  
  // Count operations by type and resource
  logs.forEach(log => {
    // By operation type
    summary.operationsByType[log.operationType] = 
      (summary.operationsByType[log.operationType] || 0) + 1;
    
    // By resource type
    summary.operationsByResource[log.resourceType] = 
      (summary.operationsByResource[log.resourceType] || 0) + 1;
    
    // Sum amounts
    if (log.amount) {
      summary.totalAmount! += Number(log.amount);
    }
    if (log.gstAmount) {
      summary.totalGstAmount! += Number(log.gstAmount);
    }
  });
  
  // Format entries
  const entries: AuditReportEntry[] = logs.map(log => ({
    id: log.id,
    timestamp: format(toAustralianTime(log.createdAt), 'yyyy-MM-dd HH:mm:ss zzz'),
    userId: log.userId,
    userName: log.user?.name,
    userEmail: log.user?.email,
    operationType: log.operationType,
    resourceType: log.resourceType,
    resourceId: log.resourceId || undefined,
    ipAddress: log.ipAddress,
    success: log.success,
    errorMessage: log.errorMessage || undefined,
    amount: log.amount ? Number(log.amount) : undefined,
    gstAmount: log.gstAmount ? Number(log.gstAmount) : undefined,
    changedFields: filter.includeDetails ? log.changedFields : undefined,
    endpoint: filter.includeDetails ? log.endpoint || undefined : undefined
  }));
  
  return {
    summary,
    entries,
    metadata: {
      reportGeneratedAt: format(toAustralianTime(new Date()), 'yyyy-MM-dd HH:mm:ss zzz'),
      reportPeriod: `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`,
      timezone: 'Australia/Sydney'
    }
  };
}

/**
 * Generate monthly compliance report
 */
export async function generateMonthlyComplianceReport(
  year: number,
  month: number
): Promise<any> {
  const startDate = startOfMonth(new Date(year, month - 1));
  const endDate = endOfMonth(new Date(year, month - 1));
  
  const report = await generateAuditReport({
    startDate,
    endDate,
    includeDetails: true
  });
  
  // Add additional compliance-specific information
  const financialOperations = await prisma.financialAuditLog.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate
      },
      amount: {
        not: null
      }
    },
    select: {
      operationType: true,
      amount: true,
      gstAmount: true,
      currency: true,
      taxYear: true
    }
  });
  
  // Group financial operations by tax year
  const operationsByTaxYear: Record<string, {
    totalAmount: number;
    totalGst: number;
    count: number;
  }> = {};
  
  financialOperations.forEach(op => {
    const taxYear = op.taxYear || 'Unknown';
    if (!operationsByTaxYear[taxYear]) {
      operationsByTaxYear[taxYear] = {
        totalAmount: 0,
        totalGst: 0,
        count: 0
      };
    }
    
    operationsByTaxYear[taxYear].totalAmount += Number(op.amount || 0);
    operationsByTaxYear[taxYear].totalGst += Number(op.gstAmount || 0);
    operationsByTaxYear[taxYear].count += 1;
  });
  
  return {
    ...report,
    compliance: {
      operationsByTaxYear,
      totalFinancialOperations: financialOperations.length,
      auditIntegrityCheck: await verifyMonthlyAuditIntegrity(year, month)
    }
  };
}

/**
 * Verify audit integrity for a specific month
 */
async function verifyMonthlyAuditIntegrity(
  year: number,
  month: number
): Promise<{ valid: boolean; issues: string[] }> {
  const { verifyAuditLogIntegrity } = await import('./auditLogger');
  
  const startDate = startOfMonth(new Date(year, month - 1));
  const endDate = endOfMonth(new Date(year, month - 1));
  
  const result = await verifyAuditLogIntegrity(startDate, endDate);
  
  return {
    valid: result.valid,
    issues: result.errors
  };
}

/**
 * Export audit report to CSV format
 */
export function exportAuditReportToCSV(
  entries: AuditReportEntry[]
): string {
  const headers = [
    'Timestamp',
    'User ID',
    'User Name',
    'User Email',
    'Operation Type',
    'Resource Type',
    'Resource ID',
    'IP Address',
    'Success',
    'Error Message',
    'Amount',
    'GST Amount',
    'Changed Fields',
    'Endpoint'
  ];
  
  const rows = entries.map(entry => [
    entry.timestamp,
    entry.userId,
    entry.userName || '',
    entry.userEmail || '',
    entry.operationType,
    entry.resourceType,
    entry.resourceId || '',
    entry.ipAddress,
    entry.success ? 'Yes' : 'No',
    entry.errorMessage || '',
    entry.amount?.toString() || '',
    entry.gstAmount?.toString() || '',
    entry.changedFields?.join('; ') || '',
    entry.endpoint || ''
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
}

/**
 * Generate audit report for specific user
 */
export async function generateUserAuditReport(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<any> {
  const report = await generateAuditReport({
    userId,
    startDate,
    endDate,
    includeDetails: true
  });
  
  // Add user-specific summary
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      abn: true,
      taxResidency: true,
      createdAt: true
    }
  });
  
  return {
    user,
    ...report,
    userSummary: {
      totalOperations: report.summary.totalOperations,
      successRate: report.summary.totalOperations > 0 
        ? (report.summary.successfulOperations / report.summary.totalOperations * 100).toFixed(2) + '%'
        : '0%',
      mostFrequentOperation: Object.entries(report.summary.operationsByType)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None',
      totalFinancialValue: report.summary.totalAmount || 0,
      totalGstCollected: report.summary.totalGstAmount || 0
    }
  };
}