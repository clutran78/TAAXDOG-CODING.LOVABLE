import { prisma, checkDatabaseHealth } from './prisma-optimized';

// Types for query metrics
interface QueryMetrics {
  totalQueries: number;
  slowQueries: number;
  averageTime: number;
}

// Placeholder functions - implement if needed
const getQueryMetrics = (): QueryMetrics => ({
  totalQueries: 0,
  slowQueries: 0,
  averageTime: 0,
});

const getSlowQueries = (): any[] => [];
import { NextApiRequest, NextApiResponse } from 'next';

// Helper to add query metrics to API responses in development
export const withQueryMetrics = (
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (process.env.NODE_ENV === 'development' && req.query._metrics === 'true') {
      const metrics = getQueryMetrics();
      const slowQueries = getSlowQueries();

      // Intercept the response to add metrics
      const originalJson = res.json.bind(res);
      res.json = function (data: any) {
        return originalJson({
          ...data,
          _metrics: {
            totalQueries: metrics.totalQueries,
            slowQueries: metrics.slowQueries,
            averageTime: metrics.averageTime,
            slowQueriesList: slowQueries.slice(-10), // Last 10 slow queries
          },
        });
      };
    }

    return handler(req, res);
  };
};

// Health check endpoint helper
export const createHealthCheckHandler = () => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const isHealthy = await checkDatabaseHealth();

    res.status(isHealthy ? 200 : 503).json({
      database: {
        status: isHealthy ? 'healthy' : 'unhealthy',
        connected: isHealthy,
      },
      timestamp: new Date().toISOString(),
    });
  };
};

// Transaction helper with retry logic
export const withTransaction = async <T>(
  callback: (tx: typeof prisma) => Promise<T>,
  options?: {
    maxRetries?: number;
    timeout?: number;
  },
): Promise<T> => {
  const { maxRetries = 3, timeout = 5000 } = options || {};

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return (await prisma.$transaction(callback as any, {
        maxWait: 2000, // Max time to wait for a transaction slot
        timeout: timeout, // Max time for the transaction to complete
      })) as T;
    } catch (error: any) {
      lastError = error;

      // Don't retry on certain errors
      if (
        error.code === 'P2028' || // Transaction API error
        error.code === 'P2034' // Transaction failed
      ) {
        throw error;
      }

      // Retry with exponential backoff
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

// Batch operation helper
export const batchOperation = async <T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  options?: {
    batchSize?: number;
    onProgress?: (completed: number, total: number) => void;
  },
): Promise<R[]> => {
  const { batchSize = 10, onProgress } = options || {};
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((item) => operation(item)));

    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, items.length), items.length);
    }
  }

  return results;
};

// Pagination helper
export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const paginate = async <T>(
  model: any,
  options: PaginationOptions & {
    where?: any;
    include?: any;
    select?: any;
  } = {},
): Promise<PaginatedResult<T>> => {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 10));
  const skip = (page - 1) * limit;

  const [data, total] = await prisma.$transaction([
    model.findMany({
      where: options.where,
      include: options.include,
      select: options.select,
      orderBy: options.orderBy,
      skip,
      take: limit,
    }),
    model.count({ where: options.where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: skip + limit < total,
      hasPrev: page > 1,
    },
  };
};

// Types are already exported as interfaces above
