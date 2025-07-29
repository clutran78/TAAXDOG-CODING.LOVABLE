import { onCLS, onFCP, onINP, onLCP, onTTFB, Metric } from 'web-vitals';
import { logger } from '@/lib/logger';

interface PerformanceData {
  CLS?: number;
  FCP?: number;
  FID?: number;
  LCP?: number;
  TTFB?: number;
  customMetrics: Record<string, number>;
  resourceTimings: ResourceTiming[];
  navigationTiming?: NavigationTiming;
  userInteractions: UserInteraction[];
  apiMetrics: ApiMetric[];
  databaseMetrics: DatabaseMetric[];
  pageLoadMetrics: PageLoadMetric[];
}

interface ResourceTiming {
  name: string;
  duration: number;
  transferSize: number;
  initiatorType: string;
}

interface NavigationTiming {
  domContentLoadedTime: number;
  loadTime: number;
  domInteractive: number;
  firstPaint?: number;
  timeToInteractive?: number;
  totalBlockingTime?: number;
}

interface UserInteraction {
  type: string;
  target: string;
  timestamp: number;
  duration?: number;
}

interface ApiMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: number;
  size?: number;
  cached?: boolean;
  error?: string;
}

interface DatabaseMetric {
  operation: string;
  model?: string;
  duration: number;
  timestamp: number;
  rowCount?: number;
  query?: string;
  error?: string;
}

interface PageLoadMetric {
  route: string;
  duration: number;
  timestamp: number;
  metrics: {
    domContentLoaded?: number;
    loadComplete?: number;
    firstContentfulPaint?: number;
    largestContentfulPaint?: number;
    timeToInteractive?: number;
  };
}

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  page: { good: 2000, warning: 4000, poor: 6000 },
  api: { good: 200, warning: 1000, poor: 3000 },
  database: { good: 50, warning: 200, poor: 1000 },
  lcp: { good: 2500, warning: 4000, poor: 6000 },
  fid: { good: 100, warning: 300, poor: 500 },
  cls: { good: 0.1, warning: 0.25, poor: 0.5 },
  fcp: { good: 1800, warning: 3000, poor: 4500 },
  ttfb: { good: 800, warning: 1800, poor: 3000 },
};

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private data: PerformanceData = {
    customMetrics: {},
    resourceTimings: [],
    userInteractions: [],
    apiMetrics: [],
    databaseMetrics: [],
    pageLoadMetrics: [],
  };
  private interactionStartTimes = new Map<string, number>();
  private reportingEnabled = true;
  private reportingThreshold = 10; // Report after collecting 10 interactions
  private lastReportTime = 0;
  private reportingInterval = 30000; // Report at most every 30 seconds
  private pageLoadStartTime = 0;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initializeWebVitals();
      this.measureNavigationTiming();
      this.observeResources();
      this.setupInteractionTracking();
      this.setupVisibilityTracking();
    }
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private initializeWebVitals() {
    // Cumulative Layout Shift
    onCLS((metric) => {
      this.data.CLS = metric.value;
      this.maybeReport('cls');
    });

    // First Contentful Paint
    onFCP((metric) => {
      this.data.FCP = metric.value;
      this.maybeReport('fcp');
    });

    // Interaction to Next Paint (replaces FID)
    onINP((metric) => {
      this.data.customMetrics.INP = metric.value;
      this.maybeReport('inp');
    });

    // Largest Contentful Paint
    onLCP((metric) => {
      this.data.LCP = metric.value;
      this.maybeReport('lcp');
    });

    // Time to First Byte
    onTTFB((metric) => {
      this.data.TTFB = metric.value;
      this.maybeReport('ttfb');
    });
  }

  private measureNavigationTiming() {
    if (typeof window === 'undefined' || !('performance' in window)) return;

    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType(
          'navigation',
        )[0] as PerformanceNavigationTiming;

        if (navigation) {
          this.data.navigationTiming = {
            domContentLoadedTime: navigation.domContentLoadedEventEnd - navigation.fetchStart,
            loadTime: navigation.loadEventEnd - navigation.fetchStart,
            domInteractive: navigation.domInteractive - navigation.fetchStart,
          };

          // Get First Paint if available
          const paintEntries = performance.getEntriesByType('paint');
          const firstPaint = paintEntries.find((entry) => entry.name === 'first-paint');
          if (firstPaint) {
            this.data.navigationTiming.firstPaint = firstPaint.startTime;
          }

          this.maybeReport('navigation');
        }
      }, 0);
    });
  }

  private observeResources() {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;

            // Filter out data URIs and very small resources
            if (!resourceEntry.name.startsWith('data:') && resourceEntry.transferSize > 1000) {
              this.data.resourceTimings.push({
                name: this.sanitizeResourceName(resourceEntry.name),
                duration: resourceEntry.duration,
                transferSize: resourceEntry.transferSize,
                initiatorType: resourceEntry.initiatorType,
              });

              // Keep only the 50 largest resources
              this.data.resourceTimings.sort((a, b) => b.transferSize - a.transferSize);
              this.data.resourceTimings = this.data.resourceTimings.slice(0, 50);
            }
          }
        }
      });

      observer.observe({ entryTypes: ['resource'] });
    } catch (e) {
      logger.error('Failed to setup resource observer:', e);
    }
  }

  private setupInteractionTracking() {
    if (typeof window === 'undefined') return;

    // Track clicks
    document.addEventListener(
      'click',
      (event) => {
        const target = event.target as HTMLElement;
        const selector = this.getElementSelector(target);
        this.trackInteraction('click', selector);
      },
      { capture: true, passive: true },
    );

    // Track form submissions
    document.addEventListener(
      'submit',
      (event) => {
        const target = event.target as HTMLElement;
        const selector = this.getElementSelector(target);
        this.trackInteraction('submit', selector);
      },
      { capture: true, passive: true },
    );

    // Track input changes (debounced)
    let inputTimer: NodeJS.Timeout;
    document.addEventListener(
      'input',
      (event) => {
        clearTimeout(inputTimer);
        inputTimer = setTimeout(() => {
          const target = event.target as HTMLElement;
          const selector = this.getElementSelector(target);
          this.trackInteraction('input', selector);
        }, 500);
      },
      { capture: true, passive: true },
    );

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.trackInteraction('visibility', document.hidden ? 'hidden' : 'visible');
    });

    // Track scroll depth
    let maxScrollDepth = 0;
    let scrollTimer: NodeJS.Timeout;
    window.addEventListener(
      'scroll',
      () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          const scrollDepth = Math.round(
            ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100,
          );
          if (scrollDepth > maxScrollDepth) {
            maxScrollDepth = scrollDepth;
            this.setCustomMetric('maxScrollDepth', maxScrollDepth);
          }
        }, 100);
      },
      { passive: true },
    );
  }

  private setupVisibilityTracking() {
    if (typeof window === 'undefined') return;

    let hiddenTime = 0;
    let hiddenStart = 0;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        hiddenStart = performance.now();
      } else if (hiddenStart > 0) {
        hiddenTime += performance.now() - hiddenStart;
        this.setCustomMetric('hiddenTime', Math.round(hiddenTime));
      }
    });

    // Track time on page
    window.addEventListener('beforeunload', () => {
      const timeOnPage = Math.round(performance.now());
      this.setCustomMetric('timeOnPage', timeOnPage);
      this.forceReport();
    });
  }

  private getElementSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }

    if (element.className) {
      const classes = element.className
        .split(' ')
        .filter((c) => c)
        .join('.');
      if (classes) {
        return `.${classes}`;
      }
    }

    if (element.tagName) {
      return element.tagName.toLowerCase();
    }

    return 'unknown';
  }

  private sanitizeResourceName(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove query parameters and hash
      return `${urlObj.origin}${urlObj.pathname}`;
    } catch {
      // If URL parsing fails, return the path portion
      const pathMatch = url.match(/^https?:\/\/[^\/]+(.+?)(\?|#|$)/);
      return pathMatch ? pathMatch[1] : url;
    }
  }

  // Public methods for custom metrics
  setCustomMetric(name: string, value: number) {
    this.data.customMetrics[name] = value;
  }

  startMeasure(name: string) {
    this.interactionStartTimes.set(name, performance.now());
  }

  endMeasure(name: string) {
    const startTime = this.interactionStartTimes.get(name);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.setCustomMetric(name, Math.round(duration));
      this.interactionStartTimes.delete(name);
    }
  }

  trackInteraction(type: string, target: string) {
    this.data.userInteractions.push({
      type,
      target,
      timestamp: Date.now(),
    });

    // Keep only last 100 interactions
    if (this.data.userInteractions.length > 100) {
      this.data.userInteractions = this.data.userInteractions.slice(-100);
    }

    // Check if we should report
    if (this.data.userInteractions.length >= this.reportingThreshold) {
      this.maybeReport('interactions');
    }
  }

  // Track page load performance
  trackPageLoad(route: string) {
    if (typeof window === 'undefined') return;

    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigationEntry) {
      const metrics: PageLoadMetric = {
        route,
        duration: navigationEntry.loadEventEnd - navigationEntry.fetchStart,
        timestamp: Date.now(),
        metrics: {
          domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart,
          loadComplete: navigationEntry.loadEventEnd - navigationEntry.loadEventStart,
          firstContentfulPaint: this.data.FCP,
          largestContentfulPaint: this.data.LCP,
          timeToInteractive: navigationEntry.domInteractive - navigationEntry.fetchStart,
        },
      };

      this.data.pageLoadMetrics.push(metrics);
      
      // Keep only last 50 page loads
      if (this.data.pageLoadMetrics.length > 50) {
        this.data.pageLoadMetrics = this.data.pageLoadMetrics.slice(-50);
      }

      this.logPerformance('Page Load', route, metrics.duration);
      this.maybeReport('pageLoad');
    }
  }

  // Track API call performance
  trackApiCall(endpoint: string, method: string, startTime: number) {
    return (statusCode: number, size?: number, error?: string) => {
      const duration = performance.now() - startTime;
      const metric: ApiMetric = {
        endpoint,
        method,
        statusCode,
        duration,
        timestamp: Date.now(),
        size,
        cached: statusCode === 304,
        error,
      };

      this.data.apiMetrics.push(metric);
      
      // Keep only last 100 API calls
      if (this.data.apiMetrics.length > 100) {
        this.data.apiMetrics = this.data.apiMetrics.slice(-100);
      }

      this.logPerformance('API', `${method} ${endpoint}`, duration, statusCode >= 400 ? 'error' : 'info');
      
      if (this.data.apiMetrics.length >= this.reportingThreshold) {
        this.maybeReport('api');
      }
    };
  }

  // Track database query performance
  trackDatabaseQuery(operation: string, model?: string) {
    const startTime = performance.now();
    
    return (rowCount?: number, error?: string) => {
      const duration = performance.now() - startTime;
      const metric: DatabaseMetric = {
        operation,
        model,
        duration,
        timestamp: Date.now(),
        rowCount,
        error,
      };

      this.data.databaseMetrics.push(metric);
      
      // Keep only last 100 database queries
      if (this.data.databaseMetrics.length > 100) {
        this.data.databaseMetrics = this.data.databaseMetrics.slice(-100);
      }

      const queryName = model ? `${operation}:${model}` : operation;
      this.logPerformance('Database', queryName, duration, error ? 'error' : 'info');
      
      if (this.data.databaseMetrics.length >= this.reportingThreshold) {
        this.maybeReport('database');
      }
    };
  }

  // Log performance with thresholds
  private logPerformance(category: string, name: string, duration: number, level: 'info' | 'error' = 'info') {
    const thresholdKey = category.toLowerCase().replace(' ', '') as keyof typeof PERFORMANCE_THRESHOLDS;
    const threshold = PERFORMANCE_THRESHOLDS[thresholdKey];
    
    let logLevel = level;
    if (threshold && level !== 'error') {
      if (duration > threshold.poor) logLevel = 'error';
      else if (duration > threshold.warning) logLevel = 'warn';
    }

    const rating = threshold
      ? duration <= threshold.good
        ? 'good'
        : duration <= threshold.warning
        ? 'needs-improvement'
        : 'poor'
      : 'unknown';

    logger.log(logLevel, `${category} Performance: ${name}`, {
      duration: Math.round(duration),
      rating,
      category,
    });
  }

  private maybeReport(trigger: string) {
    const now = Date.now();

    // Rate limit reporting
    if (now - this.lastReportTime < this.reportingInterval) {
      return;
    }

    // Only report if we have meaningful data
    const hasWebVitals =
      this.data.CLS !== undefined || this.data.FCP !== undefined || this.data.LCP !== undefined;

    const hasInteractions = this.data.userInteractions.length > 0;
    const hasCustomMetrics = Object.keys(this.data.customMetrics).length > 0;

    if (hasWebVitals || hasInteractions || hasCustomMetrics) {
      this.report();
      this.lastReportTime = now;
    }
  }

  private forceReport() {
    this.report();
  }

  private async report() {
    if (!this.reportingEnabled) return;

    const reportData = {
      webVitals: {
        CLS: this.data.CLS,
        FCP: this.data.FCP,
        FID: this.data.FID,
        LCP: this.data.LCP,
        TTFB: this.data.TTFB,
      },
      navigation: this.data.navigationTiming,
      resources: this.data.resourceTimings.slice(0, 10), // Send top 10 resources
      customMetrics: this.data.customMetrics,
      interactions: this.data.userInteractions.slice(-20), // Send last 20 interactions
      apiCalls: this.data.apiMetrics.slice(-20), // Send last 20 API calls
      databaseQueries: this.data.databaseMetrics.slice(-20), // Send last 20 DB queries
      pageLoads: this.data.pageLoadMetrics.slice(-10), // Send last 10 page loads
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
      },
      summary: this.getPerformanceSummary(),
    };

    try {
      await fetch('/api/monitoring/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      });

      // Clear data after successful report
      this.data.userInteractions = [];
      this.data.apiMetrics = [];
      this.data.databaseMetrics = [];
      this.data.pageLoadMetrics = [];
    } catch (error) {
      logger.error('Failed to send performance data:', error);
    }
  }

  // Enable/disable reporting
  setReportingEnabled(enabled: boolean) {
    this.reportingEnabled = enabled;
  }

  // Get current performance data
  getData(): PerformanceData {
    return { ...this.data };
  }

  // Get Web Vitals summary
  getWebVitalsSummary() {
    return {
      CLS: this.data.CLS,
      FCP: this.data.FCP,
      FID: this.data.FID,
      LCP: this.data.LCP,
      TTFB: this.data.TTFB,
      scores: {
        CLS: this.getWebVitalScore('CLS', this.data.CLS),
        FCP: this.getWebVitalScore('FCP', this.data.FCP),
        FID: this.getWebVitalScore('FID', this.data.FID),
        LCP: this.getWebVitalScore('LCP', this.data.LCP),
        TTFB: this.getWebVitalScore('TTFB', this.data.TTFB),
      },
    };
  }

  // Get comprehensive performance summary
  getPerformanceSummary() {
    const summary: any = {
      webVitals: this.getWebVitalsSummary(),
      pageLoads: this.calculateMetricsSummary(this.data.pageLoadMetrics, 'duration'),
      apiCalls: this.calculateApiSummary(),
      databaseQueries: this.calculateDatabaseSummary(),
      resources: {
        totalSize: this.data.resourceTimings.reduce((sum, r) => sum + r.transferSize, 0),
        totalDuration: this.data.resourceTimings.reduce((sum, r) => sum + r.duration, 0),
        count: this.data.resourceTimings.length,
        largestResources: this.data.resourceTimings.slice(0, 5).map(r => ({
          name: this.sanitizeResourceName(r.name),
          size: r.transferSize,
          duration: r.duration,
        })),
      },
      customMetrics: this.data.customMetrics,
    };

    return summary;
  }

  // Calculate metrics summary
  private calculateMetricsSummary(metrics: any[], durationField: string) {
    if (metrics.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }

    const durations = metrics.map(m => m[durationField]).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: metrics.length,
      average: Math.round(sum / metrics.length),
      min: durations[0],
      max: durations[durations.length - 1],
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
    };
  }

  // Calculate API summary with status code breakdown
  private calculateApiSummary() {
    const summary = this.calculateMetricsSummary(this.data.apiMetrics, 'duration');
    
    // Add status code breakdown
    const statusCodes: Record<string, number> = {};
    const endpointPerformance: Record<string, { count: number; totalDuration: number }> = {};
    
    this.data.apiMetrics.forEach(metric => {
      const statusGroup = `${Math.floor(metric.statusCode / 100)}xx`;
      statusCodes[statusGroup] = (statusCodes[statusGroup] || 0) + 1;
      
      if (!endpointPerformance[metric.endpoint]) {
        endpointPerformance[metric.endpoint] = { count: 0, totalDuration: 0 };
      }
      endpointPerformance[metric.endpoint].count++;
      endpointPerformance[metric.endpoint].totalDuration += metric.duration;
    });

    // Get slowest endpoints
    const slowestEndpoints = Object.entries(endpointPerformance)
      .map(([endpoint, data]) => ({
        endpoint,
        averageDuration: Math.round(data.totalDuration / data.count),
        count: data.count,
      }))
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5);

    return {
      ...summary,
      statusCodes,
      slowestEndpoints,
      errorRate: this.data.apiMetrics.filter(m => m.statusCode >= 400).length / this.data.apiMetrics.length,
    };
  }

  // Calculate database summary with operation breakdown
  private calculateDatabaseSummary() {
    const summary = this.calculateMetricsSummary(this.data.databaseMetrics, 'duration');
    
    // Add operation breakdown
    const operations: Record<string, { count: number; totalDuration: number }> = {};
    
    this.data.databaseMetrics.forEach(metric => {
      const key = metric.model ? `${metric.operation}:${metric.model}` : metric.operation;
      if (!operations[key]) {
        operations[key] = { count: 0, totalDuration: 0 };
      }
      operations[key].count++;
      operations[key].totalDuration += metric.duration;
    });

    // Get slowest operations
    const slowestOperations = Object.entries(operations)
      .map(([operation, data]) => ({
        operation,
        averageDuration: Math.round(data.totalDuration / data.count),
        count: data.count,
      }))
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5);

    return {
      ...summary,
      slowestOperations,
      errorRate: this.data.databaseMetrics.filter(m => m.error).length / this.data.databaseMetrics.length,
    };
  }

  private getWebVitalScore(
    metric: string,
    value?: number,
  ): 'good' | 'needs-improvement' | 'poor' | 'unknown' {
    if (value === undefined) return 'unknown';

    // Based on Google's Web Vitals thresholds
    const thresholds: Record<string, { good: number; poor: number }> = {
      CLS: { good: 0.1, poor: 0.25 },
      FCP: { good: 1800, poor: 3000 },
      FID: { good: 100, poor: 300 },
      LCP: { good: 2500, poor: 4000 },
      TTFB: { good: 800, poor: 1800 },
    };

    const threshold = thresholds[metric];
    if (!threshold) return 'unknown';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const monitor = performanceMonitor;

  return {
    trackPageLoad: (route: string) => monitor.trackPageLoad(route),
    trackApiCall: (endpoint: string, method: string, startTime: number) => 
      monitor.trackApiCall(endpoint, method, startTime),
    trackDatabaseQuery: (operation: string, model?: string) => 
      monitor.trackDatabaseQuery(operation, model),
    startMeasure: (name: string) => monitor.startMeasure(name),
    endMeasure: (name: string) => monitor.endMeasure(name),
    setCustomMetric: (name: string, value: number) => monitor.setCustomMetric(name, value),
    getWebVitalsSummary: () => monitor.getWebVitalsSummary(),
    getPerformanceSummary: () => monitor.getPerformanceSummary(),
  };
}

// Middleware for API performance tracking
export function withPerformanceTracking(handler: Function) {
  return async (req: any, res: any) => {
    const startTime = performance.now();
    const endpoint = req.url;
    const method = req.method;

    // Override res.json to track response
    const originalJson = res.json;
    res.json = function(data: any) {
      const endTracking = performanceMonitor.trackApiCall(endpoint, method, startTime);
      const size = JSON.stringify(data).length;
      endTracking(res.statusCode, size);
      return originalJson.call(this, data);
    };

    // Override res.status for error tracking
    const originalStatus = res.status;
    res.status = function(code: number) {
      if (code >= 400) {
        const endTracking = performanceMonitor.trackApiCall(endpoint, method, startTime);
        endTracking(code, 0, `HTTP ${code}`);
      }
      return originalStatus.call(this, code);
    };

    try {
      await handler(req, res);
    } catch (error) {
      const endTracking = performanceMonitor.trackApiCall(endpoint, method, startTime);
      endTracking(500, 0, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };
}

// Prisma middleware for database performance tracking
export function createPrismaPerformanceMiddleware() {
  return async (params: any, next: any) => {
    const { model, action } = params;
    const endTracking = performanceMonitor.trackDatabaseQuery(action, model);

    try {
      const result = await next(params);
      const rowCount = Array.isArray(result) ? result.length : 1;
      endTracking(rowCount);
      return result;
    } catch (error) {
      endTracking(0, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };
}

// Helper to measure async operations
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>,
  category: 'api' | 'database' | 'custom' = 'custom'
): Promise<T> {
  performanceMonitor.startMeasure(name);
  try {
    const result = await operation();
    performanceMonitor.endMeasure(name);
    return result;
  } catch (error) {
    performanceMonitor.endMeasure(name);
    throw error;
  }
}

// Export types
export type { PerformanceData, ApiMetric, DatabaseMetric, PageLoadMetric };
