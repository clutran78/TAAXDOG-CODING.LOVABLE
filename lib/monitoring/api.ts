import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../prisma';
import { logger } from '../utils/logger';
import { performance } from 'perf_hooks';

/**
 * Simple API Monitoring System
 * Tracks endpoint performance, error rates, and usage patterns
 * Designed to be lightweight and non-intrusive
 */

// In-memory metrics storage (resets on server restart)
// In production, consider using Redis or a time-series database
const metricsCache = new Map<string, EndpointMetrics>();

interface EndpointMetrics {
  endpoint: string;
  method: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  statusCodes: Record<number, number>;
  errors: ErrorMetric[];
  lastReset: Date;
}

interface ErrorMetric {
  timestamp: Date;
  error: string;
  statusCode: number;
  userId?: string;
}

interface MonitoringData {
  requestId?: string;
  userId?: string;
  startTime: number;
  endpoint: string;
  method: string;
}

/**
 * Get or create metrics for an endpoint
 */
function getOrCreateMetrics(endpoint: string, method: string): EndpointMetrics {
  const key = `${method}:${endpoint}`;

  if (!metricsCache.has(key)) {
    metricsCache.set(key, {
      endpoint,
      method,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      statusCodes: {},
      errors: [],
      lastReset: new Date(),
    });
  }

  return metricsCache.get(key)!;
}

/**
 * Start monitoring an API request
 */
export function startMonitoring(
  req: NextApiRequest,
  requestId?: string,
  userId?: string,
): MonitoringData {
  const endpoint = req.url?.split('?')[0] || 'unknown';
  const method = req.method || 'unknown';

  return {
    requestId,
    userId,
    startTime: performance.now(),
    endpoint,
    method,
  };
}

/**
 * Complete monitoring for an API request
 */
export function completeMonitoring(
  monitoringData: MonitoringData,
  statusCode: number,
  error?: Error | string,
) {
  try {
    const duration = performance.now() - monitoringData.startTime;
    const metrics = getOrCreateMetrics(monitoringData.endpoint, monitoringData.method);

    // Update basic counters
    metrics.totalRequests++;
    if (statusCode >= 200 && statusCode < 400) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    // Update duration stats
    metrics.totalDuration += duration;
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);

    // Update status code distribution
    metrics.statusCodes[statusCode] = (metrics.statusCodes[statusCode] || 0) + 1;

    // Track errors (keep last 100)
    if (error || statusCode >= 400) {
      metrics.errors.push({
        timestamp: new Date(),
        error: error ? (typeof error === 'string' ? error : error.message) : `HTTP ${statusCode}`,
        statusCode,
        userId: monitoringData.userId,
      });

      // Keep only last 100 errors
      if (metrics.errors.length > 100) {
        metrics.errors = metrics.errors.slice(-100);
      }
    }

    // Log slow requests (over 3 seconds)
    if (duration > 3000) {
      logger.warn('Slow API request detected', {
        endpoint: monitoringData.endpoint,
        method: monitoringData.method,
        duration: Math.round(duration),
        statusCode,
        requestId: monitoringData.requestId,
        userId: monitoringData.userId,
      });
    }

    // Persist critical metrics asynchronously (fire-and-forget)
    if (shouldPersistMetrics(metrics)) {
      persistMetricsAsync(metrics).catch((err) =>
        logger.error('Failed to persist metrics', { error: err.message }),
      );
    }
  } catch (err) {
    // Don't let monitoring errors affect the API
    logger.error('Monitoring error', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Determine if metrics should be persisted
 */
function shouldPersistMetrics(metrics: EndpointMetrics): boolean {
  // Persist every 100 requests or if error rate is high
  const errorRate = metrics.failedRequests / metrics.totalRequests;
  return metrics.totalRequests % 100 === 0 || errorRate > 0.1;
}

/**
 * Persist metrics to database asynchronously
 */
async function persistMetricsAsync(metrics: EndpointMetrics): Promise<void> {
  try {
    // Skip persisting if apiMetric model doesn't exist yet
    // This prevents errors during migration phase
    if (!prisma.apiMetric) {
      logger.debug('apiMetric model not available, skipping persistence');
      return;
    }

    const avgDuration = metrics.totalDuration / metrics.totalRequests;
    const errorRate = metrics.failedRequests / metrics.totalRequests;

    await prisma.apiMetric.create({
      data: {
        endpoint: metrics.endpoint,
        method: metrics.method,
        totalRequests: metrics.totalRequests,
        successfulRequests: metrics.successfulRequests,
        failedRequests: metrics.failedRequests,
        averageDuration: avgDuration,
        minDuration: metrics.minDuration === Infinity ? 0 : metrics.minDuration,
        maxDuration: metrics.maxDuration,
        errorRate,
        statusCodeDistribution: metrics.statusCodes,
        recordedAt: new Date(),
      },
    });
  } catch (error) {
    // Don't let database errors crash the API
    // This could happen if the apiMetric table doesn't exist yet
    logger.debug('Failed to persist API metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: metrics.endpoint,
    });
  }
}

/**
 * Get current metrics for all endpoints
 */
export function getCurrentMetrics(): Record<string, EndpointMetrics> {
  const result: Record<string, EndpointMetrics> = {};

  for (const [key, metrics] of metricsCache.entries()) {
    result[key] = { ...metrics };
  }

  return result;
}

/**
 * Get metrics summary for a specific endpoint
 */
export function getEndpointMetrics(endpoint: string, method?: string): EndpointMetrics | null {
  if (method) {
    const key = `${method}:${endpoint}`;
    return metricsCache.get(key) || null;
  }

  // Return combined metrics for all methods
  const combined: EndpointMetrics = {
    endpoint,
    method: 'ALL',
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalDuration: 0,
    minDuration: Infinity,
    maxDuration: 0,
    statusCodes: {},
    errors: [],
    lastReset: new Date(),
  };

  for (const [key, metrics] of metricsCache.entries()) {
    if (metrics.endpoint === endpoint) {
      combined.totalRequests += metrics.totalRequests;
      combined.successfulRequests += metrics.successfulRequests;
      combined.failedRequests += metrics.failedRequests;
      combined.totalDuration += metrics.totalDuration;
      combined.minDuration = Math.min(combined.minDuration, metrics.minDuration);
      combined.maxDuration = Math.max(combined.maxDuration, metrics.maxDuration);

      // Merge status codes
      for (const [code, count] of Object.entries(metrics.statusCodes)) {
        combined.statusCodes[Number(code)] = (combined.statusCodes[Number(code)] || 0) + count;
      }

      // Merge errors (keep most recent 100)
      combined.errors = [...combined.errors, ...metrics.errors]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 100);
    }
  }

  return combined.totalRequests > 0 ? combined : null;
}

/**
 * Get system health metrics
 */
export async function getHealthMetrics() {
  try {
    // Calculate overall metrics
    let totalRequests = 0;
    let totalFailures = 0;
    let totalDuration = 0;
    const errorRates: number[] = [];

    for (const metrics of metricsCache.values()) {
      totalRequests += metrics.totalRequests;
      totalFailures += metrics.failedRequests;
      totalDuration += metrics.totalDuration;

      if (metrics.totalRequests > 0) {
        errorRates.push(metrics.failedRequests / metrics.totalRequests);
      }
    }

    const overallErrorRate = totalRequests > 0 ? totalFailures / totalRequests : 0;
    const averageResponseTime = totalRequests > 0 ? totalDuration / totalRequests : 0;

    // Check database connectivity
    const dbHealthy = await checkDatabaseHealth();

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const issues: string[] = [];

    if (!dbHealthy) {
      status = 'unhealthy';
      issues.push('Database connection failed');
    } else if (overallErrorRate > 0.1) {
      status = 'degraded';
      issues.push(`High error rate: ${(overallErrorRate * 100).toFixed(1)}%`);
    } else if (averageResponseTime > 3000) {
      status = 'degraded';
      issues.push(`High average response time: ${Math.round(averageResponseTime)}ms`);
    }

    return {
      status,
      timestamp: new Date(),
      metrics: {
        totalRequests,
        totalFailures,
        overallErrorRate,
        averageResponseTime: Math.round(averageResponseTime),
        activeEndpoints: metricsCache.size,
      },
      issues,
      database: {
        connected: dbHealthy,
      },
    };
  } catch (error) {
    logger.error('Failed to get health metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      status: 'unhealthy' as const,
      timestamp: new Date(),
      metrics: null,
      issues: ['Failed to collect metrics'],
      database: {
        connected: false,
      },
    };
  }
}

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Reset metrics for an endpoint
 */
export function resetEndpointMetrics(endpoint: string, method?: string): void {
  if (method) {
    const key = `${method}:${endpoint}`;
    metricsCache.delete(key);
  } else {
    // Reset all methods for the endpoint
    for (const key of metricsCache.keys()) {
      if (key.endsWith(`:${endpoint}`)) {
        metricsCache.delete(key);
      }
    }
  }
}

/**
 * Reset all metrics
 */
export function resetAllMetrics(): void {
  metricsCache.clear();
}

/**
 * Monitoring middleware
 */
export function withApiMonitoring(handler: any) {
  return async function monitoredHandler(
    req: NextApiRequest & { userId?: string; requestId?: string },
    res: NextApiResponse,
  ) {
    const monitoringData = startMonitoring(req, req.requestId, req.userId);

    // Store original methods
    const originalJson = res.json;
    const originalStatus = res.status;
    const originalSend = res.send;
    const originalEnd = res.end;

    let statusCode = 200;
    let responseError: Error | string | undefined;

    // Override status method
    res.status = function (code: number) {
      statusCode = code;
      return originalStatus.call(this, code);
    };

    // Override response methods to capture completion
    const completeRequest = (error?: any) => {
      if (error && statusCode === 200) {
        statusCode = 500;
        responseError = error;
      }
      completeMonitoring(monitoringData, statusCode, responseError);
    };

    res.json = function (body: any) {
      if (body?.error && statusCode === 200) {
        statusCode = 500;
        responseError = body.error;
      }
      completeRequest();
      return originalJson.call(this, body);
    };

    res.send = function (body: any) {
      completeRequest();
      return originalSend.call(this, body);
    };

    res.end = function (chunk?: any, encoding?: any) {
      completeRequest();
      return originalEnd.call(this, chunk, encoding);
    };

    try {
      await handler(req, res);
    } catch (error) {
      responseError = error as Error;
      completeRequest(error);
      throw error;
    }
  };
}

/**
 * Export monitoring types
 */
export type { EndpointMetrics, ErrorMetric, MonitoringData };
