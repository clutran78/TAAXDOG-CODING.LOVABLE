import { PrismaClient, IncidentType, IncidentSeverity, IncidentStatus } from '../../../generated/prisma';
import { Decimal } from '../../../generated/prisma/runtime/library';

const prisma = new PrismaClient();

export interface IncidentReport {
  incidentType: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  affectedSystems: string[];
  dataCompromised: boolean;
  immediateActions?: any;
}

export interface DataResidencyCheck {
  compliant: boolean;
  issues: string[];
  recommendations: string[];
}

export class APRAComplianceService {
  private static readonly INCIDENT_REPORT_HOURS = 72; // 72 hours to report to APRA
  private static readonly ALLOWED_REGIONS = ['au-syd', 'australia-southeast1', 'sydney'];
  
  /**
   * Create and track an incident report
   */
  static async createIncidentReport(
    report: IncidentReport,
    reportedBy: string
  ): Promise<{ success: boolean; incidentId?: string }> {
    try {
      const incident = await prisma.aPRAIncidentReport.create({
        data: {
          incidentType: report.incidentType,
          severity: report.severity,
          title: report.title,
          description: report.description,
          affectedSystems: report.affectedSystems,
          dataCompromised: report.dataCompromised,
          immediateActions: report.immediateActions,
          detectedAt: new Date(),
          status: IncidentStatus.OPEN,
        },
      });

      // If critical, trigger immediate notification
      if (report.severity === IncidentSeverity.CRITICAL) {
        await this.triggerCriticalIncidentProtocol(incident.id);
      }

      // Set reminder for regulatory reporting
      await this.scheduleRegulatoryReporting(incident.id);

      return { success: true, incidentId: incident.id };
    } catch (error) {
      console.error('Error creating incident report:', error);
      return { success: false };
    }
  }

  /**
   * Update incident status
   */
  static async updateIncidentStatus(
    incidentId: string,
    status: IncidentStatus,
    updates: {
      rootCause?: string;
      remediation?: any;
      preventiveMeasures?: any;
      affectedUsers?: number;
      financialImpact?: number;
    }
  ): Promise<void> {
    const updateData: any = { status };

    if (updates.rootCause) updateData.rootCause = updates.rootCause;
    if (updates.remediation) updateData.remediation = updates.remediation;
    if (updates.preventiveMeasures) updateData.preventiveMeasures = updates.preventiveMeasures;
    if (updates.affectedUsers !== undefined) updateData.affectedUsers = updates.affectedUsers;
    if (updates.financialImpact !== undefined) {
      updateData.financialImpact = new Decimal(updates.financialImpact);
    }

    if (status === IncidentStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
    }

    await prisma.aPRAIncidentReport.update({
      where: { id: incidentId },
      data: updateData,
    });
  }

  /**
   * Submit report to APRA
   */
  static async submitToAPRA(incidentId: string): Promise<{ success: boolean; reference?: string }> {
    try {
      const incident = await prisma.aPRAIncidentReport.findUnique({
        where: { id: incidentId },
      });

      if (!incident) {
        throw new Error('Incident not found');
      }

      // Check if within reporting timeframe
      const hoursSinceDetection = (Date.now() - incident.detectedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceDetection > this.INCIDENT_REPORT_HOURS) {
        console.warn(`Incident ${incidentId} reported late: ${hoursSinceDetection} hours`);
      }

      // In production, this would integrate with APRA's reporting API
      const apraReference = `APRA-${Date.now()}-${incident.id.substring(0, 8)}`;

      await prisma.aPRAIncidentReport.update({
        where: { id: incidentId },
        data: {
          reportedToAPRA: true,
          apraReference,
          reportedAt: new Date(),
        },
      });

      // Also report to OAIC if data was compromised
      if (incident.dataCompromised) {
        await this.reportToOAIC(incidentId);
      }

      return { success: true, reference: apraReference };
    } catch (error) {
      console.error('Error submitting to APRA:', error);
      return { success: false };
    }
  }

  /**
   * Report data breach to OAIC
   */
  private static async reportToOAIC(incidentId: string): Promise<void> {
    const oaicReference = `OAIC-${Date.now()}-${incidentId.substring(0, 8)}`;

    await prisma.aPRAIncidentReport.update({
      where: { id: incidentId },
      data: {
        reportedToOAIC: true,
        oaicReference,
      },
    });
  }

  /**
   * Check data residency compliance
   */
  static async checkDataResidency(): Promise<DataResidencyCheck> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check database location
    const dbConfig = await this.checkDatabaseLocation();
    if (!dbConfig.compliant) {
      issues.push('Database not in Australian region');
      recommendations.push('Migrate database to Sydney region');
    }

    // Check file storage location
    const storageConfig = await this.checkStorageLocation();
    if (!storageConfig.compliant) {
      issues.push('File storage not in Australian region');
      recommendations.push('Configure S3 bucket in ap-southeast-2 (Sydney)');
    }

    // Check backup location
    const backupConfig = await this.checkBackupLocation();
    if (!backupConfig.compliant) {
      issues.push('Backups stored outside Australia');
      recommendations.push('Configure backup replication to Australian region only');
    }

    return {
      compliant: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Verify business continuity plan
   */
  static async verifyBusinessContinuity(): Promise<{
    lastBackup: Date | null;
    backupFrequency: string;
    recoveryTimeObjective: number;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check last backup
    const lastBackup = await this.getLastBackupTime();
    const hoursSinceBackup = lastBackup ? (Date.now() - lastBackup.getTime()) / (1000 * 60 * 60) : Infinity;

    if (hoursSinceBackup > 24) {
      issues.push('Backup older than 24 hours');
    }

    // Get configuration
    const config = await prisma.complianceConfiguration.findFirst({
      where: { configType: 'APRA_COMPLIANCE' },
    });

    const backupFrequency = config?.backupFrequency || 'DAILY';
    const recoveryTimeObjective = 4; // 4 hours RTO

    return {
      lastBackup,
      backupFrequency,
      recoveryTimeObjective,
      issues,
    };
  }

  /**
   * Generate compliance report
   */
  static async generateComplianceReport(startDate: Date, endDate: Date): Promise<any> {
    // Get all incidents in period
    const incidents = await prisma.aPRAIncidentReport.findMany({
      where: {
        detectedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Calculate metrics
    const metrics = {
      totalIncidents: incidents.length,
      criticalIncidents: incidents.filter(i => i.severity === IncidentSeverity.CRITICAL).length,
      dataBreaches: incidents.filter(i => i.dataCompromised).length,
      averageResolutionTime: this.calculateAverageResolutionTime(incidents),
      reportingCompliance: this.calculateReportingCompliance(incidents),
    };

    // Get data residency status
    const dataResidency = await this.checkDataResidency();

    // Get business continuity status
    const businessContinuity = await this.verifyBusinessContinuity();

    return {
      reportPeriod: { startDate, endDate },
      metrics,
      dataResidency,
      businessContinuity,
      incidents: incidents.map(i => ({
        id: i.id,
        type: i.incidentType,
        severity: i.severity,
        detectedAt: i.detectedAt,
        resolvedAt: i.resolvedAt,
        reportedToAPRA: i.reportedToAPRA,
        reportedToOAIC: i.reportedToOAIC,
      })),
      generatedAt: new Date(),
    };
  }

  /**
   * Trigger critical incident protocol
   */
  private static async triggerCriticalIncidentProtocol(incidentId: string): Promise<void> {
    // In production, this would:
    // 1. Send immediate notifications to key personnel
    // 2. Activate incident response team
    // 3. Begin automated containment procedures
    // 4. Start audit trail preservation
    
    console.log(`CRITICAL INCIDENT ALERT: ${incidentId}`);
    
    // Log the critical incident activation
    await prisma.aPRAIncidentReport.update({
      where: { id: incidentId },
      data: {
        bcpActivated: true,
      },
    });
  }

  /**
   * Schedule regulatory reporting reminder
   */
  private static async scheduleRegulatoryReporting(incidentId: string): Promise<void> {
    // In production, this would schedule a job to remind about APRA reporting
    const reportDeadline = new Date();
    reportDeadline.setHours(reportDeadline.getHours() + this.INCIDENT_REPORT_HOURS - 24); // 24hr warning
    
    console.log(`Regulatory reporting deadline for ${incidentId}: ${reportDeadline}`);
  }

  /**
   * Check database location
   */
  private static async checkDatabaseLocation(): Promise<{ compliant: boolean }> {
    // Check DATABASE_URL for region indicators
    const dbUrl = process.env.DATABASE_URL || '';
    const isCompliant = this.ALLOWED_REGIONS.some(region => 
      dbUrl.toLowerCase().includes(region)
    );

    return { compliant: isCompliant };
  }

  /**
   * Check storage location
   */
  private static async checkStorageLocation(): Promise<{ compliant: boolean }> {
    // Check S3 bucket configuration
    const s3Region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '';
    const isCompliant = s3Region === 'ap-southeast-2';

    return { compliant: isCompliant };
  }

  /**
   * Check backup location
   */
  private static async checkBackupLocation(): Promise<{ compliant: boolean }> {
    // Check backup configuration
    const backupRegion = process.env.BACKUP_REGION || '';
    const isCompliant = this.ALLOWED_REGIONS.some(region => 
      backupRegion.toLowerCase().includes(region)
    );

    return { compliant: isCompliant };
  }

  /**
   * Get last backup time
   */
  private static async getLastBackupTime(): Promise<Date | null> {
    // In production, this would query backup system
    // For now, return current time minus 12 hours
    const lastBackup = new Date();
    lastBackup.setHours(lastBackup.getHours() - 12);
    return lastBackup;
  }

  /**
   * Calculate average resolution time
   */
  private static calculateAverageResolutionTime(incidents: any[]): number {
    const resolvedIncidents = incidents.filter(i => i.resolvedAt);
    if (resolvedIncidents.length === 0) return 0;

    const totalTime = resolvedIncidents.reduce((sum, incident) => {
      const resolutionTime = incident.resolvedAt.getTime() - incident.detectedAt.getTime();
      return sum + resolutionTime;
    }, 0);

    return totalTime / resolvedIncidents.length / (1000 * 60 * 60); // Convert to hours
  }

  /**
   * Calculate reporting compliance rate
   */
  private static calculateReportingCompliance(incidents: any[]): number {
    if (incidents.length === 0) return 100;

    const compliantReports = incidents.filter(incident => {
      if (!incident.reportedAt) return false;
      
      const reportTime = incident.reportedAt.getTime() - incident.detectedAt.getTime();
      const reportHours = reportTime / (1000 * 60 * 60);
      
      return reportHours <= this.INCIDENT_REPORT_HOURS;
    });

    return (compliantReports.length / incidents.length) * 100;
  }

  /**
   * Monitor system health
   */
  static async monitorSystemHealth(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      issues.push('Database connectivity issue');
    }

    // Check critical services
    const criticalServices = ['authentication', 'payment', 'data-backup'];
    for (const service of criticalServices) {
      const isHealthy = await this.checkServiceHealth(service);
      if (!isHealthy) {
        issues.push(`Service ${service} is unhealthy`);
      }
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  /**
   * Check individual service health
   */
  private static async checkServiceHealth(service: string): Promise<boolean> {
    // In production, this would check actual service health endpoints
    return true;
  }
}