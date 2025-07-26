# Sentry Performance Monitoring Guide

## Overview

This guide describes how to use Sentry performance monitoring in the TAAXDOG application. The integration tracks Web Vitals, API performance, database queries, and custom metrics.

## Setup

### Environment Variables

Ensure these environment variables are set:

```bash
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_ENVIRONMENT=production|staging|development
SENTRY_RELEASE=your_release_version
```

### Configuration Files

- **`sentry.client.config.ts`**: Browser performance monitoring
- **`sentry.server.config.ts`**: Server-side performance monitoring
- **`sentry.edge.config.ts`**: Edge runtime monitoring

## Features

### 1. Web Vitals Tracking

Automatically tracks Core Web Vitals:
- **LCP** (Largest Contentful Paint)
- **FID** (First Input Delay) / **INP** (Interaction to Next Paint)
- **CLS** (Cumulative Layout Shift)
- **FCP** (First Contentful Paint)
- **TTFB** (Time to First Byte)

The `WebVitalsReporter` component is automatically included in `_app.tsx`.

### 2. API Performance Monitoring

Use the `withPerformanceMonitoring` middleware for API routes:

```typescript
import { withPerformanceMonitoring } from '@/lib/middleware/performance';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Your API logic
}

export default withPerformanceMonitoring(handler, {
  enableTracing: true,
  trackSlowQueries: true,
  slowQueryThreshold: 1000, // ms
});
```

### 3. Custom Performance Metrics

Use the `SentryPerformanceMonitor` utilities:

```typescript
import { 
  trackMetric, 
  measureAsync,
  trackDatabaseQuery,
  trackCacheOperation 
} from '@/lib/monitoring/sentry-performance';

// Track custom metrics
trackMetric({
  name: 'custom.operation',
  value: 123,
  unit: 'millisecond',
  tags: { type: 'important' }
});

// Measure async operations
const result = await measureAsync('fetchUserData', async () => {
  return await fetchUser(userId);
});

// Track database queries
const startTime = performance.now();
const data = await prisma.user.findMany();
trackDatabaseQuery('findMany', performance.now() - startTime, 'user');

// Track cache operations
trackCacheOperation('hit', 'user:123', 5);
```

### 4. Transaction Monitoring

Create transactions for complex operations:

```typescript
import { startTransaction } from '@/lib/monitoring/sentry-performance';

const transaction = startTransaction('process-payment', 'payment');

try {
  // Start spans for sub-operations
  const validationSpan = transaction.startChild({
    op: 'validation',
    description: 'Validate payment data',
  });
  
  await validatePayment(data);
  validationSpan.finish();

  const chargeSpan = transaction.startChild({
    op: 'stripe',
    description: 'Charge credit card',
  });
  
  await stripe.charges.create(chargeData);
  chargeSpan.finish();

  transaction.setStatus('ok');
} catch (error) {
  transaction.setStatus('internal_error');
  throw error;
} finally {
  transaction.finish();
}
```

## Performance Thresholds

### Web Vitals Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP    | ≤2.5s | ≤4s | >4s |
| FID/INP| ≤100ms | ≤300ms | >300ms |
| CLS    | ≤0.1 | ≤0.25 | >0.25 |
| FCP    | ≤1.8s | ≤3s | >3s |
| TTFB   | ≤800ms | ≤1800ms | >1800ms |

### API Performance Thresholds

- **Fast**: <200ms
- **Normal**: 200-1000ms
- **Slow**: >1000ms
- **Critical**: >3000ms

## Monitoring Dashboard

Access your performance data in Sentry:

1. Go to Performance section in Sentry dashboard
2. View transactions, Web Vitals, and custom metrics
3. Set up alerts for performance degradation
4. Analyze performance trends over time

## Best Practices

1. **Sample Rates**: Use lower sample rates in production (10% traces, 1% profiles)
2. **Sensitive Data**: Never include PII in performance metrics
3. **Custom Metrics**: Use descriptive names and consistent units
4. **Transactions**: Keep transaction names consistent and meaningful
5. **Spans**: Create spans for operations >50ms

## Debugging Performance Issues

1. Check Sentry Performance dashboard for slow transactions
2. Look for performance bottlenecks in traces
3. Review Web Vitals scores and trends
4. Analyze custom metrics for anomalies
5. Use profiling data to identify CPU-intensive operations

## Common Issues

### High Memory Usage
- Monitor with `trackMemoryUsage()`
- Look for memory leaks in long-running operations
- Check for large data structures in state

### Slow API Responses
- Enable query logging with `trackSlowQueries`
- Check database query performance
- Look for N+1 query problems
- Review external API call times

### Poor Web Vitals
- Optimize largest images (LCP)
- Reduce JavaScript execution time (INP)
- Minimize layout shifts (CLS)
- Implement proper loading states

## Additional Resources

- [Sentry Performance Monitoring Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/performance/)
- [Web Vitals Documentation](https://web.dev/vitals/)
- [Next.js Performance Guide](https://nextjs.org/docs/advanced-features/measuring-performance)