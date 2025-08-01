import db from './services/database/database';
import { envConfig } from './env-config';
import axios from 'axios';
import { createRedisClient } from './services/cache/redisClient';
import { BasiqClient } from './basiq/client';
import { aiService } from './ai/service';
import { AIOperationType } from './ai/config';
import Stripe from 'stripe';
import sgMail from '@sendgrid/mail';

interface ExternalServiceCheck {
  status: 'pass' | 'fail';
  responseTime?: number;
  details?: any;
  error?: string;
}

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    database: ExternalServiceCheck;
    redis: ExternalServiceCheck;
    memory: {
      status: 'pass' | 'fail';
      usage: NodeJS.MemoryUsage;
      threshold: number;
    };
    uptime: {
      status: 'pass' | 'fail';
      seconds: number;
    };
    basiq: ExternalServiceCheck;
    ai: ExternalServiceCheck;
    stripe: ExternalServiceCheck;
    sendgrid: ExternalServiceCheck;
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

    const [
      databaseCheck,
      redisCheck,
      memoryCheck,
      uptimeCheck,
      basiqCheck,
      aiCheck,
      stripeCheck,
      sendgridCheck,
    ] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMemory(),
      this.checkUptime(),
      this.checkBasiq(),
      this.checkAI(),
      this.checkStripe(),
      this.checkSendGrid(),
    ]);

    const overallStatus = this.calculateOverallStatus(
      databaseCheck.status,
      redisCheck.status,
      memoryCheck.status,
      uptimeCheck.status,
      basiqCheck.status,
      aiCheck.status,
      stripeCheck.status,
      sendgridCheck.status,
    );

    return {
      status: overallStatus,
      timestamp,
      version,
      environment,
      checks: {
        database: databaseCheck,
        redis: redisCheck,
        memory: memoryCheck,
        uptime: uptimeCheck,
        basiq: basiqCheck,
        ai: aiCheck,
        stripe: stripeCheck,
        sendgrid: sendgridCheck,
      },
    };
  }

  private async checkDatabase(): Promise<ExternalServiceCheck> {
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
    const failCount = statuses.filter((s) => s === 'fail').length;

    if (failCount === 0) return 'healthy';
    if (failCount === statuses.length) return 'unhealthy';
    return 'degraded';
  }

  private async checkRedis(): Promise<ExternalServiceCheck> {
    const startTime = Date.now();
    try {
      const redis = createRedisClient();
      const connected = await redis.ping();
      if (!connected) {
        return {
          status: 'fail',
          error: 'Redis not connected',
        };
      }

      // Test basic operation
      const testKey = 'health:check:test';
      await redis.set(testKey, 'ok', 5); // 5 second TTL
      const value = await redis.get(testKey);

      const responseTime = Date.now() - startTime;

      if (value !== 'ok') {
        return {
          status: 'fail',
          responseTime,
          error: 'Redis test operation failed',
        };
      }

      return {
        status: 'pass',
        responseTime,
        details: {
          connected: true,
        },
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Redis check failed',
      };
    }
  }

  private async checkBasiq(): Promise<ExternalServiceCheck> {
    const startTime = Date.now();
    try {
      // Check if BASIQ is configured
      if (!process.env.BASIQ_API_KEY) {
        return {
          status: 'fail',
          error: 'BASIQ not configured',
        };
      }

      const basiqClient = new BasiqClient();
      // Perform a basic health check
      const testResponse = await basiqClient.healthCheck();

      const responseTime = Date.now() - startTime;

      return {
        status: 'pass',
        responseTime,
        details: {
          apiAvailable: true,
          environment: process.env.BASIQ_ENV || 'production',
        },
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'BASIQ check failed',
      };
    }
  }

  private async checkAI(): Promise<ExternalServiceCheck> {
    const startTime = Date.now();
    try {
      // Test with a simple prompt that should return quickly
      const testPrompt = 'Respond with OK';
      const response = await aiService.processRequest({
        operation: AIOperationType.COMPLIANCE_CHECK,
        prompt: testPrompt,
        userId: 'health-check',
        context: { skipCache: true },
      });

      const responseTime = Date.now() - startTime;

      if (!response || !response.content) {
        return {
          status: 'fail',
          responseTime,
          error: 'AI service returned empty response',
        };
      }

      return {
        status: 'pass',
        responseTime,
        details: {
          provider: response.provider,
          model: response.model,
          tokensUsed: response.tokensUsed?.total,
        },
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'AI service check failed',
      };
    }
  }

  private async checkStripe(): Promise<ExternalServiceCheck> {
    const startTime = Date.now();
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return {
          status: 'fail',
          error: 'Stripe not configured',
        };
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-07-30.basil',
      });

      // List products with limit 1 - minimal API call
      const products = await stripe.products.list({ limit: 1 });

      const responseTime = Date.now() - startTime;

      return {
        status: 'pass',
        responseTime,
        details: {
          apiAvailable: true,
          mode: process.env.STRIPE_SECRET_KEY.includes('sk_test') ? 'test' : 'live',
        },
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Stripe check failed',
      };
    }
  }

  private async checkSendGrid(): Promise<ExternalServiceCheck> {
    const startTime = Date.now();
    try {
      if (!process.env.SENDGRID_API_KEY) {
        return {
          status: 'fail',
          error: 'SendGrid not configured',
        };
      }

      // Set API key
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      // Verify sender - this is a lightweight API call
      const response = await axios.get('https://api.sendgrid.com/v3/verified_senders', {
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        },
        timeout: 5000,
      });

      const responseTime = Date.now() - startTime;

      return {
        status: 'pass',
        responseTime,
        details: {
          apiAvailable: true,
          verifiedSenders: response.data.results?.length || 0,
        },
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'SendGrid check failed',
      };
    }
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
      (log) => log.duration > envConfig.getConfig().DATABASE_SLOW_QUERY_THRESHOLD!,
    ).length;

    const responseTimes = queryLogs.map((log) => log.duration);
    const averageResponseTime =
      responseTimes.length > 0
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
export type { HealthCheckResult, DatabaseMetrics, ExternalServiceCheck };
