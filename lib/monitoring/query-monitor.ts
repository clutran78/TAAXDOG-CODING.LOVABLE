import { logger } from '../utils/logger';

interface QueryMetrics {
  query: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  lastExecuted: Date;
}

interface QueryAlert {
  type: 'slow_query' | 'frequent_query' | 'error_rate';
  query: string;
  details: any;
  timestamp: Date;
}

export class QueryMonitor {
  private static instance: QueryMonitor;
  private queryMetrics: Map<string, QueryMetrics> = new Map();
  private alerts: QueryAlert[] = [];
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private readonly FREQUENT_QUERY_THRESHOLD = 100; // per minute
  private readonly ERROR_RATE_THRESHOLD = 0.05; // 5% error rate

  private constructor() {
    // Reset metrics every hour
    setInterval(() => this.resetMetrics(), 60 * 60 * 1000);
  }

  public static getInstance(): QueryMonitor {
    if (!QueryMonitor.instance) {
      QueryMonitor.instance = new QueryMonitor();
    }
    return QueryMonitor.instance;
  }

  /**
   * Record a query execution
   */
  public recordQuery(query: string, duration: number, error?: Error) {
    const sanitizedQuery = this.sanitizeQuery(query);
    const metrics = this.queryMetrics.get(sanitizedQuery) || {
      query: sanitizedQuery,
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      maxDuration: 0,
      minDuration: Infinity,
      lastExecuted: new Date(),
    };

    metrics.count++;
    metrics.totalDuration += duration;
    metrics.avgDuration = metrics.totalDuration / metrics.count;
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    metrics.lastExecuted = new Date();

    this.queryMetrics.set(sanitizedQuery, metrics);

    // Check for alerts
    this.checkForAlerts(sanitizedQuery, metrics, duration, error);
  }

  /**
   * Sanitize query to remove sensitive data
   */
  private sanitizeQuery(query: string): string {
    return query
      .replace(/\$\d+ = '.*?'/g, '$X = ?')
      .replace(/\b\d{4,}\b/g, 'XXXX') // Hide long numbers
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID') // Hide UUIDs
      .trim();
  }

  /**
   * Check for alert conditions
   */
  private checkForAlerts(query: string, metrics: QueryMetrics, duration: number, error?: Error) {
    // Slow query alert
    if (duration > this.SLOW_QUERY_THRESHOLD) {
      this.addAlert({
        type: 'slow_query',
        query,
        details: {
          duration,
          threshold: this.SLOW_QUERY_THRESHOLD,
          avgDuration: metrics.avgDuration,
        },
        timestamp: new Date(),
      });

      logger.warn('Slow Query Alert', {
        query,
        duration,
        avgDuration: metrics.avgDuration,
      });
    }

    // Frequent query alert (check if query rate is too high)
    const queryRate = this.getQueryRate(metrics);
    if (queryRate > this.FREQUENT_QUERY_THRESHOLD) {
      this.addAlert({
        type: 'frequent_query',
        query,
        details: {
          rate: queryRate,
          threshold: this.FREQUENT_QUERY_THRESHOLD,
          count: metrics.count,
        },
        timestamp: new Date(),
      });

      logger.warn('Frequent Query Alert', {
        query,
        rate: queryRate,
        count: metrics.count,
      });
    }
  }

  /**
   * Calculate query rate per minute
   */
  private getQueryRate(metrics: QueryMetrics): number {
    const now = Date.now();
    const firstExecution = now - metrics.count * metrics.avgDuration;
    const timeElapsed = now - firstExecution;
    const minutes = timeElapsed / (60 * 1000);
    return metrics.count / Math.max(1, minutes);
  }

  /**
   * Add alert and maintain alert history
   */
  private addAlert(alert: QueryAlert) {
    this.alerts.push(alert);
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
  }

  /**
   * Get query metrics summary
   */
  public getMetricsSummary() {
    const queries = Array.from(this.queryMetrics.values());

    return {
      totalQueries: queries.reduce((sum, m) => sum + m.count, 0),
      uniqueQueries: queries.length,
      slowQueries: queries.filter((m) => m.avgDuration > this.SLOW_QUERY_THRESHOLD).length,
      topSlowQueries: queries
        .sort((a, b) => b.avgDuration - a.avgDuration)
        .slice(0, 10)
        .map((m) => ({
          query: m.query,
          avgDuration: Math.round(m.avgDuration),
          count: m.count,
        })),
      topFrequentQueries: queries
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((m) => ({
          query: m.query,
          count: m.count,
          avgDuration: Math.round(m.avgDuration),
        })),
      recentAlerts: this.alerts.slice(-20),
    };
  }

  /**
   * Export metrics for external monitoring
   */
  public exportMetrics() {
    const metrics = this.getMetricsSummary();

    // Log to monitoring service
    logger.info('Query Metrics Export', {
      timestamp: new Date().toISOString(),
      metrics: {
        totalQueries: metrics.totalQueries,
        uniqueQueries: metrics.uniqueQueries,
        slowQueries: metrics.slowQueries,
      },
    });

    // Could also send to external monitoring service like DataDog, New Relic, etc.
    if (process.env.MONITORING_ENDPOINT) {
      // Send metrics to external service
      this.sendToMonitoringService(metrics);
    }

    return metrics;
  }

  /**
   * Send metrics to external monitoring service
   */
  private async sendToMonitoringService(metrics: any) {
    try {
      // Example: Send to monitoring endpoint
      const response = await fetch(process.env.MONITORING_ENDPOINT!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.MONITORING_API_KEY}`,
        },
        body: JSON.stringify({
          service: 'taaxdog',
          type: 'database_metrics',
          timestamp: new Date().toISOString(),
          metrics,
        }),
      });

      if (!response.ok) {
        logger.error('Failed to send metrics to monitoring service', {
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (error) {
      logger.error('Error sending metrics to monitoring service', { error });
    }
  }

  /**
   * Reset metrics (called periodically)
   */
  private resetMetrics() {
    const summary = this.exportMetrics();

    // Archive important metrics before reset
    logger.info('Query Metrics Archive', {
      timestamp: new Date().toISOString(),
      summary,
    });

    // Clear metrics
    this.queryMetrics.clear();
  }

  /**
   * Get real-time dashboard data
   */
  public getDashboardData() {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    const recentQueries = Array.from(this.queryMetrics.values()).filter(
      (m) => m.lastExecuted.getTime() > fiveMinutesAgo,
    );

    return {
      activeQueries: recentQueries.length,
      queryRate: recentQueries.reduce((sum, m) => sum + this.getQueryRate(m), 0),
      avgResponseTime:
        recentQueries.reduce((sum, m) => sum + m.avgDuration, 0) / recentQueries.length || 0,
      errorRate: 0, // Would need to track errors separately
      alerts: this.alerts.filter((a) => a.timestamp.getTime() > fiveMinutesAgo),
    };
  }
}

// Export singleton instance
export const queryMonitor = QueryMonitor.getInstance();
