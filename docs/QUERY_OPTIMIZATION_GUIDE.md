# Query Optimization Guide

This guide explains the advanced query optimization features implemented in the TAAXDOG application.

## Overview

The optimization system includes:
1. **Query Batching** - Prevents N+1 query problems
2. **Materialized Views** - Pre-aggregated data for analytics
3. **Redis Caching** - Fast data retrieval with intelligent invalidation
4. **Connection Pool Optimization** - Optimal database connection management

## 1. Query Batching

### Problem Solved
N+1 queries occur when fetching related data in loops, causing performance degradation.

### Solution
Use Prisma's `include` and batch loading:

```typescript
// Before (N+1 problem)
const goals = await prisma.goal.findMany({ where: { userId } });
for (const goal of goals) {
  const transactions = await prisma.transaction.findMany({ 
    where: { goalId: goal.id } 
  });
}

// After (Single query with relations)
const goals = await getGoalsWithRelations(prisma, userId, true);
```

### Available Functions
- `getGoalsWithRelations()` - Fetch goals with user and transactions
- `getUserWithFullProfile()` - Complete user data in one query
- `getTransactionsWithRelations()` - Transactions with all related data

## 2. Materialized Views

### Views Created
1. **monthly_spending_summary** - Monthly spending by category
2. **tax_category_summary** - Tax deductible summaries
3. **goal_progress_analytics** - Goal progress calculations
4. **user_financial_summary** - User financial overview

### Usage Example
```typescript
const viewQueries = new ViewQueries(prisma);
const monthlyData = await viewQueries.getMonthlySpending(userId);
```

### Refresh Schedule
Views are refreshed daily at 2 AM. Manual refresh:
```bash
npm run optimize:views:refresh
```

## 3. Redis Caching

### Configuration
```env
REDIS_URL=redis://localhost:6379
```

### Cache Keys Pattern
- User data: `user:{userId}:profile`
- Transactions: `user:{userId}:transactions:page:{page}`
- Analytics: `analytics:{userId}:spending:{year}:{month}`

### Cache Manager Usage
```typescript
const cacheManager = await getCacheManager();

// Remember pattern - automatically caches
const data = await cacheManager.remember(
  CacheKeys.userProfile(userId),
  CacheTTL.MEDIUM,
  async () => fetchUserData()
);

// Invalidate on updates
await cacheManager.invalidateUserCache(userId);
```

### Cache TTL Values
- SHORT: 60s (frequently changing data)
- MEDIUM: 5 minutes (user profiles)
- LONG: 1 hour (analytics)
- DAY: 24 hours (historical data)

## 4. Connection Pool Optimization

### Optimal Settings
```env
# Production (20-30 connections)
DB_POOL_SIZE=20

# Development (5-10 connections)
DB_POOL_SIZE=5
```

### Health Monitoring
```typescript
// Check pool metrics
const metrics = await connectionPoolUtils.getPoolMetrics();

// Monitor health
const health = healthMonitor.getHealthStatus();
```

## API Endpoints

### Optimized Endpoints
1. **User Dashboard** - `/api/optimized/user-dashboard`
   - Batched queries
   - Redis caching
   - Materialized views

2. **Paginated Transactions** - `/api/optimized/transactions-paginated`
   - Efficient pagination
   - Filter caching
   - Relation loading

3. **Spending Analytics** - `/api/optimized/spending-analytics`
   - Pre-aggregated data
   - Trend analysis
   - Predictions

4. **Health Check** - `/api/optimized/health-check`
   - Database health
   - Cache status
   - Pool metrics

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install redis @types/redis
   ```

2. **Apply Database Optimizations**
   ```bash
   npm run optimize:apply
   ```

3. **Start Redis**
   ```bash
   docker run -d -p 6379:6379 redis:alpine
   ```

4. **Configure Environment**
   ```env
   REDIS_URL=redis://localhost:6379
   DB_POOL_SIZE=20
   HEALTH_CHECK_TOKEN=your-secure-token
   ```

## Performance Monitoring

### Query Performance
Monitor slow queries in development:
```typescript
// Automatically logged if query > 100ms
```

### Cache Hit Rates
```bash
curl http://localhost:3000/api/optimized/health-check \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Database Metrics
```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Cache hit ratio
SELECT sum(blks_hit)::float / (sum(blks_hit) + sum(blks_read)) * 100 
FROM pg_stat_database;
```

## Best Practices

1. **Always use batched queries** for related data
2. **Cache user-specific data** with appropriate TTLs
3. **Invalidate caches** on data mutations
4. **Monitor connection pool** usage
5. **Refresh views** during low-traffic periods

## Troubleshooting

### High Query Times
1. Check for missing indexes
2. Analyze query execution plans
3. Consider increasing cache TTL

### Connection Pool Exhaustion
1. Increase pool size
2. Reduce query execution time
3. Check for connection leaks

### Cache Misses
1. Verify Redis connectivity
2. Check invalidation logic
3. Monitor cache key patterns

## Maintenance

### Daily Tasks
- View refresh (automated)
- Cache warm-up on deploy

### Weekly Tasks
- Analyze slow queries
- Review cache hit rates
- Check pool efficiency

### Monthly Tasks
- Update table statistics
- Review index usage
- Optimize view definitions