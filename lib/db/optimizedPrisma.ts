import { PrismaClient } from "@prisma/client";

// Optimized Prisma client configuration
const prismaClientSingleton = () => {
  return new PrismaClient({
    // Optimal connection pool settings for production
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Connection pool configuration
    // These settings are optimized for a typical web application
    // Adjust based on your specific load patterns
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    // Error formatting
    errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
  });
};

// Global singleton to prevent multiple instances
declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

// Connection pool monitoring
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

  private constructor(private prisma: PrismaClient) {}

  static getInstance(prisma: PrismaClient): DatabaseHealthMonitor {
    if (!DatabaseHealthMonitor.instance) {
      DatabaseHealthMonitor.instance = new DatabaseHealthMonitor(prisma);
    }
    return DatabaseHealthMonitor.instance;
  }

  /**
   * Start health monitoring
   */
  startMonitoring(intervalMs = 60000): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs);
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<boolean> {
    try {
      const startTime = Date.now();
      
      // Simple query to check connection
      await this.prisma.$queryRaw`SELECT 1`;
      
      const queryTime = Date.now() - startTime;
      
      // Update stats
      this.connectionStats.lastHealthCheck = new Date();
      this.connectionStats.isHealthy = queryTime < 1000; // Consider unhealthy if query takes > 1s
      
      // Log if unhealthy
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

  /**
   * Get current health status
   */
  getHealthStatus() {
    return {
      ...this.connectionStats,
      uptime: Date.now() - this.connectionStats.lastHealthCheck.getTime(),
    };
  }

  /**
   * Record query metrics
   */
  recordQuery(success: boolean, duration: number): void {
    this.connectionStats.totalQueries++;
    if (!success) {
      this.connectionStats.failedQueries++;
    }
    
    // Update rolling average
    const currentAvg = this.connectionStats.avgQueryTime;
    const totalQueries = this.connectionStats.totalQueries;
    this.connectionStats.avgQueryTime = 
      (currentAvg * (totalQueries - 1) + duration) / totalQueries;
  }
}

// Initialize health monitor
const healthMonitor = DatabaseHealthMonitor.getInstance(prisma);

// Middleware for query timing and monitoring
prisma.$use(async (params, next) => {
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
    healthMonitor.recordQuery(success, duration);
    
    // Log slow queries in development
    if (process.env.NODE_ENV === 'development' && duration > 100) {
      console.warn(`Slow query detected (${duration}ms):`, {
        model: params.model,
        action: params.action,
      });
    }
  }
});

// Graceful shutdown handling
const gracefulShutdown = async () => {
  console.log('Shutting down database connections...');
  healthMonitor.stopMonitoring();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Connection pool utilities
export const connectionPoolUtils = {
  /**
   * Get connection pool metrics
   */
  async getPoolMetrics() {
    try {
      // This query provides connection pool information for PostgreSQL
      const metrics = await prisma.$queryRaw<any[]>`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
          max(backend_start) as oldest_connection,
          avg(EXTRACT(EPOCH FROM (now() - backend_start))) as avg_connection_age
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid != pg_backend_pid()
      `;
      
      return metrics[0] || null;
    } catch (error) {
      console.error('Failed to get pool metrics:', error);
      return null;
    }
  },

  /**
   * Kill idle connections older than specified minutes
   */
  async killIdleConnections(idleMinutes = 5) {
    try {
      // Use parameterized query to prevent SQL injection
      const result = await prisma.$executeRaw`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid != pg_backend_pid()
          AND state = 'idle'
          AND state_change < now() - INTERVAL '1 minute' * ${idleMinutes}
      `;
      
      return result;
    } catch (error) {
      console.error('Failed to kill idle connections:', error);
      return 0;
    }
  },

  /**
   * Get detailed query statistics
   */
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
      // pg_stat_statements extension might not be enabled
      console.warn('Could not fetch query stats. Ensure pg_stat_statements is enabled.');
      return [];
    }
  },
};

// Start health monitoring in production
if (process.env.NODE_ENV === 'production') {
  healthMonitor.startMonitoring();
}

export { prisma, healthMonitor };