import { useEffect, useRef } from 'react';
import { performanceMonitor } from '../lib/monitoring/performance';

interface UsePerformanceTrackingOptions {
  componentName: string;
  trackRenderTime?: boolean;
  trackMountTime?: boolean;
  trackInteractions?: boolean;
  customMetrics?: Record<string, number>;
}

export function usePerformanceTracking({
  componentName,
  trackRenderTime = true,
  trackMountTime = true,
  trackInteractions = false,
  customMetrics = {},
}: UsePerformanceTrackingOptions) {
  const renderStartTime = useRef<number>(performance.now());
  const isMounted = useRef(false);

  // Track render time
  if (trackRenderTime) {
    const renderTime = performance.now() - renderStartTime.current;
    performanceMonitor.setCustomMetric(`${componentName}_renderTime`, Math.round(renderTime));
  }

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;

      // Track mount time
      if (trackMountTime) {
        const mountTime = performance.now() - renderStartTime.current;
        performanceMonitor.setCustomMetric(`${componentName}_mountTime`, Math.round(mountTime));
      }

      // Track custom metrics
      Object.entries(customMetrics).forEach(([key, value]) => {
        performanceMonitor.setCustomMetric(`${componentName}_${key}`, value);
      });

      // Track component mount interaction
      if (trackInteractions) {
        performanceMonitor.trackInteraction('component-mount', componentName);
      }
    }

    return () => {
      if (trackInteractions) {
        performanceMonitor.trackInteraction('component-unmount', componentName);
      }
    };
  }, [componentName, trackMountTime, trackInteractions, customMetrics]);

  // Utility functions for component-specific tracking
  const trackEvent = (eventName: string, value?: string) => {
    performanceMonitor.trackInteraction(`${componentName}_${eventName}`, value || 'triggered');
  };

  const startMeasure = (measureName: string) => {
    performanceMonitor.startMeasure(`${componentName}_${measureName}`);
  };

  const endMeasure = (measureName: string) => {
    performanceMonitor.endMeasure(`${componentName}_${measureName}`);
  };

  const setMetric = (metricName: string, value: number) => {
    performanceMonitor.setCustomMetric(`${componentName}_${metricName}`, value);
  };

  return {
    trackEvent,
    startMeasure,
    endMeasure,
    setMetric,
  };
}
