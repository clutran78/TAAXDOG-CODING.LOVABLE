import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import { Suspense, lazy, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { performanceMonitor } from '../lib/monitoring/performance';
import { ReactQueryProvider } from '../providers/react-query-provider';

// Lazy load ErrorBoundary with loading fallback
const ErrorBoundary = dynamic(
  () => import('../components/ErrorBoundary').then((mod) => ({ default: mod.ErrorBoundary })),
  {
    loading: () => <div className="min-h-screen flex items-center justify-center">Loading...</div>,
    ssr: true,
  },
);

// Lazy load client monitoring (non-critical)
const ClientMonitor = dynamic(() => import('../components/monitoring/ClientMonitorWrapper'), {
  ssr: false,
  loading: () => null,
});

// Lazy load Web Vitals reporter
const WebVitalsReporter = dynamic(() => import('../components/monitoring/WebVitalsReporter'), {
  ssr: false,
  loading: () => null,
});

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const router = useRouter();

  // Prefetch important routes on mount
  useEffect(() => {
    const prefetchRoutes = ['/dashboard', '/transactions', '/banking'];
    prefetchRoutes.forEach((route) => {
      router.prefetch(route);
    });
  }, [router]);

  // Track app-level performance metrics
  useEffect(() => {
    // Track initial app load
    performanceMonitor.setCustomMetric('appMounted', performance.now());

    // Track memory usage if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      performanceMonitor.setCustomMetric('jsHeapUsed', Math.round(memory.usedJSHeapSize / 1048576));
      performanceMonitor.setCustomMetric(
        'jsHeapTotal',
        Math.round(memory.totalJSHeapSize / 1048576),
      );
    }

    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              performanceMonitor.trackInteraction('long-task', `${Math.round(entry.duration)}ms`);
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });

        return () => {
          longTaskObserver.disconnect();
        };
      } catch (e) {
        // Some browsers don't support longtask
      }
    }
  }, []);

  return (
    <SessionProvider session={session}>
      <ReactQueryProvider>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Component {...pageProps} />
            <ClientMonitor />
            <WebVitalsReporter />
          </Suspense>
        </ErrorBoundary>
      </ReactQueryProvider>
    </SessionProvider>
  );
}
