import * as Sentry from '@sentry/nextjs';
import { logger } from '../logger';

/**
 * Custom performance monitoring utilities that integrate with Sentry
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
}

export class SentryPerformanceMonitor {
  /**
   * Start a transaction for monitoring
   */
  static startTransaction(name: string, op: string, data?: Record<string, unknown>) {
    return Sentry.startTransaction({
      name,
      op,
      data,
      trimEnd: true,
    });
  }

  /**
   * Start a span within current transaction
   */
  static startSpan(op: string, description?: string) {
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
    if (transaction) {
      return transaction.startChild({
        op,
        description,
      });
    }
    return null;
  }

  /**
   * Track custom performance metrics
   */
  static trackMetric(metric: PerformanceMetric) {
    try {
      const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
      if (transaction) {
        transaction.setMeasurement(metric.name, metric.value, metric.unit);
        if (metric.tags) {
          Object.entries(metric.tags).forEach(([key, value]) => {
            transaction.setTag(key, value);
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
    const startTime = performance.now();
    const span = this.startSpan('function', name);

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

      throw error;
    } finally {
      span?.finish();
    }
  }

  /**
   * Create middleware for API routes
   */
  static apiMiddleware(handler: Function) {
    return async (req: any, res: any) => {
      const startTime = performance.now();
      const transaction = this.startTransaction(
        `${req.method} ${req.url}`,
        'http.server',
        {
          method: req.method,
          url: req.url,
        }
      );

      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        const duration = performance.now() - startTime;
        
        SentryPerformanceMonitor.trackApiResponseTime(
          req.url,
          duration,
          res.statusCode
        );

        transaction?.setHttpStatus(res.statusCode);
        transaction?.finish();

        return originalEnd.apply(res, args);
      };

      try {
        await handler(req, res);
      } catch (error) {
        transaction?.setStatus('internal_error');
        throw error;
      }
    };
  }
}

// Export convenience functions
export const {
  startTransaction,
  startSpan,
  trackMetric,
  trackApiResponseTime,
  trackDatabaseQuery,
  trackCacheOperation,
  trackMemoryUsage,
  trackWebVital,
  measureAsync,
  apiMiddleware,
} = SentryPerformanceMonitor;