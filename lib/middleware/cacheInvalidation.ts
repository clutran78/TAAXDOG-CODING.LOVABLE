import { NextApiRequest, NextApiResponse } from 'next';
import { ApiCache } from '../services/cache/apiCache';
import { getCacheManager } from '../services/cache/cacheManager';
import { logger } from '../utils/logger';

export interface CacheInvalidationConfig {
  onSuccess?: (userId: string, data?: any) => Promise<void>;
  invalidationType: 'transaction' | 'goal' | 'account' | 'budget' | 'all' | 'custom';
  customPatterns?: string[];
}

/**
 * Middleware to automatically invalidate caches after successful mutations
 */
export function withCacheInvalidation(config: CacheInvalidationConfig) {
  return (handler: Function) => {
    return async (req: NextApiRequest & { userId?: string }, res: NextApiResponse) => {
      // Store original json method
      const originalJson = res.json;
      let responseData: any;
      let statusCode: number;

      // Override res.json to capture response
      res.json = function (data: any) {
        responseData = data;
        statusCode = res.statusCode;
        return originalJson.call(this, data);
      };

      try {
        // Execute the original handler
        await handler(req, res);

        // If successful mutation (2xx status code) and user is authenticated
        if (res.statusCode >= 200 && res.statusCode < 300 && req.userId && responseData?.success) {
          try {
            // Perform cache invalidation
            if (config.invalidationType === 'custom' && config.customPatterns) {
              const cacheManager = await getCacheManager();
              for (const pattern of config.customPatterns) {
                await cacheManager.delPattern(pattern.replace('{userId}', req.userId));
              }
            } else if (config.invalidationType !== 'custom') {
              await ApiCache.invalidateOnChange(req.userId, config.invalidationType);
            }

            // Execute custom success callback if provided
            if (config.onSuccess) {
              await config.onSuccess(req.userId, responseData);
            }

            logger.info('Cache invalidated after mutation', {
              userId: req.userId,
              invalidationType: config.invalidationType,
              endpoint: req.url,
              method: req.method,
            });
          } catch (error) {
            // Don't fail the request if cache invalidation fails
            logger.error('Cache invalidation error', {
              error: error instanceof Error ? error.message : 'Unknown error',
              userId: req.userId,
              invalidationType: config.invalidationType,
            });
          }
        }
      } catch (error) {
        // Pass through any errors from the handler
        throw error;
      }
    };
  };
}

/**
 * Common cache invalidation patterns
 */
export const CacheInvalidationPatterns = {
  // Invalidate after creating/updating/deleting transactions
  transactionMutation: {
    invalidationType: 'transaction' as const,
    onSuccess: async (userId: string) => {
      // Additional cleanup if needed
      const cacheManager = await getCacheManager();
      await cacheManager.delPattern(`ai:insights:${userId}:*`);
    },
  },

  // Invalidate after goal mutations
  goalMutation: {
    invalidationType: 'goal' as const,
    onSuccess: async (userId: string, data: any) => {
      if (data?.goalId) {
        const cacheManager = await getCacheManager();
        await cacheManager.del(`goal:${data.goalId}:*`);
      }
    },
  },

  // Invalidate after bank account changes
  accountMutation: {
    invalidationType: 'account' as const,
    customPatterns: [
      'dashboard:{userId}:*',
      'transactions:{userId}:*',
      'external:basiq:*:{userId}:*',
    ],
  },

  // Invalidate after budget changes
  budgetMutation: {
    invalidationType: 'budget' as const,
    customPatterns: ['budget:{userId}:*', 'financial:{userId}:*', 'ai:insights:{userId}:*'],
  },

  // Invalidate after receipt upload/processing
  receiptMutation: {
    invalidationType: 'custom' as const,
    customPatterns: ['receipt:duplicate:{userId}:*', 'transactions:{userId}:*', 'tax:{userId}:*'],
  },

  // Full cache clear (use sparingly)
  fullInvalidation: {
    invalidationType: 'all' as const,
    onSuccess: async (userId: string) => {
      logger.warn('Full cache invalidation performed', { userId });
    },
  },
};

/**
 * Helper to compose multiple middlewares with cache invalidation
 */
export function withCacheInvalidationCompose(
  config: CacheInvalidationConfig,
  ...middlewares: Function[]
) {
  return (handler: Function) => {
    // Apply cache invalidation last (after other middlewares)
    let wrappedHandler = withCacheInvalidation(config)(handler);

    // Apply other middlewares in reverse order
    for (let i = middlewares.length - 1; i >= 0; i--) {
      wrappedHandler = middlewares[i](wrappedHandler);
    }

    return wrappedHandler;
  };
}
