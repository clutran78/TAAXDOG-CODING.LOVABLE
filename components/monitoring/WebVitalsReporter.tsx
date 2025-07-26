'use client';

import { useEffect } from 'react';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import { trackWebVital } from '@/lib/monitoring/sentry-performance';

/**
 * Component that tracks and reports Web Vitals to Sentry
 */
export function WebVitalsReporter() {
  useEffect(() => {
    // Report Web Vitals to Sentry
    onCLS((metric) => trackWebVital('CLS', metric.value));
    onFCP((metric) => trackWebVital('FCP', metric.value));
    onINP((metric) => trackWebVital('INP', metric.value));
    onLCP((metric) => trackWebVital('LCP', metric.value));
    onTTFB((metric) => trackWebVital('TTFB', metric.value));

    // Track additional performance metrics
    if (typeof window !== 'undefined') {
      // Track page load time
      window.addEventListener('load', () => {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        trackWebVital('PageLoad', loadTime);
      });

      // Track time to interactive
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'measure' && entry.name === 'Next.js-route-change-complete') {
                trackWebVital('RouteChange', entry.duration);
              }
            }
          });
          observer.observe({ entryTypes: ['measure'] });
        } catch (e) {
          // Some browsers don't support this
        }
      }
    }
  }, []);

  return null;
}

export default WebVitalsReporter;