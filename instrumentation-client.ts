import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN && typeof window !== 'undefined') {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',

    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Profile sample rate (1% of traces in production)
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 1.0,
    
    // Performance monitoring options
    enableLongAnimationFrameInstrumentation: true,
    enableInp: true, // Interaction to Next Paint
    
    // Track specific performance metrics
    _experiments: {
      metricsAggregator: true,
    },

    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Release tracking
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

    // Integrations
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        maskAllInputs: true,
        // Mask sensitive content
        mask: ['.sensitive', '[data-sensitive]'],
        block: ['.no-capture', '[data-no-capture]'],
      }),
      Sentry.browserTracingIntegration({
        // Enable automatic pageload transaction
        enableLongTask: true,
        enableInp: true,
        // Track slow navigation
        idleTimeout: 3000,
        // Track backend fetches
        traceFetch: true,
        traceXHR: true,
        // Sample backend based on frontend decision
        shouldCreateSpanForRequest: (url) => {
          // Don't create spans for health checks
          if (url.includes('/api/health')) return false;
          // Don't create spans for monitoring endpoints
          if (url.includes('/api/monitoring')) return false;
          return true;
        },
      }),
      // Performance monitoring for specific operations
      Sentry.httpIntegration({
        tracing: true,
      }),
    ],

    // Filtering
    beforeSend(event, hint) {
      // Filter out certain errors
      if (event.exception) {
        const error = hint.originalException;

        // Filter out network errors that are expected
        if (error && error instanceof Error) {
          if (
            error.message?.includes('Network request failed') ||
            error.message?.includes('Failed to fetch')
          ) {
            return null;
          }
        }

        // Filter out browser extension errors
        if (
          event.exception.values?.[0]?.stacktrace?.frames?.some(
            (frame) =>
              frame.filename?.includes('extension://') ||
              frame.filename?.includes('chrome-extension://'),
          )
        ) {
          return null;
        }
      }

      // Remove PII from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.category === 'navigation' && breadcrumb.data?.to) {
            // Remove query parameters from navigation
            breadcrumb.data.to = breadcrumb.data.to.split('?')[0];
          }
          return breadcrumb;
        });
      }

      return event;
    },

    // Configure breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filter out certain breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }

      // Remove sensitive data from fetch breadcrumbs
      if (breadcrumb.category === 'fetch' && breadcrumb.data) {
        if (breadcrumb.data.url?.includes('/api/auth')) {
          breadcrumb.data = { url: '[REDACTED_AUTH_URL]' };
        }
      }

      return breadcrumb;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Browser errors
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',

      // Network errors
      'NetworkError',
      'Network request failed',
      'Failed to fetch',

      // Extension errors
      'Extension context invalidated',
      'Message manager disconnected',

      // User-caused errors
      'User cancelled',
      'User denied',
    ],

    // Deny list for transactions
    denyUrls: [
      // Chrome extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,

      // Other browser extensions
      /^moz-extension:\/\//i,
      /^ms-browser-extension:\/\//i,
    ],
  });
}

// Export function for router transition tracking
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;