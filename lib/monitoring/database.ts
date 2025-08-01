import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

// Use the centralized logger for database monitoring
const dbLogger = logger;

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  params?: any;
  error?: string;
}

interface ConnectionPoolMetrics {
  active: number;
  idle: number;
  waiting: number;
  total: number;
  timestamp: Date;
}

class DatabaseMonitor {
  private static instance: DatabaseMonitor;
  private slowQueryThreshold = 100; // milliseconds
  private queryMetrics: QueryMetrics[] = [];
  private connectionPoolMetrics: ConnectionPoolMetrics[] = [];

  private constructor() {}

  static getInstance(): DatabaseMonitor {
    if (!DatabaseMonitor.instance) {
      DatabaseMonitor.instance = new DatabaseMonitor();
    }
    return DatabaseMonitor.instance;
  }

  // Log query execution
  logQuery(query: string, duration: number, params?: any, error?: string) {
    const metric: QueryMetrics = {
      query,
      duration,
      timestamp: new Date(),
      params,
      error,
    };

    this.queryMetrics.push(metric);

    // Keep only last 1000 queries in memory
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics.shift();
    }

    // Log to file
    if (duration > this.slowQueryThreshold) {
      dbLogger.warn('Slow query detected', metric);
    } else {
      dbLogger.info('Query executed', metric);
    }
  }

  // Log connection pool metrics
  logConnectionPool(metrics: Omit<ConnectionPoolMetrics, 'timestamp'>) {
    const poolMetric: ConnectionPoolMetrics = {
      ...metrics,
      timestamp: new Date(),
    };

    this.connectionPoolMetrics.push(poolMetric);

    // Keep only last 1000 metrics in memory
    if (this.connectionPoolMetrics.length > 1000) {
      this.connectionPoolMetrics.shift();
    }

    dbLogger.info('Connection pool metrics', poolMetric);
  }

  // Get slow query patterns
  getSlowQueryPatterns(limit = 10): any[] {
    const patterns = new Map<
      string,
      { count: number; avgDuration: number; examples: QueryMetrics[] }
    >();

    const slowQueries = this.queryMetrics.filter((q) => q.duration > this.slowQueryThreshold);

    slowQueries.forEach((query) => {
      // Normalize query for pattern matching (remove specific values)
      const pattern = query.query
        .replace(/\d+/g, '?')
        .replace(/'[^']*'/g, '?')
        .replace(/\s+/g, ' ')
        .trim();

      if (!patterns.has(pattern)) {
        patterns.set(pattern, { count: 0, avgDuration: 0, examples: [] });
      }

      const patternData = patterns.get(pattern)!;
      patternData.count++;
      patternData.avgDuration =
        (patternData.avgDuration * (patternData.count - 1) + query.duration) / patternData.count;
      if (patternData.examples.length < 3) {
        patternData.examples.push(query);
      }
    });

    return Array.from(patterns.entries())
      .sort((a, b) => b[1].avgDuration - a[1].avgDuration)
      .slice(0, limit)
      .map(([pattern, data]) => ({
        pattern,
        ...data,
      }));
  }

  // Get current metrics
  getMetrics() {
    const recentQueries = this.queryMetrics.slice(-100);
    const slowQueries = recentQueries.filter((q) => q.duration > this.slowQueryThreshold);
    const avgDuration =
      recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length || 0;

    return {
      totalQueries: this.queryMetrics.length,
      slowQueries: slowQueries.length,
      avgQueryDuration: avgDuration,
      slowQueryPatterns: this.getSlowQueryPatterns(),
      connectionPool: this.connectionPoolMetrics[this.connectionPoolMetrics.length - 1] || null,
      recentSlowQueries: slowQueries.slice(-10),
    };
  }

  // Clear old metrics
  clearOldMetrics(olderThan: Date) {
    this.queryMetrics = this.queryMetrics.filter((m) => m.timestamp > olderThan);
    this.connectionPoolMetrics = this.connectionPoolMetrics.filter((m) => m.timestamp > olderThan);
  }
}

// Prisma middleware for query monitoring
export function createPrismaWithMonitoring() {
  const prisma = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

  const monitor = DatabaseMonitor.getInstance();

  // Monitor query events
  prisma.$on('query' as any, (e: any) => {
    monitor.logQuery(e.query, e.duration, e.params);
  });

  // Extended Prisma client with monitoring
  return new Proxy(prisma, {
    get(target, prop) {
      // Intercept $queryRaw and $executeRaw
      if (prop === '$queryRaw' || prop === '$executeRaw') {
        return new Proxy(target[prop], {
          apply: async (fn, thisArg, args) => {
            const start = Date.now();
            try {
              const result = await fn.apply(thisArg, args as any);
              const duration = Date.now() - start;
              monitor.logQuery(args[0], duration);
              return result;
            } catch (error: any) {
              const duration = Date.now() - start;
              monitor.logQuery(args[0], duration, undefined, error.message);
              throw error;
            }
          },
        });
      }
      return (target as any)[prop];
    },
  });
}

export { DatabaseMonitor };
