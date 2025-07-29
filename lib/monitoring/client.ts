import { logger } from '@/lib/logger';

// Constants for monitoring configuration
const ERROR_BATCH_INTERVAL_MS = 5000; // 5 seconds
const MAX_BATCH_SIZE = 50;
const METRICS_DEBOUNCE_DELAY_MS = 5000; // 5 seconds
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_ERRORS_PER_WINDOW = 100;
const MAX_STORED_ERRORS = 100;
const MAX_STORED_API_CALLS = 100;
const AUTH_TIMEOUT_MS = 10000; // 10 seconds
const METRICS_SEND_DELAY_MS = 1000; // 1 second

// Client-side performance monitoring
interface PerformanceMetrics {
  pageLoadTime: number;
  domContentLoadedTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  apiResponseTimes: { endpoint: string; duration: number; timestamp: number }[];
}

interface ErrorEntry {
  message: string;
  stack?: string;
  timestamp: number;
  url?: string;
  line?: number;
  column?: number;
}

class ClientMonitor {
  private static _instance: ClientMonitor;
  private _metrics: PerformanceMetrics = {
    pageLoadTime: 0,
    domContentLoadedTime: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    timeToInteractive: 0,
    apiResponseTimes: [],
  };
  private _errors: ErrorEntry[] = [];

  // Error batching configuration
  private _errorBatch: ErrorEntry[] = [];
  private _errorBatchTimer: NodeJS.Timeout | null = null;
  private readonly _errorBatchInterval = ERROR_BATCH_INTERVAL_MS;
  private readonly _maxBatchSize = MAX_BATCH_SIZE;
  
  // Metrics debouncing
  private _metricsDebounceTimer: NodeJS.Timeout | null = null;
  private readonly _metricsDebounceDelay = METRICS_DEBOUNCE_DELAY_MS;
  private _isAuthenticating = false;

  // Rate limiting configuration
  private _errorsSentInWindow = 0;
  private _rateLimitWindowStart = Date.now();
  private readonly _rateLimitWindow = RATE_LIMIT_WINDOW_MS;
  private readonly _maxErrorsPerWindow = MAX_ERRORS_PER_WINDOW;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initializePerformanceObserver();
      this.initializeErrorTracking();
      this.measurePageLoadMetrics();

      // Clean up on page unload
      window.addEventListener('beforeunload', () => {
        void this.flushErrorBatch();
      });
    }
  }

  static getInstance(): ClientMonitor {
    if (!ClientMonitor._instance) {
      ClientMonitor._instance = new ClientMonitor();
    }
    return ClientMonitor._instance;
  }

  private initializePerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      // Observe paint timing
      const paintObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            this._metrics.firstContentfulPaint = entry.startTime;
          }
        });
      });
      paintObserver.observe({ entryTypes: ['paint'] });

      // Observe Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this._metrics.largestContentfulPaint = lastEntry.startTime;
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    }
  }

  private _initializeErrorTracking(): void {
    window.addEventListener('error', (event) => {
      const sanitizedError = {
        message: this._sanitizeErrorMessage(event.message),
        stack: this._sanitizeStackTrace(event.error?.stack),
        timestamp: Date.now(),
        url: this._sanitizeUrl(event.filename),
        line: event.lineno,
        column: event.colno,
      };

      this._errors.push(sanitizedError);

      // Keep only last MAX_STORED_ERRORS errors
      if (this._errors.length > MAX_STORED_ERRORS) {
        this._errors.shift();
      }

      // Add to batch instead of sending immediately
      this._addErrorToBatch(sanitizedError);
    });

    window.addEventListener('unhandledrejection', (event) => {
      const sanitizedError = {
        message: this._sanitizeErrorMessage(`Unhandled Promise Rejection: ${String(event.reason)}`),
        stack: this._sanitizeStackTrace(event.reason?.stack),
        timestamp: Date.now(),
      };

      this._errors.push(sanitizedError);

      // Add to batch instead of sending immediately
      this._addErrorToBatch(sanitizedError);
    });
  }

  private _measurePageLoadMetrics(): void {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;

      if (navigation) {
        this._metrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
        this._metrics.domContentLoadedTime =
          navigation.domContentLoadedEventEnd - navigation.fetchStart;

        // Estimate Time to Interactive
        this._metrics.timeToInteractive = navigation.domInteractive - navigation.fetchStart;
      }

      // Send initial metrics after page load
      setTimeout(() => {
        void this._sendMetricsToServer();
      }, METRICS_SEND_DELAY_MS);
    });
  }

  // Track API response times
  trackApiCall(endpoint: string, duration: number): void {
    // Skip tracking during authentication to prevent loops
    if (this._isAuthenticating || endpoint.includes('/auth/')) {
      return;
    }
    
    this._metrics.apiResponseTimes.push({
      endpoint,
      duration,
      timestamp: Date.now(),
    });

    // Keep only last MAX_STORED_API_CALLS API calls
    if (this._metrics.apiResponseTimes.length > MAX_STORED_API_CALLS) {
      this._metrics.apiResponseTimes.shift();
    }

    // Use debounced sending instead of sending every 10 calls
    this._debouncedSendMetrics();
  }
  
  private _debouncedSendMetrics(): void {
    // Clear existing timer
    if (this._metricsDebounceTimer) {
      clearTimeout(this._metricsDebounceTimer);
    }
    
    // Set new timer
    this._metricsDebounceTimer = setTimeout(() => {
      void this._sendMetricsToServer();
    }, this._METRICS_DEBOUNCE_DELAY);
  }

  // Intercept fetch to track API calls
  interceptFetch(): void {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const start = performance.now();
      const url = args[0] instanceof Request ? args[0].url : args[0].toString();
      
      // Detect authentication flow
      if (url.includes('/api/auth/') || url.includes('/auth/')) {
        this._isAuthenticating = true;
        // Reset flag after a delay
        setTimeout(() => {
          this._isAuthenticating = false;
        }, AUTH_TIMEOUT_MS);
      }

      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - start;

        if (url.includes('/api/') && !url.includes('/api/monitoring/')) {
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

  private async _sendMetricsToServer(): Promise<void> {
    try {
      await fetch('/api/monitoring/client-metrics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          metrics: this._metrics,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      logger.error('Failed to send metrics:', error);
    }
  }

  // Sanitization methods
  private _sanitizeErrorMessage(message: string): string {
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

  private _sanitizeStackTrace(stack?: string): string | undefined {
    if (!stack) return undefined;

    return (
      stack
        // Remove local file paths that might contain usernames
        .replace(/\/Users\/[^/]+/g, '/Users/[USER]')
        .replace(/\/home\/[^/]+/g, '/home/[USER]')
        .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\[USER]')
        // Apply same PII sanitization as messages
        .split('\n')
        .map((line) => this._sanitizeErrorMessage(line))
        .join('\n')
    );
  }

  private _sanitizeUrl(url?: string): string | undefined {
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
  private _addErrorToBatch(error: ErrorEntry): void {
    // Check rate limit
    if (!this._checkRateLimit()) {
      logger.warn('Error rate limit exceeded, dropping error');
      return;
    }

    this._errorBatch.push(error);

    // Send immediately if batch is full
    if (this._errorBatch.length >= this._MAX_BATCH_SIZE) {
      void this._flushErrorBatch();
      return;
    }

    // Schedule batch send if not already scheduled
    if (!this._errorBatchTimer) {
      this._errorBatchTimer = setTimeout(() => {
        void this._flushErrorBatch();
      }, this._ERROR_BATCH_INTERVAL);
    }
  }

  private _checkRateLimit(): boolean {
    const now = Date.now();

    // Reset window if needed
    if (now - this._rateLimitWindowStart > this._RATE_LIMIT_WINDOW) {
      this._rateLimitWindowStart = now;
      this._errorsSentInWindow = 0;
    }

    // Check if under limit
    return this._errorsSentInWindow < this._MAX_ERRORS_PER_WINDOW;
  }

  private async _flushErrorBatch(): Promise<void> {
    if (this._errorBatch.length === 0) return;

    // Clear timer
    if (this._errorBatchTimer) {
      clearTimeout(this._errorBatchTimer);
      this._errorBatchTimer = null;
    }

    // Get current batch and clear it
    const batch = [...this._errorBatch];
    this._errorBatch = [];

    // Update rate limit counter
    this._errorsSentInWindow += batch.length;

    try {
      await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          errors: batch,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
          url: this._sanitizeUrl(window.location.href),
          batchSize: batch.length,
        }),
      });
    } catch (err) {
      logger.error('Failed to send error batch:', err);
      // Don't re-add to batch to prevent infinite loop
    }
  }

  getMetrics(): {
    pageLoadTime: number;
    domContentLoadedTime: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    timeToInteractive: number;
    apiResponseTimes: { endpoint: string; duration: number; timestamp: number }[];
    errors: ErrorEntry[];
    errorCount: number;
  } {
    return {
      ...this._metrics,
      errors: this._errors,
      errorCount: this._errors.length,
    };
  }
}

// Initialize monitoring when imported
if (typeof window !== 'undefined') {
  const monitor = ClientMonitor.getInstance();
  monitor.interceptFetch();
}

export { ClientMonitor };
