import db from './database';
import { envConfig } from './env-config';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    database: {
      status: 'pass' | 'fail';
      responseTime?: number;
      details?: any;
      error?: string;
    };
    memory: {
      status: 'pass' | 'fail';
      usage: NodeJS.MemoryUsage;
      threshold: number;
    };
    uptime: {
      status: 'pass' | 'fail';
      seconds: number;
    };
  };
}

interface DatabaseMetrics {
  totalQueries: number;
  slowQueries: number;
  averageResponseTime: number;
  connectionPoolStats: {
    total: number;
    idle: number;
    waiting: number;
  };
}

class HealthCheckService {
  private static instance: HealthCheckService;
  private startTime: Date;
  private queryMetrics: Map<string, number[]> = new Map();
  private readonly MEMORY_THRESHOLD = 0.9; // 90% memory usage threshold
  private readonly RESPONSE_TIME_THRESHOLD = 5000; // 5 seconds

  private constructor() {
    this.startTime = new Date();
  }

  public static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  public async performHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const environment = envConfig.getConfig().NODE_ENV;
    const version = process.env.npm_package_version || '1.0.0';

    const [databaseCheck, memoryCheck, uptimeCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkMemory(),
      this.checkUptime(),
    ]);

    const overallStatus = this.calculateOverallStatus(
      databaseCheck.status,
      memoryCheck.status,
      uptimeCheck.status
    );

    return {
      status: overallStatus,
      timestamp,
      version,
      environment,
      checks: {
        database: databaseCheck,
        memory: memoryCheck,
        uptime: uptimeCheck,
      },
    };
  }

  private async checkDatabase(): Promise<HealthCheckResult['checks']['database']> {
    try {
      const dbHealth = await db.healthCheck();
      
      const status = dbHealth.status === 'healthy' ? 'pass' : 'fail';
      const responseTime = dbHealth.details.responseTime;

      // Check if response time exceeds threshold
      if (responseTime && responseTime > this.RESPONSE_TIME_THRESHOLD) {
        return {
          status: 'fail',
          responseTime,
          error: `Response time ${responseTime}ms exceeds threshold ${this.RESPONSE_TIME_THRESHOLD}ms`,
          details: dbHealth.details,
        };
      }

      return {
        status,
        responseTime,
        details: {
          ...dbHealth.details,
          ssl: envConfig.getConfig().DATABASE_SSL_REQUIRED,
          poolConfig: envConfig.getPoolConfig(),
        },
      };
    } catch (error) {
      return {
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  private async checkMemory(): Promise<HealthCheckResult['checks']['memory']> {
    const memoryUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const usagePercentage = memoryUsage.heapUsed / totalMemory;

    return {
      status: usagePercentage < this.MEMORY_THRESHOLD ? 'pass' : 'fail',
      usage: memoryUsage,
      threshold: this.MEMORY_THRESHOLD,
    };
  }

  private async checkUptime(): Promise<HealthCheckResult['checks']['uptime']> {
    const uptimeSeconds = process.uptime();
    const minimumUptime = 60; // 1 minute minimum uptime for healthy status

    return {
      status: uptimeSeconds > minimumUptime ? 'pass' : 'fail',
      seconds: Math.floor(uptimeSeconds),
    };
  }

  private calculateOverallStatus(
    ...statuses: ('pass' | 'fail')[]
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const failCount = statuses.filter(s => s === 'fail').length;
    
    if (failCount === 0) return 'healthy';
    if (failCount === statuses.length) return 'unhealthy';
    return 'degraded';
  }

  public recordQueryMetric(query: string, responseTime: number): void {
    const metrics = this.queryMetrics.get(query) || [];
    metrics.push(responseTime);
    
    // Keep only last 100 metrics per query
    if (metrics.length > 100) {
      metrics.shift();
    }
    
    this.queryMetrics.set(query, metrics);
  }

  public getMetrics(): DatabaseMetrics {
    const queryLogs = db.getQueryLogs();
    const totalQueries = queryLogs.length;
    const slowQueries = queryLogs.filter(
      log => log.duration > envConfig.getConfig().DATABASE_SLOW_QUERY_THRESHOLD!
    ).length;

    const responseTimes = queryLogs.map(log => log.duration);
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    return {
      totalQueries,
      slowQueries,
      averageResponseTime,
      connectionPoolStats: {
        total: 0, // Will be populated from database health check
        idle: 0,
        waiting: 0,
      },
    };
  }

  public async performDetailedHealthCheck(): Promise<{
    health: HealthCheckResult;
    metrics: DatabaseMetrics;
    configuration: Record<string, any>;
  }> {
    const [health, metrics] = await Promise.all([
      this.performHealthCheck(),
      Promise.resolve(this.getMetrics()),
    ]);

    return {
      health,
      metrics,
      configuration: envConfig.getSafeConfig(),
    };
  }
}

export const healthCheck = HealthCheckService.getInstance();
export { HealthCheckResult, DatabaseMetrics };