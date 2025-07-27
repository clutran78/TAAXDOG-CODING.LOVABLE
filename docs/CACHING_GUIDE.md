# Caching Guide for TAAXDOG API

This guide explains the caching implementation for improving API performance and reducing database load.

## Overview

The caching system uses Redis to cache expensive operations including:
- Database queries with complex aggregations
- AI operation results
- External API responses (Basiq, Stripe)
- User dashboard data
- Financial calculations

## Cache Infrastructure

### 1. Redis Client (`lib/services/cache/redisClient.ts`)
- Handles Redis connection and basic operations
- Graceful fallback if Redis is unavailable
- Automatic reconnection with exponential backoff

### 2. Cache Manager (`lib/services/cache/cacheManager.ts`)
- High-level caching operations
- Cache key generation utilities
- Cache invalidation strategies
- Cache warming for common queries

### 3. API Cache Helper (`lib/services/cache/apiCache.ts`)
- Simplified caching for API endpoints
- Automatic cache key generation
- Built-in cache headers
- Type-safe caching operations

## Cache TTL Strategy

```typescript
export const CacheTTL = {
  SHORT: 60,        // 1 minute - for frequently changing data
  MEDIUM: 300,      // 5 minutes - for user profiles, goals
  LONG: 3600,       // 1 hour - for analytics, reports
  DAY: 86400,       // 24 hours - for AI results, rarely changing data
  WEEK: 604800,     // 7 days - for historical data
};
```

## Implementation Examples

### 1. Caching AI Insights

```typescript
// pages/api/ai/insights.ts
const insights = await cacheManager.remember(
  cacheKey,
  CacheTTL.DAY, // 24 hours cache
  async () => {
    // This function only runs on cache miss
    const data = await generateInsights(userId, type);
    return data;
  }
);
```

### 2. Caching Dashboard Data

```typescript
// pages/api/optimized/user-dashboard-cached.ts
const dashboardData = await cacheManager.remember(
  `dashboard:${userId}:full`,
  CacheTTL.SHORT, // 1 minute cache
  async () => {
    // Fetch all dashboard data
    const [user, transactions, goals] = await Promise.all([
      // ... database queries
    ]);
    return processedData;
  }
);
```

### 3. Caching External API Responses

```typescript
// Cache Basiq transaction data
const transactions = await ApiCache.cacheExternalApi(
  'basiq',
  userId,
  'transactions',
  queryParams,
  async () => {
    // Fetch from Basiq API
    return await basiqClient.getTransactions(userId);
  },
  CacheTTL.LONG // 1 hour
);
```

## Cache Invalidation

### Automatic Invalidation Middleware

```typescript
// Use cache invalidation middleware for mutations
export default withCacheInvalidation(
  CacheInvalidationPatterns.transactionMutation
)(handler);
```

### Manual Invalidation

```typescript
// Invalidate specific cache types
await ApiCache.invalidateOnChange(userId, 'transaction');
await ApiCache.invalidateOnChange(userId, 'goal');
await ApiCache.invalidateOnChange(userId, 'all'); // Clear all user caches
```

### Invalidation Patterns

1. **Transaction Changes**: Clear transaction, financial summary, and dashboard caches
2. **Goal Changes**: Clear goal and dashboard caches
3. **Account Changes**: Clear banking and dashboard caches
4. **Budget Changes**: Clear budget and AI insight caches

## Cache Headers

The system automatically sets cache headers:

```
X-Cache: HIT | MISS | POTENTIAL-HIT
X-Cache-Key: The cache key used
X-Cache-TTL: Cache duration in seconds
```

## Best Practices

### 1. Cache Key Design
- Include user ID for user-specific data
- Use consistent naming: `resource:userId:identifier`
- Hash complex parameters for shorter keys

### 2. Cache Warming
```typescript
// Warm cache after user login
await ApiCache.warmCache(userId, {
  transactions: recentTransactions,
  goals: activeGoals,
  financialSummary: summary,
});
```

### 3. Conditional Caching
```typescript
// Support cache refresh via query parameter
if (req.query.refresh === 'true') {
  await cacheManager.invalidateUserCache(userId);
}
```

### 4. Error Handling
- Cache operations should never break the main flow
- Log cache errors but continue with fresh data
- Implement fallback for Redis unavailability

## Performance Considerations

### 1. Batch Operations
```typescript
// Cache multiple related queries together
const [goals, transactions] = await Promise.all([
  cacheManager.remember(goalKey, TTL, fetchGoals),
  cacheManager.remember(txnKey, TTL, fetchTransactions),
]);
```

### 2. Granular Caching
- Cache at the most granular level possible
- Use separate keys for different query parameters
- Cache aggregations separately from raw data

### 3. Cache Stampede Prevention
The `remember` function prevents cache stampedes by ensuring only one request fetches fresh data while others wait.

## Monitoring

### Cache Hit Rate
Monitor cache effectiveness:
```typescript
// Log cache hits/misses
logger.info('Cache access', {
  key: cacheKey,
  hit: cached !== null,
  ttl: remainingTTL,
});
```

### Redis Connection Health
```typescript
// Check Redis connection status
const isConnected = cacheInstance.isConnected;
```

## Environment Configuration

Required environment variables:
```env
REDIS_URL=redis://localhost:6379
# or for production
REDIS_URL=redis://user:password@host:port
```

## Troubleshooting

### Common Issues

1. **Cache not working**: Check Redis connection and logs
2. **Stale data**: Verify invalidation is triggered on mutations
3. **Memory issues**: Monitor Redis memory usage and implement eviction policies
4. **Slow cache operations**: Check network latency to Redis server

### Debug Mode
Enable detailed logging:
```typescript
logger.debug('Cache operation', {
  operation: 'get',
  key: cacheKey,
  result: hit ? 'HIT' : 'MISS',
});
```

## Future Improvements

1. **Tagged Cache Invalidation**: Implement cache tags for more granular invalidation
2. **Distributed Caching**: Support Redis Cluster for high availability
3. **Cache Analytics**: Build dashboard for cache performance metrics
4. **Smart TTL**: Adjust TTL based on access patterns
5. **Compression**: Compress large cached values to save memory