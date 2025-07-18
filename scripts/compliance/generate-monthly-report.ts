#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';
import { 
  APRAComplianceService,
  GSTComplianceService,
  PrivacyComplianceService,
  AMLMonitoringService
} from '@/lib/services/compliance';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

/**
 * Generate comprehensive monthly compliance report
 * Runs on the 1st of each month for the previous month
 */
async function generateMonthlyComplianceReport() {
  console.log('Generating monthly compliance report...\n');
  
  try {
    // Get previous month's date range
    const lastMonth = subMonths(new Date(), 1);
    const startDate = startOfMonth(lastMonth);
    const endDate = endOfMonth(lastMonth);
    const monthName = format(lastMonth, 'MMMM yyyy');

    console.log(`Report Period: ${monthName}`);
    console.log(`Date Range: ${startDate.toDateString()} - ${endDate.toDateString()}\n`);

    const report = {
      reportTitle: `Australian Financial Compliance Report - ${monthName}`,
      reportPeriod: { startDate, endDate },
      generatedAt: new Date(),
      sections: {} as any,
    };

    // 1. AML/CTF Compliance Section
    console.log('📊 Analyzing AML/CTF compliance...');
    const amlData = await generateAMLSection(startDate, endDate);
    report.sections.amlCompliance = amlData;

    // 2. Privacy Act Compliance Section
    console.log('🔐 Analyzing Privacy Act compliance...');
    const privacyData = await generatePrivacySection(startDate, endDate);
    report.sections.privacyCompliance = privacyData;

    // 3. APRA Compliance Section
    console.log('🏛️ Analyzing APRA compliance...');
    const apraData = await APRAComplianceService.generateComplianceReport(startDate, endDate);
    report.sections.apraCompliance = apraData;

    // 4. GST Compliance Section
    console.log('💰 Analyzing GST compliance...');
    const gstData = await generateGSTSection(startDate, endDate);
    report.sections.gstCompliance = gstData;

    // 5. Executive Summary
    report.sections.executiveSummary = generateExecutiveSummary(report.sections);

    // Save report to file
    const reportDir = path.join(process.cwd(), 'compliance-reports');
    await fs.mkdir(reportDir, { recursive: true });
    
    const filename = `compliance-report-${format(lastMonth, 'yyyy-MM')}.json`;
    const filepath = path.join(reportDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Report saved to: ${filepath}`);

    // Display summary
    displayReportSummary(report);

  } catch (error) {
    console.error('Error generating compliance report:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function generateAMLSection(startDate: Date, endDate: Date) {
  const monitoring = await prisma.aMLTransactionMonitoring.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const totalAmount = monitoring.reduce((sum, m) => sum + m.amount.toNumber(), 0);
  const averageRiskScore = monitoring.reduce((sum, m) => sum + m.riskScore.toNumber(), 0) / monitoring.length || 0;

  return {
    summary: {
      totalTransactionsMonitored: monitoring.length,
      totalAmountMonitored: totalAmount,
      averageRiskScore: averageRiskScore.toFixed(3),
      highRiskTransactions: monitoring.filter(m => m.riskScore.toNumber() >= 0.75).length,
      mediumRiskTransactions: monitoring.filter(m => m.riskScore.toNumber() >= 0.5 && m.riskScore.toNumber() < 0.75).length,
      lowRiskTransactions: monitoring.filter(m => m.riskScore.toNumber() < 0.5).length,
    },
    alerts: {
      totalAlerts: monitoring.filter(m => m.requiresReview).length,
      reviewed: monitoring.filter(m => m.reviewedAt !== null).length,
      pending: monitoring.filter(m => m.requiresReview && !m.reviewedAt).length,
      falsePositives: monitoring.filter(m => m.falsePositive).length,
    },
    reporting: {
      submittedToAUSTRAC: monitoring.filter(m => m.reportedToAUSTRAC).length,
      reportReferences: monitoring
        .filter(m => m.reportReference)
        .map(m => ({ date: m.reportedAt, reference: m.reportReference })),
    },
    riskDistribution: {
      THRESHOLD_EXCEEDED: monitoring.filter(m => m.monitoringType === 'THRESHOLD_EXCEEDED').length,
      VELOCITY_CHECK: monitoring.filter(m => m.monitoringType === 'VELOCITY_CHECK').length,
      PATTERN_DETECTION: monitoring.filter(m => m.monitoringType === 'PATTERN_DETECTION').length,
      SUSPICIOUS_ACTIVITY: monitoring.filter(m => m.monitoringType === 'SUSPICIOUS_ACTIVITY').length,
    },
  };
}

async function generatePrivacySection(startDate: Date, endDate: Date) {
  const consents = await prisma.privacyConsent.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const dataRequests = await prisma.dataAccessRequest.findMany({
    where: {
      requestDate: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  return {
    consents: {
      total: consents.length,
      granted: consents.filter(c => c.consentStatus === 'GRANTED').length,
      withdrawn: consents.filter(c => c.consentStatus === 'WITHDRAWN').length,
      expired: consents.filter(c => c.consentStatus === 'EXPIRED').length,
      byType: {
        PRIVACY_POLICY: consents.filter(c => c.consentType === 'PRIVACY_POLICY').length,
        TERMS_OF_SERVICE: consents.filter(c => c.consentType === 'TERMS_OF_SERVICE').length,
        MARKETING: consents.filter(c => c.consentType === 'MARKETING_COMMUNICATIONS').length,
        DATA_SHARING: consents.filter(c => c.consentType === 'DATA_SHARING').length,
      },
    },
    dataRequests: {
      total: dataRequests.length,
      byType: {
        ACCESS: dataRequests.filter(r => r.requestType === 'ACCESS_REQUEST').length,
        DELETION: dataRequests.filter(r => r.requestType === 'DELETION_REQUEST').length,
        PORTABILITY: dataRequests.filter(r => r.requestType === 'PORTABILITY_REQUEST').length,
        CORRECTION: dataRequests.filter(r => r.requestType === 'CORRECTION_REQUEST').length,
      },
      byStatus: {
        PENDING: dataRequests.filter(r => r.requestStatus === 'PENDING').length,
        PROCESSING: dataRequests.filter(r => r.requestStatus === 'PROCESSING').length,
        COMPLETED: dataRequests.filter(r => r.requestStatus === 'COMPLETED').length,
        REJECTED: dataRequests.filter(r => r.requestStatus === 'REJECTED').length,
      },
      averageProcessingDays: calculateAverageProcessingTime(dataRequests),
      overdueRequests: dataRequests.filter(r => 
        r.dueDate < new Date() && r.requestStatus !== 'COMPLETED'
      ).length,
    },
  };
}

async function generateGSTSection(startDate: Date, endDate: Date) {
  const gstTransactions = await prisma.gSTTransactionDetail.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const totalGST = gstTransactions.reduce((sum, t) => sum + t.gstAmount.toNumber(), 0);
  const totalBase = gstTransactions.reduce((sum, t) => sum + t.baseAmount.toNumber(), 0);

  return {
    summary: {
      totalTransactions: gstTransactions.length,
      totalBaseAmount: totalBase,
      totalGSTCollected: totalGST,
      effectiveGSTRate: totalBase > 0 ? (totalGST / totalBase * 100).toFixed(2) + '%' : '0%',
    },
    byTreatment: {
      TAXABLE_SUPPLY: gstTransactions.filter(t => t.gstTreatment === 'TAXABLE_SUPPLY').length,
      GST_FREE: gstTransactions.filter(t => t.gstTreatment === 'GST_FREE').length,
      INPUT_TAXED: gstTransactions.filter(t => t.gstTreatment === 'INPUT_TAXED').length,
      OUT_OF_SCOPE: gstTransactions.filter(t => t.gstTreatment === 'OUT_OF_SCOPE').length,
    },
    validation: {
      validated: gstTransactions.filter(t => t.validated).length,
      unvalidated: gstTransactions.filter(t => !t.validated).length,
      withErrors: gstTransactions.filter(t => t.validationErrors.length > 0).length,
    },
    basReporting: {
      reportedInBAS: gstTransactions.filter(t => t.reportedInBAS).length,
      pendingBAS: gstTransactions.filter(t => !t.reportedInBAS).length,
    },
  };
}

function calculateAverageProcessingTime(requests: any[]): number {
  const completedRequests = requests.filter(r => r.completedAt);
  if (completedRequests.length === 0) return 0;

  const totalDays = completedRequests.reduce((sum, r) => {
    const days = (r.completedAt.getTime() - r.requestDate.getTime()) / (1000 * 60 * 60 * 24);
    return sum + days;
  }, 0);

  return Math.round(totalDays / completedRequests.length);
}

function generateExecutiveSummary(sections: any) {
  return {
    overallCompliance: {
      amlRiskLevel: sections.amlCompliance.summary.averageRiskScore < 0.5 ? 'LOW' : 'MEDIUM',
      privacyCompliance: sections.privacyCompliance.dataRequests.overdueRequests === 0 ? 'COMPLIANT' : 'ISSUES',
      apraCompliance: sections.apraCompliance.dataResidency.compliant ? 'COMPLIANT' : 'NON-COMPLIANT',
      gstCompliance: sections.gstCompliance.validation.withErrors === 0 ? 'COMPLIANT' : 'ISSUES',
    },
    keyMetrics: {
      totalAMLAlerts: sections.amlCompliance.alerts.totalAlerts,
      pendingPrivacyRequests: sections.privacyCompliance.dataRequests.byStatus.PENDING,
      criticalIncidents: sections.apraCompliance.metrics.criticalIncidents,
      gstCollected: sections.gstCompliance.summary.totalGSTCollected,
    },
    actionRequired: generateActionItems(sections),
  };
}

function generateActionItems(sections: any) {
  const actions = [];

  if (sections.amlCompliance.alerts.pending > 0) {
    actions.push(`Review ${sections.amlCompliance.alerts.pending} pending AML alerts`);
  }

  if (sections.privacyCompliance.dataRequests.overdueRequests > 0) {
    actions.push(`Process ${sections.privacyCompliance.dataRequests.overdueRequests} overdue privacy requests`);
  }

  if (!sections.apraCompliance.dataResidency.compliant) {
    actions.push('Address data residency compliance issues');
  }

  if (sections.gstCompliance.validation.withErrors > 0) {
    actions.push(`Fix GST validation errors in ${sections.gstCompliance.validation.withErrors} transactions`);
  }

  return actions;
}

function displayReportSummary(report: any) {
  console.log('\n📋 COMPLIANCE REPORT SUMMARY');
  console.log('============================');
  
  const summary = report.sections.executiveSummary;
  
  console.log('\nOverall Compliance Status:');
  Object.entries(summary.overallCompliance).forEach(([key, value]) => {
    const status = value === 'COMPLIANT' || value === 'LOW' ? '✅' : '⚠️';
    console.log(`  ${status} ${key}: ${value}`);
  });

  console.log('\nKey Metrics:');
  Object.entries(summary.keyMetrics).forEach(([key, value]) => {
    console.log(`  - ${key}: ${value}`);
  });

  if (summary.actionRequired.length > 0) {
    console.log('\n🚨 Actions Required:');
    summary.actionRequired.forEach((action: string) => {
      console.log(`  - ${action}`);
    });
  }
}

// Run the report generation
generateMonthlyComplianceReport().catch(console.error);