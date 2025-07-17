import { Pool, PoolConfig, QueryResult } from 'pg';
import { performance } from 'perf_hooks';

interface DatabaseConfig {
  connectionString: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statement_timeout?: number;
}

interface QueryLog {
  query: string;
  duration: number;
  timestamp: Date;
  error?: Error;
}

class DatabaseConnection {
  private pool: Pool | null = null;
  private config: DatabaseConfig;
  private queryLogs: QueryLog[] = [];
  private connectionAttempts: Map<string, number[]> = new Map();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_ATTEMPTS_PER_WINDOW = 10;
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second

  constructor() {
    this.config = this.getEnvironmentConfig();
  }

  private getEnvironmentConfig(): DatabaseConfig {
    const isProduction = process.env.NODE_ENV === 'production';
    const connectionString = isProduction
      ? process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL
      : process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('Database connection string not configured');
    }

    const baseConfig: DatabaseConfig = {
      connectionString,
      min: isProduction ? 5 : 2,
      max: isProduction ? 20 : 10,
      idleTimeoutMillis: isProduction ? 30000 : 10000,
      connectionTimeoutMillis: isProduction ? 10000 : 5000,
      statement_timeout: isProduction ? 30000 : 60000,
    };

    // SSL configuration for production
    if (isProduction || connectionString.includes('sslmode=require')) {
      baseConfig.ssl = {
        rejectUnauthorized: false, // Required for DigitalOcean managed databases
        require: true,
      };
    }

    return baseConfig;
  }

  private sanitizeError(error: any): Error {
    const sanitized = new Error('Database operation failed');
    
    // Only include safe error properties
    if (error.code) {
      (sanitized as any).code = error.code;
    }
    
    // Remove sensitive information from error messages
    if (error.message) {
      sanitized.message = error.message
        .replace(/postgresql:\/\/[^@]+@[^/]+/gi, 'postgresql://[REDACTED]@[REDACTED]')
        .replace(/password=\S+/gi, 'password=[REDACTED]')
        .replace(/AVNS_\S+/gi, '[REDACTED]');
    }

    return sanitized;
  }

  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const attempts = this.connectionAttempts.get(clientId) || [];
    
    // Remove old attempts outside the window
    const recentAttempts = attempts.filter(
      timestamp => now - timestamp < this.RATE_LIMIT_WINDOW
    );

    if (recentAttempts.length >= this.MAX_ATTEMPTS_PER_WINDOW) {
      return false;
    }

    recentAttempts.push(now);
    this.connectionAttempts.set(clientId, recentAttempts);
    return true;
  }

  async connect(clientId: string = 'default'): Promise<void> {
    if (!this.checkRateLimit(clientId)) {
      throw new Error('Connection rate limit exceeded');
    }

    if (this.pool) {
      return;
    }

    try {
      this.pool = new Pool({
        connectionString: this.config.connectionString,
        ssl: this.config.ssl,
        min: this.config.min,
        max: this.config.max,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
        statement_timeout: this.config.statement_timeout,
      });

      // Set up error handlers
      this.pool.on('error', (err) => {
        console.error('Unexpected database pool error:', this.sanitizeError(err));
      });

      // Test the connection
      await this.pool.query('SELECT NOW()');
      console.log('Database connection established successfully');
    } catch (error) {
      this.pool = null;
      throw this.sanitizeError(error);
    }
  }

  async query<T = any>(
    text: string,
    params?: any[],
    clientId: string = 'default'
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      await this.connect(clientId);
    }

    const start = performance.now();
    let queryLog: QueryLog = {
      query: text,
      duration: 0,
      timestamp: new Date(),
    };

    try {
      // Ensure parameterized queries
      if (params && params.length > 0) {
        // Validate parameters to prevent SQL injection
        params.forEach((param, index) => {
          if (typeof param === 'string' && param.includes('--')) {
            throw new Error(`Invalid parameter at index ${index}`);
          }
        });
      }

      const result = await this.pool!.query<T>(text, params);
      
      queryLog.duration = performance.now() - start;

      // Log slow queries
      if (queryLog.duration > this.SLOW_QUERY_THRESHOLD) {
        console.warn(`Slow query detected (${queryLog.duration.toFixed(2)}ms):`, {
          query: text.substring(0, 100),
          duration: queryLog.duration,
        });
      }

      // Log queries in development
      if (process.env.NODE_ENV !== 'production') {
        this.queryLogs.push(queryLog);
        console.log(`Query executed (${queryLog.duration.toFixed(2)}ms):`, text);
      }

      return result;
    } catch (error) {
      queryLog.error = error as Error;
      queryLog.duration = performance.now() - start;
      
      if (process.env.NODE_ENV !== 'production') {
        this.queryLogs.push(queryLog);
      }

      throw this.sanitizeError(error);
    }
  }

  async transaction<T>(
    callback: (client: any) => Promise<T>,
    clientId: string = 'default'
  ): Promise<T> {
    if (!this.pool) {
      await this.connect(clientId);
    }

    const client = await this.pool!.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw this.sanitizeError(error);
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connected: boolean;
      poolSize: number;
      idleConnections: number;
      waitingClients: number;
      lastError?: string;
      responseTime?: number;
    };
  }> {
    const start = performance.now();
    
    try {
      if (!this.pool) {
        // Try to connect if not connected
        try {
          await this.connect('health-check');
        } catch (connectError) {
          return {
            status: 'unhealthy',
            details: {
              connected: false,
              poolSize: 0,
              idleConnections: 0,
              waitingClients: 0,
              lastError: 'Failed to initialize connection pool',
              responseTime: performance.now() - start,
            },
          };
        }
      }

      await this.pool.query('SELECT 1');
      const responseTime = performance.now() - start;

      return {
        status: 'healthy',
        details: {
          connected: true,
          poolSize: this.pool.totalCount,
          idleConnections: this.pool.idleCount,
          waitingClients: this.pool.waitingCount,
          responseTime,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          poolSize: this.pool?.totalCount || 0,
          idleConnections: this.pool?.idleCount || 0,
          waitingClients: this.pool?.waitingCount || 0,
          lastError: this.sanitizeError(error).message,
          responseTime: performance.now() - start,
        },
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('Database connection closed');
    }
  }

  getQueryLogs(): QueryLog[] {
    return this.queryLogs;
  }

  clearQueryLogs(): void {
    this.queryLogs = [];
  }

  // Audit logging for sensitive operations
  async auditLog(
    operation: string,
    userId: string,
    details: Record<string, any>
  ): Promise<void> {
    const auditEntry = {
      operation,
      user_id: userId,
      timestamp: new Date(),
      details: JSON.stringify(details),
      ip_address: details.ipAddress || 'unknown',
    };

    try {
      await this.query(
        `INSERT INTO audit_logs (operation, user_id, timestamp, details, ip_address) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          auditEntry.operation,
          auditEntry.user_id,
          auditEntry.timestamp,
          auditEntry.details,
          auditEntry.ip_address,
        ]
      );
    } catch (error) {
      console.error('Failed to write audit log:', this.sanitizeError(error));
    }
  }
}

// Singleton instance
const db = new DatabaseConnection();

export default db;
export { DatabaseConnection, QueryLog };