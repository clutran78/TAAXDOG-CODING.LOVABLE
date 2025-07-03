/**
 * Security Monitoring Utility
 * Tracks security events, anomalies, and potential threats
 * Critical for financial application security compliance
 */

export enum SecurityEventType {
  LOGIN_ATTEMPT = 'login_attempt',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  PASSWORD_CHANGE = 'password_change',
  ACCOUNT_LOCKED = 'account_locked',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_TOKEN = 'invalid_token',
  CSRF_ATTEMPT = 'csrf_attempt',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  FILE_UPLOAD_VIOLATION = 'file_upload_violation',
  FINANCIAL_ANOMALY = 'financial_anomaly',
  API_ABUSE = 'api_abuse',
  SESSION_HIJACK_ATTEMPT = 'session_hijack_attempt'
}

export enum SecurityThreatLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Security event interface for structured logging
 */
export interface SecurityEvent {
  id: string;
  timestamp: number;
  type: SecurityEventType;
  threatLevel: SecurityThreatLevel;
  userId?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  description: string;
  metadata?: Record<string, any>;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

/**
 * Anomaly detection result interface
 */
export interface AnomalyDetection {
  isAnomaly: boolean;
  score: number; // 0-100, higher = more suspicious
  reasons: string[];
  recommendations: string[];
}

/**
 * Security monitoring service class
 */
class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private maxEvents: number = 10000; // Keep last 10k events in memory
  private alertThresholds: Record<SecurityEventType, number> = {
    [SecurityEventType.LOGIN_FAILURE]: 5,
    [SecurityEventType.RATE_LIMIT_EXCEEDED]: 3,
    [SecurityEventType.UNAUTHORIZED_ACCESS]: 1,
    [SecurityEventType.DATA_BREACH_ATTEMPT]: 1,
    [SecurityEventType.CSRF_ATTEMPT]: 1,
    [SecurityEventType.SQL_INJECTION_ATTEMPT]: 1,
    [SecurityEventType.XSS_ATTEMPT]: 1,
    [SecurityEventType.SESSION_HIJACK_ATTEMPT]: 1,
    [SecurityEventType.LOGIN_ATTEMPT]: 20,
    [SecurityEventType.LOGIN_SUCCESS]: 100,
    [SecurityEventType.PASSWORD_CHANGE]: 5,
    [SecurityEventType.ACCOUNT_LOCKED]: 1,
    [SecurityEventType.SUSPICIOUS_ACTIVITY]: 3,
    [SecurityEventType.INVALID_TOKEN]: 10,
    [SecurityEventType.FILE_UPLOAD_VIOLATION]: 5,
    [SecurityEventType.FINANCIAL_ANOMALY]: 1,
    [SecurityEventType.API_ABUSE]: 5
  };

  /**
   * Logs a security event with automatic threat assessment
   */
  public logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): SecurityEvent {
    const securityEvent: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      ...event
    };

    // Add to events collection
    this.events.push(securityEvent);

    // Maintain maximum event limit
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Automatic threat detection
    this.detectThreats(securityEvent);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('🔒 SECURITY EVENT:', {
        type: event.type,
        threatLevel: event.threatLevel,
        ip: event.ipAddress,
        user: event.userEmail || 'anonymous',
        description: event.description
      });
    }

    // In production, this would send to security logging service
    this.sendToSecurityService(securityEvent);

    return securityEvent;
  }

  /**
   * Detects potential security threats based on event patterns
   */
  private detectThreats(event: SecurityEvent): void {
    const recentEvents = this.getRecentEvents(15 * 60 * 1000); // Last 15 minutes
    const ipEvents = recentEvents.filter(e => e.ipAddress === event.ipAddress);
    const userEvents = event.userId ? recentEvents.filter(e => e.userId === event.userId) : [];

    // Check for brute force attacks
    if (event.type === SecurityEventType.LOGIN_FAILURE) {
      const failureCount = ipEvents.filter(e => e.type === SecurityEventType.LOGIN_FAILURE).length;
      if (failureCount >= this.alertThresholds[SecurityEventType.LOGIN_FAILURE]) {
        this.triggerAlert({
          type: 'BRUTE_FORCE_ATTACK',
          message: `Potential brute force attack from IP: ${event.ipAddress}`,
          threatLevel: SecurityThreatLevel.HIGH,
          relatedEvents: [event.id],
          metadata: { failureCount, ipAddress: event.ipAddress }
        });
      }
    }

    // Check for account takeover attempts
    if (event.userId && userEvents.length > 0) {
      const uniqueIPs = new Set(userEvents.map(e => e.ipAddress));
      if (uniqueIPs.size > 3) {
        this.triggerAlert({
          type: 'ACCOUNT_TAKEOVER_ATTEMPT',
          message: `Multiple IP addresses accessing account: ${event.userEmail}`,
          threatLevel: SecurityThreatLevel.HIGH,
          relatedEvents: [event.id],
          metadata: { uniqueIPs: Array.from(uniqueIPs), userId: event.userId }
        });
      }
    }

    // Check for API abuse
    const apiCallCount = ipEvents.length;
    if (apiCallCount > 100) { // More than 100 requests in 15 minutes
      this.triggerAlert({
        type: 'API_ABUSE',
        message: `Excessive API calls from IP: ${event.ipAddress}`,
        threatLevel: SecurityThreatLevel.MEDIUM,
        relatedEvents: [event.id],
        metadata: { requestCount: apiCallCount, ipAddress: event.ipAddress }
      });
    }
  }

  /**
   * Analyzes user behavior for anomalies
   */
  public analyzeUserBehavior(userId: string, currentActivity: any): AnomalyDetection {
    const userEvents = this.events.filter(e => e.userId === userId);
    const recentEvents = userEvents.filter(e => Date.now() - e.timestamp < 30 * 24 * 60 * 60 * 1000); // Last 30 days

    const anomalies: string[] = [];
    let anomalyScore = 0;

    // Analyze login patterns
    const loginEvents = recentEvents.filter(e => e.type === SecurityEventType.LOGIN_SUCCESS);
    const loginIPs = new Set(loginEvents.map(e => e.ipAddress));
    
    if (currentActivity.ipAddress && !loginIPs.has(currentActivity.ipAddress)) {
      anomalies.push('Login from new IP address');
      anomalyScore += 30;
    }

    // Analyze login times
    const loginHours = loginEvents.map(e => new Date(e.timestamp).getHours());
    const avgLoginHour = loginHours.reduce((a, b) => a + b, 0) / loginHours.length;
    const currentHour = new Date().getHours();
    
    if (Math.abs(currentHour - avgLoginHour) > 6) {
      anomalies.push('Login at unusual time');
      anomalyScore += 20;
    }

    // Analyze financial transaction patterns
    const financialEvents = recentEvents.filter(e => e.type === SecurityEventType.FINANCIAL_ANOMALY);
    if (currentActivity.transactionAmount) {
      const avgAmount = this.calculateAverageTransactionAmount(userId);
      if (currentActivity.transactionAmount > avgAmount * 5) {
        anomalies.push('Unusually large transaction amount');
        anomalyScore += 40;
      }
    }

    // Check for rapid successive activities
    const lastEvent = recentEvents[recentEvents.length - 1];
    if (lastEvent && Date.now() - lastEvent.timestamp < 1000) {
      anomalies.push('Rapid successive activities detected');
      anomalyScore += 25;
    }

    const isAnomaly = anomalyScore > 50;
    const recommendations = this.generateSecurityRecommendations(anomalies, anomalyScore);

    return {
      isAnomaly,
      score: Math.min(anomalyScore, 100),
      reasons: anomalies,
      recommendations
    };
  }

  /**
   * Validates request origin for CSRF protection
   */
  public validateRequestOrigin(origin: string, referer: string): boolean {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
    
    // Check origin header
    if (origin && allowedOrigins.includes(origin)) {
      return true;
    }

    // Check referer header as fallback
    if (referer) {
      const refererOrigin = new URL(referer).origin;
      return allowedOrigins.includes(refererOrigin);
    }

    return false;
  }

  /**
   * Monitors for SQL injection patterns
   */
  public detectSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /('|(\\')|(;)|(\\;))/i,
      /(union\s+select)/i,
      /(drop\s+table)/i,
      /(insert\s+into)/i,
      /(delete\s+from)/i,
      /(update\s+\w+\s+set)/i,
      /(or\s+1\s*=\s*1)/i,
      /(and\s+1\s*=\s*1)/i,
      /(\*|%|\?)/,
      /(script|javascript|vbscript)/i
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Monitors for XSS patterns
   */
  public detectXSS(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      /<img[^>]+src[^>]*>/gi,
      /<object\b/gi,
      /<embed\b/gi,
      /<applet\b/gi,
      /<meta\b/gi,
      /<link\b/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Gets recent security events within time window
   */
  private getRecentEvents(timeWindowMs: number): SecurityEvent[] {
    const cutoffTime = Date.now() - timeWindowMs;
    return this.events.filter(event => event.timestamp > cutoffTime);
  }

  /**
   * Calculates average transaction amount for user
   */
  private calculateAverageTransactionAmount(userId: string): number {
    const userFinancialEvents = this.events.filter(
      e => e.userId === userId && e.metadata?.transactionAmount
    );
    
    if (userFinancialEvents.length === 0) return 0;
    
    const totalAmount = userFinancialEvents.reduce(
      (sum, event) => sum + (event.metadata?.transactionAmount || 0), 0
    );
    
    return totalAmount / userFinancialEvents.length;
  }

  /**
   * Generates security recommendations based on detected anomalies
   */
  private generateSecurityRecommendations(anomalies: string[], score: number): string[] {
    const recommendations: string[] = [];

    if (anomalies.includes('Login from new IP address')) {
      recommendations.push('Consider enabling two-factor authentication');
      recommendations.push('Verify this login attempt via email');
    }

    if (anomalies.includes('Login at unusual time')) {
      recommendations.push('Review account activity for any unauthorized access');
    }

    if (anomalies.includes('Unusually large transaction amount')) {
      recommendations.push('Require additional authentication for large transactions');
      recommendations.push('Contact user to verify transaction intent');
    }

    if (score > 70) {
      recommendations.push('Temporarily restrict account access');
      recommendations.push('Require password reset');
      recommendations.push('Enable enhanced monitoring');
    }

    return recommendations;
  }

  /**
   * Triggers security alert for immediate attention
   */
  private triggerAlert(alert: {
    type: string;
    message: string;
    threatLevel: SecurityThreatLevel;
    relatedEvents: string[];
    metadata?: Record<string, any>;
  }): void {
    // In production, this would integrate with alerting systems
    console.error('🚨 SECURITY ALERT:', alert);

    // Log critical alert as security event
    this.logSecurityEvent({
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      threatLevel: alert.threatLevel,
      ipAddress: 'system',
      userAgent: 'security-monitor',
      description: `ALERT: ${alert.message}`,
      metadata: alert.metadata
    });
  }

  /**
   * Sends security event to external monitoring service
   */
  private sendToSecurityService(event: SecurityEvent): void {
    // In production, integrate with services like:
    // - Splunk, DataDog, New Relic for monitoring
    // - PagerDuty for critical alerts
    // - Slack/Teams for team notifications
    
    if (process.env.ENABLE_SECURITY_ALERTS === 'true') {
      // Implementation would depend on chosen service
      console.log('📤 Sending to security service:', event.type);
    }
  }

  /**
   * Generates unique event ID
   */
  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gets security metrics for dashboard
   */
  public getSecurityMetrics(): {
    totalEvents: number;
    criticalEvents: number;
    highThreatEvents: number;
    recentAnomalies: number;
    topThreatTypes: Array<{ type: string; count: number }>;
  } {
    const recentEvents = this.getRecentEvents(24 * 60 * 60 * 1000); // Last 24 hours
    
    const criticalEvents = recentEvents.filter(e => e.threatLevel === SecurityThreatLevel.CRITICAL).length;
    const highThreatEvents = recentEvents.filter(e => e.threatLevel === SecurityThreatLevel.HIGH).length;
    
    // Count threat types
    const threatCounts = new Map<string, number>();
    recentEvents.forEach(event => {
      const count = threatCounts.get(event.type) || 0;
      threatCounts.set(event.type, count + 1);
    });
    
    const topThreatTypes = Array.from(threatCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEvents: recentEvents.length,
      criticalEvents,
      highThreatEvents,
      recentAnomalies: recentEvents.filter(e => e.type === SecurityEventType.SUSPICIOUS_ACTIVITY).length,
      topThreatTypes
    };
  }
}

// Export singleton instance
export const securityMonitor = new SecurityMonitor();

// Export utility functions
export const logSecurityEvent = (event: Omit<SecurityEvent, 'id' | 'timestamp'>) => 
  securityMonitor.logSecurityEvent(event);

export const analyzeUserBehavior = (userId: string, activity: any) => 
  securityMonitor.analyzeUserBehavior(userId, activity);

export const validateRequestOrigin = (origin: string, referer: string) => 
  securityMonitor.validateRequestOrigin(origin, referer);

export const detectSQLInjection = (input: string) => 
  securityMonitor.detectSQLInjection(input);

export const detectXSS = (input: string) => 
  securityMonitor.detectXSS(input);

export const getSecurityMetrics = () => 
  securityMonitor.getSecurityMetrics(); 