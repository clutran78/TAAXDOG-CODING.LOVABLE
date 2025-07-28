export async function register() {
  // Apply server-side polyfills
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/polyfills/server-polyfills.js');
    // Server-side Sentry configuration
    const { ProfilingIntegration } = await import('@sentry/profiling-node');
    const Sentry = await import('@sentry/nextjs');
    
    const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
    
    if (SENTRY_DSN) {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',

        // Performance Monitoring
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        // Profile sample rate (1% of traces in production)
        profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 1.0,
        
        // Track slow DB queries
        slowQueryThreshold: 1000, // 1 second
        
        // Capture performance metrics
        _experiments: {
          metricsAggregator: true,
        },

        // Release tracking
        release: process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_SENTRY_RELEASE,

        // Server-specific options
        autoSessionTracking: true,

        // Integrations
        integrations: [
          // Capture unhandled promise rejections
          new Sentry.Integrations.OnUnhandledRejection({
            mode: 'warn',
          }),
          // Database query performance
          new Sentry.Integrations.Prisma({ client: true }),
          // HTTP request performance
          new Sentry.Integrations.Http({ tracing: true }),
          // Profiling integration
          new Sentry.ProfilingIntegration(),
        ],

        // Filtering
        beforeSend(event, hint) {
          // Filter out certain errors
          if (event.exception) {
            const error = hint.originalException;

            // Filter out expected database errors
            if (error && error instanceof Error) {
              if (
                error.message?.includes('P2002') || // Unique constraint
                error.message?.includes('P2025')
              ) {
                // Record not found
                return null;
              }
            }

            // Filter out rate limit errors
            if (event.exception.values?.[0]?.value?.includes('Rate limit exceeded')) {
              return null;
            }
          }

          // Remove sensitive headers
          if (event.request?.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
            delete event.request.headers['x-api-key'];
          }

          // Remove sensitive query parameters
          if (event.request?.url) {
            try {
              // Validate URL before parsing
              if (event.request.url && event.request.url !== 'https://') {
                const url = new URL(event.request.url);
                url.searchParams.delete('token');
                url.searchParams.delete('api_key');
                url.searchParams.delete('password');
                event.request.url = url.toString();
              }
            } catch (e) {
              // If URL parsing fails, leave it as is
              // This prevents Invalid URL errors from breaking the instrumentation
            }
          }

          return event;
        },

        // Configure breadcrumbs
        beforeBreadcrumb(breadcrumb) {
          // Filter out certain breadcrumbs
          if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
            return null;
          }

          // Remove sensitive data from http breadcrumbs
          if (breadcrumb.category === 'http' && breadcrumb.data) {
            if (breadcrumb.data.url?.includes('/api/auth')) {
              breadcrumb.data = {
                url: '[REDACTED_AUTH_URL]',
                method: breadcrumb.data.method,
                status_code: breadcrumb.data.status_code,
              };
            }
          }

          return breadcrumb;
        },

        // Ignore certain errors
        ignoreErrors: [
          // Expected errors
          'Invalid token',
          'Token expired',
          'Unauthorized',

          // Database errors that are handled
          'P2002',
          'P2025',

          // Rate limiting
          'Rate limit exceeded',
          'Too many requests',
        ],
      });
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime Sentry configuration
    const Sentry = await import('@sentry/nextjs');
    
    const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
    
    if (SENTRY_DSN) {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',

        // Performance Monitoring
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Release tracking
        release: process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_SENTRY_RELEASE,

        // Edge-specific configuration
        transportOptions: {
          // Reduce payload size for edge runtime
          maxValueLength: 250,
        },

        // Filtering
        beforeSend(event) {
          // Remove sensitive headers
          if (event.request?.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
            delete event.request.headers['x-api-key'];
          }

          return event;
        },
      });
    }
  }
}