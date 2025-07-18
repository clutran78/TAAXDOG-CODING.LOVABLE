// Client-side performance monitoring
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
    apiResponseTimes: []
  };
  private errors: Array<{
    message: string;
    stack?: string;
    timestamp: number;
    url?: string;
    line?: number;
    column?: number;
  }> = [];

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initializePerformanceObserver();
      this.initializeErrorTracking();
      this.measurePageLoadMetrics();
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
      this.errors.push({
        message: event.message,
        stack: event.error?.stack,
        timestamp: Date.now(),
        url: event.filename,
        line: event.lineno,
        column: event.colno
      });
      
      // Keep only last 100 errors
      if (this.errors.length > 100) {
        this.errors.shift();
      }
      
      // Send to server
      this.sendErrorToServer({
        message: event.message,
        stack: event.error?.stack,
        url: event.filename,
        line: event.lineno,
        column: event.colno
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.errors.push({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        timestamp: Date.now()
      });
      
      // Send to server
      this.sendErrorToServer({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack
      });
    });
  }

  private measurePageLoadMetrics() {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (navigation) {
        this.metrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
        this.metrics.domContentLoadedTime = navigation.domContentLoadedEventEnd - navigation.fetchStart;
        
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
      timestamp: Date.now()
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
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.error('Failed to send metrics:', error);
    }
  }

  private async sendErrorToServer(error: any) {
    try {
      await fetch('/api/monitoring/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
          url: window.location.href
        })
      });
    } catch (err) {
      console.error('Failed to send error:', err);
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      errors: this.errors,
      errorCount: this.errors.length
    };
  }
}

// Initialize monitoring when imported
if (typeof window !== 'undefined') {
  const monitor = ClientMonitor.getInstance();
  monitor.interceptFetch();
}

export { ClientMonitor };