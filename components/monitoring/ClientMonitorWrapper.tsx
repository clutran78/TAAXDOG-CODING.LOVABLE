import { useEffect } from 'react';
import { ClientMonitor } from '../../lib/monitoring/client';
import { performanceMonitor } from '../../lib/monitoring/performance';
import { useRouter } from 'next/router';
import { logger } from '@/lib/logger';

export default function ClientMonitorWrapper() {
  const router = useRouter();

  useEffect(() => {
    // Initialize client monitoring
    const monitor = ClientMonitor.getInstance();
    monitor.interceptFetch();

    // Initialize performance monitoring
    const perfMonitor = performanceMonitor;

    // Track route changes
    const handleRouteChangeStart = (url: string) => {
      perfMonitor.startMeasure('routeChange');
      perfMonitor.trackInteraction('navigation', url);
    };

    const handleRouteChangeComplete = (url: string) => {
      perfMonitor.endMeasure('routeChange');
    };

    const handleRouteChangeError = (err: { cancelled: boolean; url: string }, url: string) => {
      perfMonitor.endMeasure('routeChange');
      logger.error(`Error loading route ${url}:`, err);
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    router.events.on('routeChangeError', handleRouteChangeError);

    // Track initial page view
    perfMonitor.trackInteraction('pageview', router.pathname);

    // Clean up on unmount
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
      router.events.off('routeChangeError', handleRouteChangeError);
    };
  }, [router]);

  // This component doesn't render anything
  return null;
}
