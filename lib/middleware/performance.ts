import { NextApiRequest, NextApiResponse } from 'next';
import { apiMiddleware, trackApiResponseTime } from '../monitoring/sentry-performance';
import { logger } from '../logger';

export interface PerformanceOptions {
  enableTracing?: boolean;
  trackSlowQueries?: boolean;
  slowQueryThreshold?: number;
}

/**
 * Middleware to track API performance with Sentry
 */
export function withPerformanceMonitoring(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  options: PerformanceOptions = {}
) {
  const {
    enableTracing = true,
    trackSlowQueries = true,
    slowQueryThreshold = 1000,
  } = options;

  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (!enableTracing) {
      return handler(req, res);
    }

    const startTime = performance.now();
    const endpoint = `${req.method} ${req.url?.split('?')[0]}`;

    // Wrap with Sentry middleware
    return apiMiddleware(async (req: NextApiRequest, res: NextApiResponse) => {
      try {
        // Override res.json to track response size
        const originalJson = res.json.bind(res);
        res.json = function (body: any) {
          const responseSize = JSON.stringify(body).length;
          const duration = performance.now() - startTime;

          // Log performance metrics
          logger.info('API Performance', {
            endpoint,
            method: req.method,
            duration,
            status: res.statusCode,
            responseSize,
            slow: duration > slowQueryThreshold,
          });

          // Track slow requests
          if (duration > slowQueryThreshold) {
            logger.warn('Slow API request detected', {
              endpoint,
              duration,
              threshold: slowQueryThreshold,
            });
          }

          return originalJson(body);
        };

        await handler(req, res);
      } catch (error) {
        const duration = performance.now() - startTime;
        
        logger.error('API request failed', {
          endpoint,
          duration,
          error,
        });

        throw error;
      }
    })(req, res);
  };
}

/**
 * Track database query performance
 */
export function trackQueryPerformance<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  return queryFn()
    .then((result) => {
      const duration = performance.now() - startTime;
      
      if (duration > 100) {
        logger.warn('Slow database query', {
          query: queryName,
          duration,
        });
      }

      return result;
    })
    .catch((error) => {
      const duration = performance.now() - startTime;
      
      logger.error('Database query failed', {
        query: queryName,
        duration,
        error,
      });

      throw error;
    });
}