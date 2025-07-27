import { logger } from '@/lib/logger';

22; // Client-side performance monitoring
interface PerformanceMetrics {
  pageLoadTime: number;
  domContentLoadedTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  apiResponseTimes: { endpoint: string; duration: number; timestamp: number }[];
}

class ClientMonitor {
  private static instance: ClientMonitor;
  private metrics: PerformanceMetrics = {
    pageLoadTime: 0,
    domContentLoadedTime: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    timeToInteractive: 0,
    apiResponseTimes: [],
  };
  private errors: Array<{
    message: string;
    stack?: string;
    timestamp: number;
    url?: string;
    line?: number;
    column?: number;
  }> = [];

  // Error batching configuration
  private errorBatch: Array<any> = [];
  private errorBatchTimer: NodeJS.Timeout | null = null;
  private readonly ERROR_BATCH_INTERVAL = 5000; // 5 seconds
  private readonly MAX_BATCH_SIZE = 50;

  // Rate limiting configuration
  private errorsSentInWindow = 0;
  private rateLimitWindowStart = Date.now();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_ERRORS_PER_WINDOW = 100;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initializePerformanceObserver();
      this.initializeErrorTracking();
      this.measurePageLoadMetrics();

      // Clean up on page unload
      window.addEventListener('beforeunload', () => {
        this.flushErrorBatch();
      });
    }
  }

  static getInstance(): ClientMonitor {
    if (!ClientMonitor.instance) {
      ClientMonitor.instance = new ClientMonitor();
    }
    return ClientMonitor.instance;
  }

  private initializePerformanceObserver() {
    if ('PerformanceObserver' in window) {
      // Observe paint timing
      const paintObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.firstContentfulPaint = entry.startTime;
          }
        });
      });
      paintObserver.observe({ entryTypes: ['paint'] });

      // Observe Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.largestContentfulPaint = lastEntry.startTime;
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    }
  }

  private initializeErrorTracking() {
    window.addEventListener('error', (event) => {
      const sanitizedError = {
        message: this.sanitizeErrorMessage(event.message),
        stack: this.sanitizeStackTrace(event.error?.stack),
        timestamp: Date.now(),
        url: this.sanitizeUrl(event.filename),
        line: event.lineno,
        column: event.colno,
      };

      this.errors.push(sanitizedError);

      // Keep only last 100 errors
      if (this.errors.length > 100) {
        this.errors.shift();
      }

      // Add to batch instead of sending immediately
      this.addErrorToBatch(sanitizedError);
    });

    window.addEventListener('unhandledrejection', (event) => {
      const sanitizedError = {
        message: this.sanitizeErrorMessage(`Unhandled Promise Rejection: ${event.reason}`),
        stack: this.sanitizeStackTrace(event.reason?.stack),
        timestamp: Date.now(),
      };

      this.errors.push(sanitizedError);

      // Add to batch instead of sending immediately
      this.addErrorToBatch(sanitizedError);
    });
  }

  private measurePageLoadMetrics() {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;

      if (navigation) {
        this.metrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
        this.metrics.domContentLoadedTime =
          navigation.domContentLoadedEventEnd - navigation.fetchStart;

        // Estimate Time to Interactive
        this.metrics.timeToInteractive = navigation.domInteractive - navigation.fetchStart;
      }

      // Send initial metrics after page load
      setTimeout(() => {
        this.sendMetricsToServer();
      }, 1000);
    });
  }

  // Track API response times
  trackApiCall(endpoint: string, duration: number) {
    this.metrics.apiResponseTimes.push({
      endpoint,
      duration,
      timestamp: Date.now(),
    });

    // Keep only last 100 API calls
    if (this.metrics.apiResponseTimes.length > 100) {
      this.metrics.apiResponseTimes.shift();
    }

    // Send metrics if we have collected enough data
    if (this.metrics.apiResponseTimes.length % 10 === 0) {
      this.sendMetricsToServer();
    }
  }

  // Intercept fetch to track API calls
  interceptFetch() {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const start = performance.now();
      const url = args[0] instanceof Request ? args[0].url : args[0].toString();

      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - start;

        if (url.includes('/api/')) {
          this.trackApiCall(url, duration);
        }

        return response;
      } catch (error) {
        const duration = performance.now() - start;
        this.trackApiCall(url, duration);
        throw error;
      }
    };
  }

  private async sendMetricsToServer() {
    try {
      await fetch('/api/monitoring/client-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: this.metrics,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      logger.error('Failed to send metrics:', error);
    }
  }

  // Sanitization methods
  private sanitizeErrorMessage(message: string): string {
    if (!message) return 'Unknown error';

    // Remove potential PII patterns
    return (
      message
        // Remove email addresses
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
        // Remove phone numbers (Australian format)
        .replace(/(?:\+61|0)[2-478](?:[\s-]?\d){8}/g, '[PHONE]')
        // Remove tax file numbers (XXX-XXX-XXX format)
        .replace(/\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b/g, '[TFN]')
        // Remove ABN (11 digits)
        .replace(/\b\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/g, '[ABN]')
        // Remove credit card numbers
        .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]')
        // Remove IP addresses
        .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP]')
        // Remove potential API keys (long alphanumeric strings)
        .replace(/\b[a-zA-Z0-9]{32,}\b/g, '[KEY]')
        // Remove URLs with potential tokens
        .replace(/token=[^&\s]+/gi, 'token=[REDACTED]')
        .replace(/api_key=[^&\s]+/gi, 'api_key=[REDACTED]')
        .replace(/password=[^&\s]+/gi, 'password=[REDACTED]')
    );
  }

  private sanitizeStackTrace(stack?: string): string | undefined {
    if (!stack) return undefined;

    return (
      stack
        // Remove local file paths that might contain usernames
        .replace(/\/Users\/[^/]+/g, '/Users/[USER]')
        .replace(/\/home\/[^/]+/g, '/home/[USER]')
        .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\[USER]')
        // Apply same PII sanitization as messages
        .split('\n')
        .map((line) => this.sanitizeErrorMessage(line))
        .join('\n')
    );
  }

  private sanitizeUrl(url?: string): string | undefined {
    if (!url) return undefined;

    try {
      const urlObj = new URL(url);
      // Remove query parameters that might contain sensitive data
      urlObj.search = '';
      // Remove user info from URL
      urlObj.username = '';
      urlObj.password = '';
      return urlObj.toString();
    } catch {
      // If URL parsing fails, return a generic value
      return '[INVALID_URL]';
    }
  }

  // Error batching methods
  private addErrorToBatch(error: any) {
    // Check rate limit
    if (!this.checkRateLimit()) {
      logger.warn('Error rate limit exceeded, dropping error');
      return;
    }

    this.errorBatch.push(error);

    // Send immediately if batch is full
    if (this.errorBatch.length >= this.MAX_BATCH_SIZE) {
      this.flushErrorBatch();
      return;
    }

    // Schedule batch send if not already scheduled
    if (!this.errorBatchTimer) {
      this.errorBatchTimer = setTimeout(() => {
        this.flushErrorBatch();
      }, this.ERROR_BATCH_INTERVAL);
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();

    // Reset window if needed
    if (now - this.rateLimitWindowStart > this.RATE_LIMIT_WINDOW) {
      this.rateLimitWindowStart = now;
      this.errorsSentInWindow = 0;
    }

    // Check if under limit
    return this.errorsSentInWindow < this.MAX_ERRORS_PER_WINDOW;
  }

  private async flushErrorBatch() {
    if (this.errorBatch.length === 0) return;

    // Clear timer
    if (this.errorBatchTimer) {
      clearTimeout(this.errorBatchTimer);
      this.errorBatchTimer = null;
    }

    // Get current batch and clear it
    const batch = [...this.errorBatch];
    this.errorBatch = [];

    // Update rate limit counter
    this.errorsSentInWindow += batch.length;

    try {
      await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errors: batch,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
          url: this.sanitizeUrl(window.location.href),
          batchSize: batch.length,
        }),
      });
    } catch (err) {
      logger.error('Failed to send error batch:', err);
      // Don't re-add to batch to prevent infinite loop
    }
  }

  private async sendErrorToServer(error: any) {
    // This method is now deprecated in favor of batching
    // Keep for backward compatibility but route through batching
    this.addErrorToBatch(error);
  }

  getMetrics() {
    return {
      ...this.metrics,
      errors: this.errors,
      errorCount: this.errors.length,
    };
  }
}

// Initialize monitoring when imported
if (typeof window !== 'undefined') {
  const monitor = ClientMonitor.getInstance();
  monitor.interceptFetch();
}

export { ClientMonitor };
