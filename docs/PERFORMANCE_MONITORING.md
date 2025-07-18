# Performance Monitoring System

This document describes the comprehensive performance monitoring system implemented for TAAXDOG.

## Overview

The monitoring system tracks:
- Database query performance
- API endpoint response times
- System resource usage (memory, CPU)
- Client-side performance metrics
- Application errors

## Components

### 1. Database Monitoring (`lib/monitoring/database.ts`)
- Tracks all database queries
- Identifies slow queries (>100ms)
- Monitors connection pool usage
- Analyzes query patterns

### 2. API Monitoring (`lib/monitoring/api.ts`)
- Tracks response times per endpoint
- Monitors error rates
- Tracks request volume
- Identifies slow and error-prone endpoints

### 3. Application Monitoring (`lib/monitoring/application.ts`)
- Monitors memory usage
- Tracks CPU utilization
- Cache performance metrics
- System resource trends

### 4. Client Monitoring (`lib/monitoring/client.ts`)
- Page load times
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- API response times from browser
- JavaScript errors

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the monitoring setup:
   ```bash
   npm run monitoring:setup
   ```

3. The logs directory will be created with appropriate .gitignore

## Usage

### API Endpoints

Wrap your API handlers with monitoring:

```typescript
import { withApiMonitoring } from '@/lib/monitoring';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Your API logic
}

export default withApiMonitoring(handler);
```

### Database Queries

Use the monitored Prisma client:

```typescript
import { prisma } from '@/lib/db/monitoredPrisma';

// All queries will be automatically monitored
const users = await prisma.user.findMany();
```

### Performance Tracking

Track specific operations:

```typescript
import { withPerformanceMonitoring } from '@/lib/monitoring';

const result = await withPerformanceMonitoring('operation-name', async () => {
  // Your operation
  return someAsyncOperation();
});
```

### Cache Monitoring

```typescript
import { ApplicationMonitor } from '@/lib/monitoring';

const monitor = ApplicationMonitor.getInstance();

// Record cache operations
monitor.recordCacheHit('cache-name');
monitor.recordCacheMiss('cache-name');
monitor.updateCacheSize('cache-name', size);
```

## Dashboard

Access the performance dashboard at: `/admin/performance`

Features:
- Real-time metrics
- Historical data visualization
- Slow query analysis
- API endpoint performance
- System resource graphs
- Cache hit rates

## Log Files

Monitoring data is stored in the following log files:
- `logs/db-queries.log` - All database queries
- `logs/slow-queries.log` - Queries taking >100ms
- `logs/api-requests.log` - All API requests
- `logs/api-errors.log` - API errors
- `logs/app-metrics.log` - System metrics
- `logs/client-metrics.log` - Browser performance
- `logs/client-errors.log` - Browser errors

## Alerts and Thresholds

Default thresholds:
- Slow queries: >100ms
- High memory usage: >80% heap utilization
- Slow page load: >3 seconds
- Poor LCP: >2.5 seconds

## Best Practices

1. **Always use monitored clients**: Use `monitoredPrisma` instead of raw Prisma client
2. **Wrap API handlers**: Use `withApiMonitoring` for all API endpoints
3. **Track important operations**: Use `withPerformanceMonitoring` for critical business logic
4. **Monitor client-side**: Import the client monitor in your app
5. **Review dashboard regularly**: Check for performance degradation
6. **Set up alerts**: Configure alerts for critical metrics

## Maintenance

- Logs are automatically cleaned up after 1 hour (configurable)
- Run `npm run audit:maintenance` to manually clean old logs
- Monitor disk space usage in production

## Performance Impact

The monitoring system has minimal performance impact:
- <1ms overhead for API monitoring
- <2ms overhead for database query tracking
- Asynchronous logging to avoid blocking
- Efficient in-memory metrics storage