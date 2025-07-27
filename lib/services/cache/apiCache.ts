import { getCacheManager, CacheTTL } from './cacheManager';
import { NextApiResponse } from 'next';
import crypto from 'crypto';

/**
 * API Cache Helper for expensive operations
 * Provides caching with automatic cache key generation and invalidation
 */
export class ApiCache {
  /**
   * Create a cache key from request parameters
   */
  static generateCacheKey(
    prefix: string,
    userId: string,
    params: Record<string, any> = {},
  ): string {
    // Sort params to ensure consistent cache keys
    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (acc, key) => {
          if (params[key] !== undefined && params[key] !== null) {
            acc[key] = params[key];
          }
          return acc;
        },
        {} as Record<string, any>,
      );

    // Create a hash of the params for shorter keys
    const paramsHash =
      Object.keys(sortedParams).length > 0
        ? crypto
            .createHash('md5')
            .update(JSON.stringify(sortedParams))
            .digest('hex')
            .substring(0, 8)
        : 'default';

    return `${prefix}:${userId}:${paramsHash}`;
  }

  /**
   * Cache wrapper for API endpoints
   */
  static async cacheResponse<T>(
    cacheKey: string,
    ttl: number,
    fetcher: () => Promise<T>,
    options: {
      res?: NextApiResponse;
      forceRefresh?: boolean;
      userId?: string;
    } = {},
  ): Promise<T> {
    const cacheManager = await getCacheManager();

    // Force refresh if requested
    if (options.forceRefresh && options.userId) {
      await cacheManager.invalidateUserCache(options.userId);
    }

    // Use cache manager's remember function
    const data = await cacheManager.remember(cacheKey, ttl, fetcher);

    // Set cache headers if response object provided
    if (options.res) {
      options.res.setHeader('X-Cache-Key', cacheKey);
      options.res.setHeader('X-Cache-TTL', ttl.toString());
      options.res.setHeader('X-Cache', options.forceRefresh ? 'MISS' : 'POTENTIAL-HIT');
    }

    return data;
  }

  /**
   * Cache transaction data with smart invalidation
   */
  static async cacheTransactions(
    userId: string,
    query: any,
    fetcher: () => Promise<any>,
    options: { res?: NextApiResponse } = {},
  ) {
    const cacheKey = this.generateCacheKey('transactions', userId, query);

    return this.cacheResponse(
      cacheKey,
      CacheTTL.SHORT, // 1 minute for transaction data
      fetcher,
      {
        ...options,
        forceRefresh: query.refresh === 'true',
        userId,
      },
    );
  }

  /**
   * Cache goal data
   */
  static async cacheGoals(
    userId: string,
    fetcher: () => Promise<any>,
    options: { res?: NextApiResponse } = {},
  ) {
    const cacheKey = `goals:${userId}:all`;

    return this.cacheResponse(
      cacheKey,
      CacheTTL.MEDIUM, // 5 minutes for goals
      fetcher,
      options,
    );
  }

  /**
   * Cache budget/financial summary data
   */
  static async cacheFinancialSummary(
    userId: string,
    period: string,
    fetcher: () => Promise<any>,
    options: { res?: NextApiResponse } = {},
  ) {
    const cacheKey = `financial:${userId}:${period}`;

    return this.cacheResponse(
      cacheKey,
      CacheTTL.MEDIUM, // 5 minutes for financial summaries
      fetcher,
      options,
    );
  }

  /**
   * Cache AI operation results
   */
  static async cacheAIOperation(
    userId: string,
    operation: string,
    params: any,
    fetcher: () => Promise<any>,
    options: { res?: NextApiResponse } = {},
  ) {
    const cacheKey = this.generateCacheKey(`ai:${operation}`, userId, params);

    return this.cacheResponse(
      cacheKey,
      CacheTTL.DAY, // 24 hours for AI results
      fetcher,
      options,
    );
  }

  /**
   * Cache external API responses (Basiq, Stripe, etc)
   */
  static async cacheExternalApi(
    service: string,
    userId: string,
    endpoint: string,
    params: any,
    fetcher: () => Promise<any>,
    ttl: number = CacheTTL.LONG, // Default 1 hour
  ) {
    const cacheKey = this.generateCacheKey(`external:${service}:${endpoint}`, userId, params);

    return this.cacheResponse(cacheKey, ttl, fetcher);
  }

  /**
   * Invalidate caches when data changes
   */
  static async invalidateOnChange(
    userId: string,
    changeType: 'transaction' | 'goal' | 'account' | 'budget' | 'all',
  ) {
    const cacheManager = await getCacheManager();

    switch (changeType) {
      case 'transaction':
        await cacheManager.invalidateTransactionCache(userId);
        // Also invalidate financial summaries
        await cacheManager.delPattern(`financial:${userId}:*`);
        await cacheManager.delPattern(`dashboard:${userId}:*`);
        break;

      case 'goal':
        await cacheManager.delPattern(`goals:${userId}:*`);
        await cacheManager.delPattern(`dashboard:${userId}:*`);
        break;

      case 'account':
        await cacheManager.delPattern(`external:basiq:*:${userId}:*`);
        await cacheManager.delPattern(`dashboard:${userId}:*`);
        break;

      case 'budget':
        await cacheManager.delPattern(`financial:${userId}:*`);
        await cacheManager.delPattern(`budget:${userId}:*`);
        break;

      case 'all':
        await cacheManager.invalidateUserCache(userId);
        break;
    }
  }

  /**
   * Batch cache warming for common queries
   */
  static async warmCache(
    userId: string,
    data: {
      transactions?: any[];
      goals?: any[];
      accounts?: any[];
      financialSummary?: any;
    },
  ) {
    const cacheManager = await getCacheManager();

    await cacheManager.warmUserCache(userId, {
      goals: data.goals,
      recentTransactions: data.transactions,
      financialSummary: data.financialSummary,
    });
  }
}
