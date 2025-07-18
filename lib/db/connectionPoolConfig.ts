/**
 * Optimal database connection pool configuration
 * These settings should be adjusted based on your application's specific needs
 */

export interface PoolConfig {
  // Maximum number of connections in the pool
  connectionLimit: number;
  // Pool timeout in milliseconds
  pool_timeout: number;
  // Statement timeout in milliseconds
  statement_timeout: number;
  // Query timeout in milliseconds
  query_timeout: number;
  // Connection timeout in milliseconds
  connect_timeout: number;
  // Idle timeout in milliseconds
  idleTimeoutMillis: number;
  // Maximum connection age in milliseconds
  max_lifetime: number;
}

/**
 * Get optimal pool configuration based on environment
 */
export function getOptimalPoolConfig(): PoolConfig {
  const env = process.env.NODE_ENV || 'development';
  
  // Base configuration
  const baseConfig: PoolConfig = {
    connectionLimit: 10,
    pool_timeout: 30000,      // 30 seconds
    statement_timeout: 30000,  // 30 seconds
    query_timeout: 30000,      // 30 seconds
    connect_timeout: 10000,    // 10 seconds
    idleTimeoutMillis: 300000, // 5 minutes
    max_lifetime: 1800000,     // 30 minutes
  };

  // Environment-specific overrides
  switch (env) {
    case 'production':
      return {
        ...baseConfig,
        connectionLimit: parseInt(process.env.DB_POOL_SIZE || '20'),
        pool_timeout: 20000,      // 20 seconds - faster timeout in production
        statement_timeout: 20000,  // 20 seconds
        query_timeout: 20000,      // 20 seconds
        idleTimeoutMillis: 600000, // 10 minutes - keep connections longer
        max_lifetime: 3600000,     // 1 hour - longer lifetime for stability
      };
      
    case 'staging':
      return {
        ...baseConfig,
        connectionLimit: 15,
        pool_timeout: 25000,
        statement_timeout: 25000,
        query_timeout: 25000,
      };
      
    case 'development':
    default:
      return {
        ...baseConfig,
        connectionLimit: 5, // Fewer connections for local development
      };
  }
}

/**
 * Calculate optimal pool size based on system resources
 * Formula: connections = ((core_count * 2) + effective_spindle_count)
 */
export function calculateOptimalPoolSize(): number {
  // This is a simplified calculation
  // In production, you might want to consider actual CPU cores and disk I/O
  const cpuCount = require('os').cpus().length;
  const effectiveSpindleCount = 1; // SSD = 1, HDD might be higher
  
  const calculated = (cpuCount * 2) + effectiveSpindleCount;
  
  // Set reasonable bounds
  const minConnections = 5;
  const maxConnections = 30;
  
  return Math.max(minConnections, Math.min(calculated, maxConnections));
}

/**
 * Generate database URL with connection pool parameters
 */
export function buildDatabaseUrl(baseUrl: string, config?: Partial<PoolConfig>): string {
  const poolConfig = { ...getOptimalPoolConfig(), ...config };
  
  const url = new URL(baseUrl);
  
  // Add connection pool parameters to the URL
  url.searchParams.set('connection_limit', poolConfig.connectionLimit.toString());
  url.searchParams.set('pool_timeout', poolConfig.pool_timeout.toString());
  url.searchParams.set('statement_timeout', poolConfig.statement_timeout.toString());
  url.searchParams.set('query_timeout', poolConfig.query_timeout.toString());
  url.searchParams.set('connect_timeout', poolConfig.connect_timeout.toString());
  url.searchParams.set('idle_in_transaction_session_timeout', poolConfig.idleTimeoutMillis.toString());
  
  // PostgreSQL specific optimizations
  url.searchParams.set('schema', 'public');
  url.searchParams.set('pgbouncer', 'true'); // If using PgBouncer
  
  return url.toString();
}

/**
 * Connection pool best practices and recommendations
 */
export const PoolBestPractices = {
  // Recommended settings for different scenarios
  recommendations: {
    smallApp: {
      connectionLimit: 5,
      description: 'Small application with < 100 concurrent users',
    },
    mediumApp: {
      connectionLimit: 10-20,
      description: 'Medium application with 100-1000 concurrent users',
    },
    largeApp: {
      connectionLimit: 20-50,
      description: 'Large application with > 1000 concurrent users',
    },
  },
  
  // Common issues and solutions
  troubleshooting: {
    'Connection pool exhausted': [
      'Increase connection_limit',
      'Reduce query execution time',
      'Implement connection pooling at application level',
      'Check for connection leaks',
    ],
    'Slow query performance': [
      'Add appropriate indexes',
      'Optimize query structure',
      'Use connection pooling',
      'Consider read replicas for heavy read workloads',
    ],
    'Connection timeouts': [
      'Increase connect_timeout',
      'Check network latency',
      'Verify database server resources',
      'Consider connection pooler like PgBouncer',
    ],
  },
  
  // Monitoring queries
  monitoringQueries: {
    activeConnections: `
      SELECT count(*) FROM pg_stat_activity 
      WHERE state = 'active';
    `,
    connectionsByState: `
      SELECT state, count(*) 
      FROM pg_stat_activity 
      GROUP BY state;
    `,
    longRunningQueries: `
      SELECT pid, now() - query_start AS duration, query 
      FROM pg_stat_activity 
      WHERE state = 'active' 
        AND now() - query_start > interval '5 minutes';
    `,
    connectionPoolEfficiency: `
      SELECT 
        sum(numbackends) as total_connections,
        sum(xact_commit) as total_commits,
        sum(xact_rollback) as total_rollbacks,
        sum(blks_read) as disk_reads,
        sum(blks_hit) as cache_hits,
        (sum(blks_hit)::float / (sum(blks_hit) + sum(blks_read))) * 100 as cache_hit_ratio
      FROM pg_stat_database;
    `,
  },
};