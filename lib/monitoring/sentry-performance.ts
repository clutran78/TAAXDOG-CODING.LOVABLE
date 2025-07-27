import * as Sentry from '@sentry/nextjs';
import { logger } from '../logger';

/**
 * Custom performance monitoring utilities that integrate with Sentry v8
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
}

export class SentryPerformanceMonitor {
  /**
   * Start a span for monitoring (v8 API)
   */
  static startSpan(name: string, op: string, fn?: () => void) {
    if (fn) {
      return Sentry.startSpan({ name, op }, fn);
    }
    return Sentry.startInactiveSpan({ name, op });
  }

  /**
   * Start a child span within current span
   */
  static startChildSpan(op: string, description?: string) {
    const activeSpan = Sentry.getActiveSpan();
    if (activeSpan) {
      return Sentry.startInactiveSpan({
        op,
        name: description || op,
        parentSpan: activeSpan,
      });
    }
    return null;
  }

  /**
   * Track custom performance metrics
   */
  static trackMetric(metric: PerformanceMetric) {
    try {
      const activeSpan = Sentry.getActiveSpan();
      if (activeSpan) {
        activeSpan.setMeasurement(metric.name, metric.value, metric.unit);
        if (metric.tags) {
          Object.entries(metric.tags).forEach(([key, value]) => {
            activeSpan.setAttribute(key, value);
          });
        }
      }
      
      // Also send as custom metric
      Sentry.metrics.gauge(metric.name, metric.value, {
        unit: metric.unit,
        tags: metric.tags,
      });
    } catch (error) {
      logger.error('Failed to track metric', { error, metric });
    }
  }

  /**
   * Track API response time
   */
  static trackApiResponseTime(endpoint: string, duration: number, status: number) {
    this.trackMetric({
      name: 'api.response_time',
      value: duration,
      unit: 'millisecond',
      tags: {
        endpoint,
        status: status.toString(),
        status_category: status < 400 ? 'success' : status < 500 ? 'client_error' : 'server_error',
      },
    });
  }

  /**
   * Track database query performance
   */
  static trackDatabaseQuery(operation: string, duration: number, table?: string) {
    this.trackMetric({
      name: 'db.query_time',
      value: duration,
      unit: 'millisecond',
      tags: {
        operation,
        ...(table && { table }),
      },
    });
  }

  /**
   * Track cache performance
   */
  static trackCacheOperation(operation: 'hit' | 'miss' | 'set', key: string, duration?: number) {
    if (duration) {
      this.trackMetric({
        name: `cache.${operation}_time`,
        value: duration,
        unit: 'millisecond',
        tags: {
          cache_key: key,
        },
      });
    }
    
    // Track cache hit rate
    Sentry.metrics.increment(`cache.${operation}`, 1, {
      tags: { cache_key: key },
    });
  }

  /**
   * Track memory usage
   */
  static trackMemoryUsage() {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      this.trackMetric({
        name: 'browser.memory.used',
        value: memory.usedJSHeapSize,
        unit: 'byte',
      });
      this.trackMetric({
        name: 'browser.memory.total',
        value: memory.totalJSHeapSize,
        unit: 'byte',
      });
    }
  }

  /**
   * Track Web Vitals
   */
  static trackWebVital(name: string, value: number) {
    this.trackMetric({
      name: `web_vital.${name.toLowerCase()}`,
      value,
      unit: name === 'CLS' ? '' : 'millisecond',
      tags: {
        rating: this.getWebVitalRating(name, value),
      },
    });
  }

  /**
   * Get Web Vital rating based on thresholds
   */
  private static getWebVitalRating(name: string, value: number): string {
    const thresholds: Record<string, { good: number; needsImprovement: number }> = {
      LCP: { good: 2500, needsImprovement: 4000 },
      FID: { good: 100, needsImprovement: 300 },
      FCP: { good: 1800, needsImprovement: 3000 },
      CLS: { good: 0.1, needsImprovement: 0.25 },
      INP: { good: 200, needsImprovement: 500 },
      TTFB: { good: 800, needsImprovement: 1800 },
    };

    const threshold = thresholds[name];
    if (!threshold) return 'unknown';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.needsImprovement) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Wrap async function with performance monitoring
   */
  static async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    return Sentry.startSpan(
      {
        name: `function.${name}`,
        op: 'function',
        attributes: tags,
      },
      async (span) => {
        const startTime = performance.now();
        try {
          const result = await fn();
          const duration = performance.now() - startTime;
          
          this.trackMetric({
            name: `function.${name}`,
            value: duration,
            unit: 'millisecond',
            tags: { ...tags, status: 'success' },
          });

          return result;
        } catch (error) {
          const duration = performance.now() - startTime;
          
          this.trackMetric({
            name: `function.${name}`,
            value: duration,
            unit: 'millisecond',
            tags: { ...tags, status: 'error' },
          });

          span.setStatus({ code: 2, message: 'Internal Error' });
          throw error;
        }
      }
    );
  }

  /**
   * Create middleware for API routes
   */
  static apiMiddleware(handler: Function) {
    return async (req: any, res: any) => {
      return Sentry.startSpan(
        {
          name: `${req.method} ${req.url}`,
          op: 'http.server',
          attributes: {
            'http.method': req.method,
            'http.url': req.url,
          },
        },
        async (span) => {
          const startTime = performance.now();
          
          const originalEnd = res.end;
          res.end = function(...args: any[]) {
            const duration = performance.now() - startTime;
            
            SentryPerformanceMonitor.trackApiResponseTime(
              req.url,
              duration,
              res.statusCode
            );

            span.setAttribute('http.status_code', res.statusCode);
            span.setStatus({
              code: res.statusCode >= 400 ? 2 : 0,
              message: res.statusCode >= 400 ? 'HTTP Error' : 'OK',
            });

            return originalEnd.apply(res, args);
          };

          try {
            await handler(req, res);
          } catch (error) {
            span.setStatus({ code: 2, message: 'Internal Error' });
            throw error;
          }
        }
      );
    };
  }
}

// Export convenience functions
export const {
  startSpan,
  startChildSpan,
  trackMetric,
  trackApiResponseTime,
  trackDatabaseQuery,
  trackCacheOperation,
  trackMemoryUsage,
  trackWebVital,
  measureAsync,
  apiMiddleware,
} = SentryPerformanceMonitor;

// For backward compatibility
export const startTransaction = startSpan;