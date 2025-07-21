import { PrismaClient } from "@prisma/client";
import { DatabaseMonitor } from '../monitoring/database';
import { getDatabaseUrl } from './sslConfig';

// Unified optimized and monitored Prisma client
const prismaClientSingleton = () => {
  const client = new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' }
    ],
    errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
  });

  const monitor = DatabaseMonitor.getInstance();

  // Monitor query events
  client.$on('query' as any, (e: any) => {
    monitor.logQuery(e.query, e.duration, e.params);
  });

  // Monitor errors
  client.$on('error' as any, (e: any) => {
    monitor.logQuery(e.query || 'Unknown query', 0, e.params, e.message);
  });

  // Middleware for additional query timing and monitoring
  client.$use(async (params, next) => {
    const startTime = Date.now();
    let success = true;
    
    try {
      const result = await next(params);
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      
      // Log to our monitoring system
      const query = `${params.model}.${params.action}`;
      if (!success) {
        monitor.logQuery(query, duration, params.args, 'Query failed');
      } else if (duration > 100) {
        // Log slow queries
        monitor.logQuery(query, duration, params.args);
      }
    }
  });

  // Extended client with monitoring for raw queries
  const monitoredClient = new Proxy(client, {
    get(target, prop) {
      // Intercept raw query methods
      if (prop === '$queryRaw' || prop === '$executeRaw' || prop === '$queryRawUnsafe' || prop === '$executeRawUnsafe') {
        return new Proxy(target[prop], {
          apply: async (fn, thisArg, args) => {
            const start = Date.now();
            const query = typeof args[0] === 'string' ? args[0] : args[0]?.sql || 'Raw query';
            
            try {
              const result = await fn.apply(thisArg, args);
              const duration = Date.now() - start;
              monitor.logQuery(query, duration);
              return result;
            } catch (error) {
              const duration = Date.now() - start;
              monitor.logQuery(query, duration, undefined, error.message);
              throw error;
            }
          }
        });
      }
      return target[prop];
    }
  });

  return monitoredClient;
};

// Global singleton to prevent multiple instances
declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

// Connection pool monitoring
export async function getConnectionPoolMetrics() {
  try {
    const result = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
        COUNT(*) FILTER (WHERE wait_event IS NOT NULL) as waiting,
        COUNT(*) as total
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid != pg_backend_pid()
    `;
    
    if (result && result[0]) {
      const metrics = {
        active: Number(result[0].active) || 0,
        idle: Number(result[0].idle) || 0,
        waiting: Number(result[0].waiting) || 0,
        total: Number(result[0].total) || 0
      };
      
      DatabaseMonitor.getInstance().logConnectionPool(metrics);
      return metrics;
    }
  } catch (error) {
    console.error('Failed to get connection pool metrics:', error);
  }
  
  return null;
}

// Database health monitoring
export class DatabaseHealthMonitor {
  private static instance: DatabaseHealthMonitor;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionStats = {
    totalQueries: 0,
    failedQueries: 0,
    avgQueryTime: 0,
    lastHealthCheck: new Date(),
    isHealthy: true,
  };

  private constructor() {}

  static getInstance(): DatabaseHealthMonitor {
    if (!DatabaseHealthMonitor.instance) {
      DatabaseHealthMonitor.instance = new DatabaseHealthMonitor();
    }
    return DatabaseHealthMonitor.instance;
  }

  async performHealthCheck(): Promise<boolean> {
    try {
      const startTime = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const queryTime = Date.now() - startTime;
      
      this.connectionStats.lastHealthCheck = new Date();
      this.connectionStats.isHealthy = queryTime < 1000;
      
      if (!this.connectionStats.isHealthy) {
        console.error(`Database health check failed: Query took ${queryTime}ms`);
      }
      
      return this.connectionStats.isHealthy;
    } catch (error) {
      this.connectionStats.isHealthy = false;
      console.error('Database health check error:', error);
      return false;
    }
  }

  getHealthStatus() {
    return {
      ...this.connectionStats,
      uptime: Date.now() - this.connectionStats.lastHealthCheck.getTime(),
    };
  }
}

// Connection pool utilities
export const connectionPoolUtils = {
  async getPoolMetrics() {
    return getConnectionPoolMetrics();
  },

  async killIdleConnections(idleMinutes = 5) {
    try {
      const result = await prisma.$executeRaw`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid != pg_backend_pid()
          AND state = 'idle'
          AND state_change < now() - interval '${idleMinutes} minutes'
      `;
      return result;
    } catch (error) {
      console.error('Failed to kill idle connections:', error);
      return 0;
    }
  },

  async getQueryStats() {
    try {
      const stats = await prisma.$queryRaw<any[]>`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          max_time,
          rows
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat%'
        ORDER BY total_time DESC
        LIMIT 20
      `;
      return stats;
    } catch (error) {
      console.warn('Could not fetch query stats. Ensure pg_stat_statements is enabled.');
      return [];
    }
  },
};

// Monitor connection pool periodically
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  setInterval(() => {
    getConnectionPoolMetrics().catch(console.error);
  }, 30000); // Every 30 seconds
}

// Graceful shutdown handling
const gracefulShutdown = async () => {
  console.log('Shutting down database connections...');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export const healthMonitor = DatabaseHealthMonitor.getInstance();