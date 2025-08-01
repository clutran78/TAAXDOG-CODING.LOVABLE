import { getRedisCache, RedisClient } from './redisClient';

/**
 * Cache key generation utilities
 */
export const CacheKeys = {
  // User-specific keys
  userProfile: (userId: string) => `user:${userId}:profile`,
  userGoals: (userId: string) => `user:${userId}:goals`,
  userTransactions: (userId: string, page = 1) => `user:${userId}:transactions:page:${page}`,
  userAnalytics: (userId: string) => `user:${userId}:analytics`,
  userFinancialSummary: (userId: string) => `user:${userId}:financial-summary`,

  // Goal-specific keys
  goalDetails: (goalId: string) => `goal:${goalId}:details`,
  goalProgress: (goalId: string) => `goal:${goalId}:progress`,

  // Transaction keys
  transactionDetails: (transactionId: string) => `transaction:${transactionId}`,
  transactionsByCategory: (userId: string, category: string) =>
    `user:${userId}:transactions:category:${category}`,

  // Analytics keys
  monthlySpending: (userId: string, year: number, month: number) =>
    `analytics:${userId}:spending:${year}:${month}`,
  taxSummary: (userId: string, year: number) => `analytics:${userId}:tax:${year}`,
  categoryTrends: (userId: string, category: string) => `analytics:${userId}:trends:${category}`,

  // Session keys
  sessionData: (sessionId: string) => `session:${sessionId}`,
  userSession: (userId: string) => `user:${userId}:session`,
};

/**
 * Cache TTL values (in seconds)
 */
export const CacheTTL = {
  SHORT: 60, // 1 minute - for frequently changing data
  MEDIUM: 300, // 5 minutes - for user profiles, etc
  LONG: 3600, // 1 hour - for analytics, reports
  DAY: 86400, // 24 hours - for rarely changing data
  WEEK: 604800, // 7 days - for historical data
};

/**
 * Cache manager with invalidation strategies
 */
export class CacheManager {
  private cache: RedisClient | null = null;

  async init(): Promise<void> {
    this.cache = await getRedisCache();
  }

  /**
   * Cache wrapper with automatic key generation and TTL
   */
  async remember<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
    if (!this.cache) {
      return fetcher();
    }

    // Try to get from cache
    const cached = await this.cache.get(key);
    if (cached !== null) {
      try {
        return JSON.parse(cached) as T;
      } catch {
        return cached as T;
      }
    }

    // Fetch fresh data
    const fresh = await fetcher();

    // Store in cache
    await this.cache.set(key, JSON.stringify(fresh), ttl);

    return fresh;
  }

  /**
   * Invalidate user-related caches
   */
  async invalidateUserCache(userId: string): Promise<void> {
    if (!this.cache) return;

    const patterns = [`user:${userId}:*`, `analytics:${userId}:*`];

    for (const pattern of patterns) {
      await this.cache.delPattern(pattern);
    }
  }

  /**
   * Invalidate goal-related caches
   */
  async invalidateGoalCache(goalId: string, userId: string): Promise<void> {
    if (!this.cache) return;

    await Promise.all([
      this.cache.del(CacheKeys.goalDetails(goalId)),
      this.cache.del(CacheKeys.goalProgress(goalId)),
      this.cache.del(CacheKeys.userGoals(userId)),
      this.cache.delPattern(`analytics:${userId}:*`),
    ]);
  }

  /**
   * Invalidate transaction-related caches
   */
  async invalidateTransactionCache(userId: string, transactionId?: string): Promise<void> {
    if (!this.cache) return;

    const keys = [
      `user:${userId}:transactions:*`,
      `analytics:${userId}:*`,
      CacheKeys.userFinancialSummary(userId),
    ];

    if (transactionId) {
      keys.push(CacheKeys.transactionDetails(transactionId));
    }

    for (const key of keys) {
      if (key.includes('*')) {
        await this.cache.delPattern(key);
      } else {
        await this.cache.del(key);
      }
    }
  }

  /**
   * Cache warming strategy for user login
   */
  async warmUserCache(
    userId: string,
    data: {
      profile?: any;
      goals?: any[];
      recentTransactions?: any[];
      financialSummary?: any;
    },
  ): Promise<void> {
    if (!this.cache) return;

    const promises: Promise<void>[] = [];

    if (data.profile) {
      promises.push(this.set(CacheKeys.userProfile(userId), data.profile, CacheTTL.MEDIUM));
    }

    if (data.goals) {
      promises.push(this.set(CacheKeys.userGoals(userId), data.goals, CacheTTL.MEDIUM));
    }

    if (data.recentTransactions) {
      promises.push(
        this.set(CacheKeys.userTransactions(userId, 1), data.recentTransactions, CacheTTL.SHORT),
      );
    }

    if (data.financialSummary) {
      promises.push(
        this.set(CacheKeys.userFinancialSummary(userId), data.financialSummary, CacheTTL.LONG),
      );
    }

    await Promise.all(promises);
  }

  /**
   * Session-based caching for request data
   */
  async getSessionCache<T>(sessionId: string, key: string): Promise<T | null> {
    if (!this.cache) return null;

    const sessionKey = `${CacheKeys.sessionData(sessionId)}:${key}`;
    return this.get<T>(sessionKey);
  }

  async setSessionCache(
    sessionId: string,
    key: string,
    value: any,
    ttl = CacheTTL.SHORT,
  ): Promise<void> {
    if (!this.cache) return;

    const sessionKey = `${CacheKeys.sessionData(sessionId)}:${key}`;
    await this.set(sessionKey, value, ttl);
  }

  /**
   * Rate limiting helper
   */
  async checkRateLimit(
    key: string,
    limit: number,
    window: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetIn: number;
  }> {
    if (!this.cache) {
      return { allowed: true, remaining: limit, resetIn: 0 };
    }

    const count = await this.cache.incr(key);

    if (count === 1) {
      await this.cache.expire(key, window);
    }

    const ttl = await this.cache.ttl(key);

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetIn: ttl > 0 ? ttl : window,
    };
  }

  /**
   * Get a value by key
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.cache) return null;
    const value = await this.cache.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  /**
   * Set a value with TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.cache) return;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await this.cache.set(key, serialized, ttl);
  }

  /**
   * Delete a single key
   */
  async del(key: string): Promise<void> {
    if (!this.cache) return;
    await this.cache.del(key);
  }

  /**
   * Delete keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.cache) return;
    await this.cache.delPattern(pattern);
  }

  /**
   * Clear all caches (use with caution)
   */
  async clearAll(): Promise<void> {
    if (!this.cache) return;
    await this.cache.flushAll();
  }
}

// Singleton instance
let managerInstance: CacheManager | null = null;

export const getCacheManager = async (): Promise<CacheManager> => {
  if (!managerInstance) {
    managerInstance = new CacheManager();
    await managerInstance.init();
  }
  return managerInstance;
};
