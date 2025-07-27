import { getCLS, getFCP, getFID, getLCP, getTTFB, Metric } from 'web-vitals';
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
}

interface UserInteraction {
  type: string;
  target: string;
  timestamp: number;
  duration?: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private data: PerformanceData = {
    customMetrics: {},
    resourceTimings: [],
    userInteractions: [],
  };
  private interactionStartTimes = new Map<string, number>();
  private reportingEnabled = true;
  private reportingThreshold = 10; // Report after collecting 10 interactions
  private lastReportTime = 0;
  private reportingInterval = 30000; // Report at most every 30 seconds

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
    getCLS((metric) => {
      this.data.CLS = metric.value;
      this.maybeReport('cls');
    });

    // First Contentful Paint
    getFCP((metric) => {
      this.data.FCP = metric.value;
      this.maybeReport('fcp');
    });

    // First Input Delay
    getFID((metric) => {
      this.data.FID = metric.value;
      this.maybeReport('fid');
    });

    // Largest Contentful Paint
    getLCP((metric) => {
      this.data.LCP = metric.value;
      this.maybeReport('lcp');
    });

    // Time to First Byte
    getTTFB((metric) => {
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
    };

    try {
      await fetch('/api/monitoring/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      });

      // Clear interactions after successful report
      this.data.userInteractions = [];
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
