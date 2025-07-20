import { PrismaClient } from '@prisma/client';
import { DatabaseMonitor } from '../monitoring/database';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Create a single instance of Prisma with monitoring
export const prisma = globalForPrisma.prisma || createMonitoredPrismaClient();

function createMonitoredPrismaClient() {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' }
    ]
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

  // Extended client with monitoring for raw queries
  const monitoredClient = new Proxy(client, {
    get(target, prop) {
      // Intercept $queryRaw and $executeRaw
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
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Function to get connection pool metrics
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

// Monitor connection pool periodically
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  setInterval(() => {
    getConnectionPoolMetrics().catch(console.error);
  }, 30000); // Every 30 seconds
}