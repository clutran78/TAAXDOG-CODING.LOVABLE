#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { format, subMinutes, subHours, subDays } from 'date-fns';
import * as dotenv from 'dotenv';
import { createHash } from 'crypto';

dotenv.config();

interface SecurityEvent {
  timestamp: Date;
  type:
    | 'authentication'
    | 'authorization'
    | 'suspicious_activity'
    | 'vulnerability'
    | 'configuration';
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  description: string;
  metadata?: any;
  userId?: string;
  ipAddress?: string;
}

interface ThreatIndicator {
  name: string;
  score: number;
  details: string;
}

interface SecurityMetrics {
  timestamp: Date;
  period: '1h' | '24h' | '7d';
  events: {
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  };
  threats: ThreatIndicator[];
  riskScore: number;
  recommendations: string[];
}

class SecurityMonitoringService {
  private prisma: any;
  private events: SecurityEvent[] = [];
  private alertThresholds = {
    failedLogins: { count: 5, window: 300000 }, // 5 attempts in 5 minutes
    suspiciousRequests: { count: 50, window: 60000 }, // 50 requests in 1 minute
    privilegedActions: { count: 10, window: 3600000 }, // 10 actions in 1 hour
    dataExports: { count: 3, window: 3600000 }, // 3 exports in 1 hour
  };

  async startMonitoring(): Promise<void> {
    console.log('🛡️  Security Monitoring Service Started');
    console.log(`Monitoring interval: Real-time with 1-minute aggregation\n`);

    try {
      // Import Prisma dynamically
      const { prisma } = await import('../../lib/db/unifiedMonitoredPrisma');
      this.prisma = prisma;

      // Run initial security scan
      await this.performSecurityScan();

      // Set up continuous monitoring
      setInterval(() => this.performSecurityScan(), 60000); // Every minute

      // Set up alert checking
      setInterval(() => this.checkAlerts(), 30000); // Every 30 seconds

      // Generate metrics every hour
      setInterval(() => this.generateMetrics('1h'), 3600000);
    } catch (error) {
      console.error('Security monitoring error:', error);
    }
  }

  private async performSecurityScan(): Promise<void> {
    console.log(`[${format(new Date(), 'HH:mm:ss')}] Running security scan...`);

    // Monitor authentication events
    await this.monitorAuthentication();

    // Monitor authorization failures
    await this.monitorAuthorization();

    // Detect suspicious activities
    await this.detectSuspiciousActivities();

    // Check for vulnerabilities
    await this.checkVulnerabilities();

    // Monitor configuration changes
    await this.monitorConfigurationChanges();

    // Process collected events
    await this.processEvents();
  }

  private async monitorAuthentication(): Promise<void> {
    try {
      // Check for failed login attempts
      const failedLogins = await this.prisma.$queryRaw`
        SELECT 
          user_id,
          ip_address,
          COUNT(*) as attempts,
          MAX(created_at) as last_attempt
        FROM audit_logs
        WHERE action = 'login.failed'
        AND created_at > NOW() - INTERVAL '5 minutes'
        GROUP BY user_id, ip_address
        HAVING COUNT(*) >= 3
      `;

      for (const record of failedLogins) {
        this.addEvent({
          timestamp: new Date(),
          type: 'authentication',
          severity: record.attempts >= 5 ? 'high' : 'medium',
          source: 'Login Monitor',
          description: `Multiple failed login attempts: ${record.attempts} attempts from ${record.ip_address}`,
          metadata: { attempts: record.attempts },
          userId: record.user_id,
          ipAddress: record.ip_address,
        });
      }

      // Check for successful logins from new locations
      const newLocationLogins = await this.prisma.$queryRaw`
        SELECT DISTINCT
          al1.user_id,
          al1.ip_address,
          al1.details->>'country' as country,
          al1.created_at
        FROM audit_logs al1
        WHERE al1.action = 'login.success'
        AND al1.created_at > NOW() - INTERVAL '1 hour'
        AND NOT EXISTS (
          SELECT 1 FROM audit_logs al2
          WHERE al2.user_id = al1.user_id
          AND al2.action = 'login.success'
          AND al2.ip_address = al1.ip_address
          AND al2.created_at < al1.created_at - INTERVAL '1 day'
        )
      `;

      for (const login of newLocationLogins) {
        this.addEvent({
          timestamp: new Date(login.created_at),
          type: 'authentication',
          severity: 'medium',
          source: 'Geographic Monitor',
          description: `Login from new location: ${login.country || login.ip_address}`,
          metadata: { country: login.country },
          userId: login.user_id,
          ipAddress: login.ip_address,
        });
      }

      // Check for concurrent sessions
      const concurrentSessions = await this.prisma.$queryRaw`
        SELECT 
          user_id,
          COUNT(DISTINCT session_id) as session_count
        FROM sessions
        WHERE expires > NOW()
        GROUP BY user_id
        HAVING COUNT(DISTINCT session_id) > 3
      `;

      for (const user of concurrentSessions) {
        this.addEvent({
          timestamp: new Date(),
          type: 'authentication',
          severity: 'low',
          source: 'Session Monitor',
          description: `User has ${user.session_count} concurrent sessions`,
          metadata: { sessionCount: user.session_count },
          userId: user.user_id,
        });
      }
    } catch (error) {
      console.error('Authentication monitoring error:', error);
    }
  }

  private async monitorAuthorization(): Promise<void> {
    try {
      // Check for unauthorized access attempts
      const unauthorizedAccess = await this.prisma.$queryRaw`
        SELECT 
          user_id,
          action,
          details->>'resource' as resource,
          COUNT(*) as attempts
        FROM audit_logs
        WHERE action LIKE 'access.denied%'
        AND created_at > NOW() - INTERVAL '1 hour'
        GROUP BY user_id, action, details->>'resource'
        HAVING COUNT(*) >= 3
      `;

      for (const access of unauthorizedAccess) {
        this.addEvent({
          timestamp: new Date(),
          type: 'authorization',
          severity: access.attempts >= 10 ? 'high' : 'medium',
          source: 'Authorization Monitor',
          description: `Repeated unauthorized access attempts to ${access.resource}`,
          metadata: {
            resource: access.resource,
            attempts: access.attempts,
            action: access.action,
          },
          userId: access.user_id,
        });
      }

      // Check for privilege escalation attempts
      const privilegeChanges = await this.prisma.$queryRaw`
        SELECT 
          al.*,
          u.role as current_role
        FROM audit_logs al
        JOIN users u ON al.user_id = u.id
        WHERE al.action = 'user.role.update'
        AND al.created_at > NOW() - INTERVAL '24 hours'
        AND al.details->>'new_role' = 'ADMIN'
      `;

      for (const change of privilegeChanges) {
        this.addEvent({
          timestamp: new Date(change.created_at),
          type: 'authorization',
          severity: 'critical',
          source: 'Privilege Monitor',
          description: 'Privilege escalation detected - user promoted to ADMIN',
          metadata: {
            previousRole: change.details.old_role,
            newRole: change.details.new_role,
          },
          userId: change.user_id,
        });
      }
    } catch (error) {
      console.error('Authorization monitoring error:', error);
    }
  }

  private async detectSuspiciousActivities(): Promise<void> {
    try {
      // Detect rapid API requests (potential DoS)
      const rapidRequests = await this.prisma.$queryRaw`
        SELECT 
          ip_address,
          COUNT(*) as request_count,
          COUNT(DISTINCT action) as unique_actions
        FROM audit_logs
        WHERE created_at > NOW() - INTERVAL '1 minute'
        GROUP BY ip_address
        HAVING COUNT(*) > 100
      `;

      for (const activity of rapidRequests) {
        this.addEvent({
          timestamp: new Date(),
          type: 'suspicious_activity',
          severity: activity.request_count > 500 ? 'critical' : 'high',
          source: 'Rate Monitor',
          description: `Abnormally high request rate: ${activity.request_count} requests/minute`,
          metadata: {
            requestCount: activity.request_count,
            uniqueActions: activity.unique_actions,
          },
          ipAddress: activity.ip_address,
        });
      }

      // Detect data exfiltration attempts
      const dataExports = await this.prisma.$queryRaw`
        SELECT 
          user_id,
          COUNT(*) as export_count,
          SUM((details->>'record_count')::int) as total_records
        FROM audit_logs
        WHERE action IN ('data.export', 'transactions.export', 'users.export')
        AND created_at > NOW() - INTERVAL '1 hour'
        GROUP BY user_id
        HAVING COUNT(*) > 3 OR SUM((details->>'record_count')::int) > 10000
      `;

      for (const exporter of dataExports) {
        this.addEvent({
          timestamp: new Date(),
          type: 'suspicious_activity',
          severity: exporter.total_records > 50000 ? 'critical' : 'high',
          source: 'Data Monitor',
          description: `Potential data exfiltration: ${exporter.export_count} exports, ${exporter.total_records} records`,
          metadata: {
            exportCount: exporter.export_count,
            totalRecords: exporter.total_records,
          },
          userId: exporter.user_id,
        });
      }

      // Detect SQL injection attempts
      const sqlInjectionPatterns = [
        "' OR '1'='1",
        'DROP TABLE',
        'UNION SELECT',
        '<script>',
        'javascript:',
        '../..',
      ];

      const suspiciousQueries = await this.prisma.$queryRaw`
        SELECT 
          user_id,
          ip_address,
          action,
          details
        FROM audit_logs
        WHERE created_at > NOW() - INTERVAL '1 hour'
        AND (
          details::text ILIKE '%'' OR ''%'
          OR details::text ILIKE '%DROP TABLE%'
          OR details::text ILIKE '%UNION SELECT%'
          OR details::text ILIKE '%<script>%'
          OR details::text ILIKE '%../%'
        )
      `;

      for (const query of suspiciousQueries) {
        this.addEvent({
          timestamp: new Date(),
          type: 'suspicious_activity',
          severity: 'critical',
          source: 'Injection Monitor',
          description: 'Potential injection attack detected',
          metadata: {
            action: query.action,
            pattern: 'SQL/XSS injection attempt',
          },
          userId: query.user_id,
          ipAddress: query.ip_address,
        });
      }

      // Detect account takeover patterns
      const accountTakeover = await this.prisma.$queryRaw`
        SELECT 
          u.id as user_id,
          u.email,
          COUNT(DISTINCT al.ip_address) as ip_count,
          COUNT(DISTINCT al.details->>'country') as country_count
        FROM users u
        JOIN audit_logs al ON u.id = al.user_id
        WHERE al.action = 'login.success'
        AND al.created_at > NOW() - INTERVAL '1 hour'
        GROUP BY u.id, u.email
        HAVING COUNT(DISTINCT al.ip_address) > 3
        OR COUNT(DISTINCT al.details->>'country') > 2
      `;

      for (const account of accountTakeover) {
        this.addEvent({
          timestamp: new Date(),
          type: 'suspicious_activity',
          severity: 'high',
          source: 'Account Monitor',
          description: `Potential account takeover: ${account.ip_count} IPs, ${account.country_count} countries`,
          metadata: {
            email: account.email,
            ipCount: account.ip_count,
            countryCount: account.country_count,
          },
          userId: account.user_id,
        });
      }
    } catch (error) {
      console.error('Suspicious activity detection error:', error);
    }
  }

  private async checkVulnerabilities(): Promise<void> {
    try {
      // Check for outdated sessions
      const outdatedSessions = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM sessions
        WHERE created_at < NOW() - INTERVAL '30 days'
        AND expires > NOW()
      `;

      if (outdatedSessions[0].count > 0) {
        this.addEvent({
          timestamp: new Date(),
          type: 'vulnerability',
          severity: 'medium',
          source: 'Session Scanner',
          description: `${outdatedSessions[0].count} sessions older than 30 days still active`,
          metadata: { count: outdatedSessions[0].count },
        });
      }

      // Check for weak passwords (based on last password change)
      const weakPasswords = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM users
        WHERE password_changed_at < NOW() - INTERVAL '90 days'
        OR password_changed_at IS NULL
      `;

      if (weakPasswords[0].count > 0) {
        this.addEvent({
          timestamp: new Date(),
          type: 'vulnerability',
          severity: 'medium',
          source: 'Password Scanner',
          description: `${weakPasswords[0].count} users haven't changed passwords in 90+ days`,
          metadata: { count: weakPasswords[0].count },
        });
      }

      // Check for users without 2FA
      const no2FA = await this.prisma.$queryRaw`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN role IN ('ADMIN', 'ACCOUNTANT') THEN 1 END) as privileged
        FROM users
        WHERE two_factor_enabled = false
      `;

      if (no2FA[0].privileged > 0) {
        this.addEvent({
          timestamp: new Date(),
          type: 'vulnerability',
          severity: 'high',
          source: '2FA Scanner',
          description: `${no2FA[0].privileged} privileged users without 2FA enabled`,
          metadata: {
            total: no2FA[0].total,
            privileged: no2FA[0].privileged,
          },
        });
      }

      // Check for unencrypted sensitive data
      const unencrypted = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM users
        WHERE two_factor_secret IS NOT NULL
        AND two_factor_secret NOT LIKE 'encrypted:%'
      `;

      if (unencrypted[0].count > 0) {
        this.addEvent({
          timestamp: new Date(),
          type: 'vulnerability',
          severity: 'critical',
          source: 'Encryption Scanner',
          description: `${unencrypted[0].count} unencrypted sensitive records found`,
          metadata: { count: unencrypted[0].count },
        });
      }
    } catch (error) {
      console.error('Vulnerability check error:', error);
    }
  }

  private async monitorConfigurationChanges(): Promise<void> {
    try {
      // Monitor critical configuration changes
      const configChanges = await this.prisma.$queryRaw`
        SELECT *
        FROM audit_logs
        WHERE action IN (
          'config.update',
          'security.update',
          'permission.update',
          'integration.update'
        )
        AND created_at > NOW() - INTERVAL '1 hour'
      `;

      for (const change of configChanges) {
        this.addEvent({
          timestamp: new Date(change.created_at),
          type: 'configuration',
          severity: change.action.includes('security') ? 'high' : 'medium',
          source: 'Configuration Monitor',
          description: `Configuration change: ${change.action}`,
          metadata: {
            action: change.action,
            details: change.details,
          },
          userId: change.user_id,
        });
      }

      // Check for database schema changes
      const schemaChanges = await this.prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          tableowner
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE 'new_%'
        OR tablename LIKE 'temp_%'
      `;

      for (const table of schemaChanges) {
        this.addEvent({
          timestamp: new Date(),
          type: 'configuration',
          severity: 'high',
          source: 'Schema Monitor',
          description: `Suspicious table detected: ${table.tablename}`,
          metadata: {
            schema: table.schemaname,
            table: table.tablename,
            owner: table.tableowner,
          },
        });
      }
    } catch (error) {
      console.error('Configuration monitoring error:', error);
    }
  }

  private addEvent(event: SecurityEvent): void {
    this.events.push(event);
  }

  private async processEvents(): Promise<void> {
    if (this.events.length === 0) return;

    console.log(
      `[${format(new Date(), 'HH:mm:ss')}] Processing ${this.events.length} security events`,
    );

    // Group events by severity
    const eventsBySeverity = this.events.reduce(
      (acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Log summary
    console.log('Event Summary:', eventsBySeverity);

    // Save events to log
    await this.saveEvents();

    // Send alerts for critical events
    const criticalEvents = this.events.filter((e) => e.severity === 'critical');
    if (criticalEvents.length > 0) {
      await this.sendAlerts(criticalEvents);
    }

    // Clear processed events
    this.events = [];
  }

  private async saveEvents(): Promise<void> {
    const logPath = path.join(process.cwd(), 'logs', 'security-events.jsonl');

    const logEntries =
      this.events
        .map((event) =>
          JSON.stringify({
            ...event,
            timestamp: event.timestamp.toISOString(),
          }),
        )
        .join('\n') + '\n';

    await fs.promises.appendFile(logPath, logEntries);
  }

  private async checkAlerts(): Promise<void> {
    // This method would check for patterns that require immediate alerts
    // For example: multiple critical events, sustained attacks, etc.
  }

  private async sendAlerts(events: SecurityEvent[]): Promise<void> {
    console.log('\n🚨 SECURITY ALERTS:');

    for (const event of events) {
      console.log(`\n[${event.severity.toUpperCase()}] ${event.description}`);
      console.log(`  Source: ${event.source}`);
      console.log(`  Time: ${format(event.timestamp, 'yyyy-MM-dd HH:mm:ss')}`);
      if (event.userId) console.log(`  User: ${event.userId}`);
      if (event.ipAddress) console.log(`  IP: ${event.ipAddress}`);
      if (event.metadata) {
        console.log(`  Details: ${JSON.stringify(event.metadata)}`);
      }
    }

    // In production, this would:
    // - Send email alerts
    // - Post to Slack/Teams
    // - Create incidents in PagerDuty
    // - Update security dashboard
  }

  async generateMetrics(period: '1h' | '24h' | '7d' = '1h'): Promise<SecurityMetrics> {
    const metrics: SecurityMetrics = {
      timestamp: new Date(),
      period,
      events: {
        total: 0,
        bySeverity: {},
        byType: {},
      },
      threats: [],
      riskScore: 0,
      recommendations: [],
    };

    try {
      // Calculate time range
      const startTime =
        period === '1h'
          ? subHours(new Date(), 1)
          : period === '24h'
            ? subDays(new Date(), 1)
            : subDays(new Date(), 7);

      // Get events from database
      const events = await this.prisma.$queryRaw`
        SELECT 
          action,
          COUNT(*) as count,
          COUNT(CASE WHEN details->>'severity' = 'critical' THEN 1 END) as critical,
          COUNT(CASE WHEN details->>'severity' = 'high' THEN 1 END) as high,
          COUNT(CASE WHEN details->>'severity' = 'medium' THEN 1 END) as medium,
          COUNT(CASE WHEN details->>'severity' = 'low' THEN 1 END) as low
        FROM audit_logs
        WHERE created_at > ${startTime}
        AND action LIKE 'security.%'
        GROUP BY action
      `;

      // Calculate metrics
      metrics.events.total = events.reduce((sum: number, e: any) => sum + parseInt(e.count), 0);
      metrics.events.bySeverity = {
        critical: events.reduce((sum: number, e: any) => sum + parseInt(e.critical), 0),
        high: events.reduce((sum: number, e: any) => sum + parseInt(e.high), 0),
        medium: events.reduce((sum: number, e: any) => sum + parseInt(e.medium), 0),
        low: events.reduce((sum: number, e: any) => sum + parseInt(e.low), 0),
      };

      // Identify threats
      await this.identifyThreats(metrics, startTime);

      // Calculate risk score
      metrics.riskScore = this.calculateRiskScore(metrics);

      // Generate recommendations
      this.generateRecommendations(metrics);

      // Save metrics
      await this.saveMetrics(metrics);

      return metrics;
    } catch (error) {
      console.error('Metrics generation error:', error);
      return metrics;
    }
  }

  private async identifyThreats(metrics: SecurityMetrics, startTime: Date): Promise<void> {
    try {
      // Check for brute force attacks
      const bruteForce = await this.prisma.$queryRaw`
        SELECT COUNT(DISTINCT ip_address) as sources
        FROM audit_logs
        WHERE action = 'login.failed'
        AND created_at > ${startTime}
        HAVING COUNT(*) > 20
      `;

      if (bruteForce[0]?.sources > 0) {
        metrics.threats.push({
          name: 'Brute Force Attack',
          score: Math.min(bruteForce[0].sources * 20, 100),
          details: `Detected from ${bruteForce[0].sources} sources`,
        });
      }

      // Check for data exfiltration
      const dataExfil = await this.prisma.$queryRaw`
        SELECT SUM((details->>'record_count')::int) as total_records
        FROM audit_logs
        WHERE action LIKE '%.export'
        AND created_at > ${startTime}
      `;

      if (dataExfil[0]?.total_records > 10000) {
        metrics.threats.push({
          name: 'Potential Data Exfiltration',
          score: Math.min(dataExfil[0].total_records / 1000, 100),
          details: `${dataExfil[0].total_records} records exported`,
        });
      }
    } catch (error) {
      console.error('Threat identification error:', error);
    }
  }

  private calculateRiskScore(metrics: SecurityMetrics): number {
    let score = 0;

    // Base score on event severity
    score += metrics.events.bySeverity.critical * 25;
    score += metrics.events.bySeverity.high * 15;
    score += metrics.events.bySeverity.medium * 5;
    score += metrics.events.bySeverity.low * 1;

    // Add threat scores
    score += metrics.threats.reduce((sum, threat) => sum + threat.score, 0);

    // Normalize to 0-100
    return Math.min(Math.round(score / 10), 100);
  }

  private generateRecommendations(metrics: SecurityMetrics): void {
    if (metrics.riskScore > 80) {
      metrics.recommendations.push('🚨 CRITICAL: Immediate security review required');
    }

    if (metrics.events.bySeverity.critical > 0) {
      metrics.recommendations.push('Address critical security events immediately');
    }

    if (metrics.threats.some((t) => t.name === 'Brute Force Attack')) {
      metrics.recommendations.push('Enable account lockout and rate limiting');
    }

    if (metrics.threats.some((t) => t.name === 'Potential Data Exfiltration')) {
      metrics.recommendations.push('Review data export permissions and audit logs');
    }

    if (metrics.events.total > 100) {
      metrics.recommendations.push('High security event volume - investigate anomalies');
    }
  }

  private async saveMetrics(metrics: SecurityMetrics): Promise<void> {
    const metricsPath = path.join(process.cwd(), 'logs', 'security-metrics.jsonl');

    await fs.promises.appendFile(
      metricsPath,
      JSON.stringify({
        ...metrics,
        timestamp: metrics.timestamp.toISOString(),
      }) + '\n',
    );
  }

  async generateDashboard(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('🛡️  SECURITY MONITORING DASHBOARD');
    console.log('='.repeat(60));
    console.log(`Last Update: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`);

    // Get metrics for different periods
    const hourlyMetrics = await this.generateMetrics('1h');
    const dailyMetrics = await this.generateMetrics('24h');

    // Display risk score
    const riskEmoji =
      hourlyMetrics.riskScore > 80 ? '🔴' : hourlyMetrics.riskScore > 50 ? '🟡' : '🟢';

    console.log(`\n${riskEmoji} Current Risk Score: ${hourlyMetrics.riskScore}/100`);

    // Display event summary
    console.log('\n📊 Security Events (Last Hour):');
    console.log(`  Total: ${hourlyMetrics.events.total}`);
    console.log(`  Critical: ${hourlyMetrics.events.bySeverity.critical || 0}`);
    console.log(`  High: ${hourlyMetrics.events.bySeverity.high || 0}`);
    console.log(`  Medium: ${hourlyMetrics.events.bySeverity.medium || 0}`);
    console.log(`  Low: ${hourlyMetrics.events.bySeverity.low || 0}`);

    // Display active threats
    if (hourlyMetrics.threats.length > 0) {
      console.log('\n⚠️  Active Threats:');
      hourlyMetrics.threats.forEach((threat) => {
        console.log(`  - ${threat.name} (Score: ${threat.score})`);
        console.log(`    ${threat.details}`);
      });
    } else {
      console.log('\n✅ No active threats detected');
    }

    // Display trend
    console.log('\n📈 24-Hour Trend:');
    console.log(`  Events: ${dailyMetrics.events.total}`);
    console.log(`  Average Risk: ${dailyMetrics.riskScore}`);

    // Display recommendations
    if (hourlyMetrics.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      hourlyMetrics.recommendations.forEach((rec) => {
        console.log(`  - ${rec}`);
      });
    }

    // Recent critical events
    try {
      const criticalEvents = await this.prisma.$queryRaw`
        SELECT 
          action,
          user_id,
          ip_address,
          created_at,
          details
        FROM audit_logs
        WHERE details->>'severity' = 'critical'
        AND created_at > NOW() - INTERVAL '1 hour'
        ORDER BY created_at DESC
        LIMIT 5
      `;

      if (criticalEvents.length > 0) {
        console.log('\n🚨 Recent Critical Events:');
        criticalEvents.forEach((event: any) => {
          console.log(`  - ${format(new Date(event.created_at), 'HH:mm:ss')} - ${event.action}`);
          console.log(
            `    User: ${event.user_id || 'Unknown'}, IP: ${event.ip_address || 'Unknown'}`,
          );
        });
      }
    } catch (error) {
      // Ignore errors in dashboard display
    }

    console.log('\n' + '='.repeat(60));
  }
}

// Incident Response Procedures
class IncidentResponseService {
  async handleIncident(event: SecurityEvent): Promise<void> {
    console.log('\n🚨 INCIDENT RESPONSE ACTIVATED');
    console.log(`Incident Type: ${event.type}`);
    console.log(`Severity: ${event.severity}`);

    switch (event.type) {
      case 'authentication':
        await this.handleAuthenticationIncident(event);
        break;
      case 'suspicious_activity':
        await this.handleSuspiciousActivity(event);
        break;
      case 'vulnerability':
        await this.handleVulnerability(event);
        break;
      default:
        await this.handleGenericIncident(event);
    }
  }

  private async handleAuthenticationIncident(event: SecurityEvent): Promise<void> {
    const procedures = [
      '1. Lock affected user account',
      '2. Invalidate all active sessions',
      '3. Force password reset',
      '4. Review access logs for compromised period',
      '5. Notify user of security incident',
    ];

    console.log('\nAuthentication Incident Response:');
    procedures.forEach((p) => console.log(`  ${p}`));

    // In production, execute these procedures automatically
  }

  private async handleSuspiciousActivity(event: SecurityEvent): Promise<void> {
    const procedures = [
      '1. Block source IP address',
      '2. Increase monitoring for affected resources',
      '3. Review all recent activities from source',
      '4. Check for data exfiltration',
      '5. Preserve evidence for investigation',
    ];

    console.log('\nSuspicious Activity Response:');
    procedures.forEach((p) => console.log(`  ${p}`));
  }

  private async handleVulnerability(event: SecurityEvent): Promise<void> {
    const procedures = [
      '1. Assess vulnerability impact',
      '2. Apply immediate mitigation',
      '3. Plan permanent fix',
      '4. Test fix in staging',
      '5. Deploy to production with monitoring',
    ];

    console.log('\nVulnerability Response:');
    procedures.forEach((p) => console.log(`  ${p}`));
  }

  private async handleGenericIncident(event: SecurityEvent): Promise<void> {
    const procedures = [
      '1. Document incident details',
      '2. Assess impact and scope',
      '3. Contain the incident',
      '4. Eradicate the threat',
      '5. Recover normal operations',
      '6. Post-incident review',
    ];

    console.log('\nGeneric Incident Response:');
    procedures.forEach((p) => console.log(`  ${p}`));
  }
}

// Main execution
async function main() {
  const monitor = new SecurityMonitoringService();

  if (process.argv[2] === '--dashboard') {
    await monitor.generateDashboard();
  } else if (process.argv[2] === '--scan') {
    await monitor.performSecurityScan();
  } else {
    // Start continuous monitoring
    await monitor.startMonitoring();

    console.log('\nPress Ctrl+C to stop monitoring');

    // Keep process running
    process.on('SIGINT', () => {
      console.log('\n\nStopping security monitoring...');
      process.exit(0);
    });
  }
}

if (require.main === module) {
  main();
}

export { SecurityMonitoringService, IncidentResponseService, SecurityEvent, SecurityMetrics };
