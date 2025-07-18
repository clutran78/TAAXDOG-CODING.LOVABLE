import { NextApiRequest, NextApiResponse } from 'next';
import { prisma, healthMonitor, connectionPoolUtils } from '../../../lib/db/optimizedPrisma';
import { getRedisCache } from '../../../lib/services/cache/redisClient';

/**
 * Health check endpoint for monitoring database and cache performance
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authorization (optional - you might want to protect this endpoint)
    const authHeader = req.headers.authorization;
    const isAuthorized = authHeader === `Bearer ${process.env.HEALTH_CHECK_TOKEN}`;
    
    // Basic health check (always available)
    const basicHealth = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    if (!isAuthorized) {
      return res.status(200).json(basicHealth);
    }

    // Detailed health check for authorized requests
    const [
      databaseHealth,
      poolMetrics,
      cacheHealth,
      healthStatus
    ] = await Promise.all([
      // Check database connectivity
      checkDatabaseHealth(),
      
      // Get connection pool metrics
      connectionPoolUtils.getPoolMetrics(),
      
      // Check Redis cache health
      checkCacheHealth(),
      
      // Get health monitor status
      healthMonitor.getHealthStatus(),
    ]);

    const detailedHealth = {
      ...basicHealth,
      status: databaseHealth.isHealthy && cacheHealth.isHealthy ? 'healthy' : 'degraded',
      services: {
        database: {
          ...databaseHealth,
          pool: poolMetrics,
          monitor: healthStatus,
        },
        cache: cacheHealth,
      },
      metrics: {
        avgQueryTime: healthStatus.avgQueryTime,
        totalQueries: healthStatus.totalQueries,
        failedQueries: healthStatus.failedQueries,
        errorRate: healthStatus.totalQueries > 0 
          ? (healthStatus.failedQueries / healthStatus.totalQueries) * 100 
          : 0,
      },
    };

    // Set appropriate status code
    const statusCode = detailedHealth.status === 'healthy' ? 200 : 503;
    
    return res.status(statusCode).json(detailedHealth);

  } catch (error) {
    console.error('Health check error:', error);
    return res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function checkDatabaseHealth() {
  const startTime = Date.now();
  
  try {
    // Simple query to check connection
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTime = Date.now() - startTime;
    
    return {
      isHealthy: true,
      responseTime,
      status: responseTime < 100 ? 'excellent' : responseTime < 500 ? 'good' : 'slow',
    };
  } catch (error) {
    return {
      isHealthy: false,
      responseTime: Date.now() - startTime,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkCacheHealth() {
  const startTime = Date.now();
  
  try {
    const cache = await getRedisCache();
    const testKey = 'health:check';
    const testValue = { timestamp: Date.now() };
    
    // Test write
    await cache.set(testKey, testValue, 10);
    
    // Test read
    const retrieved = await cache.get(testKey);
    
    // Test delete
    await cache.del(testKey);
    
    const responseTime = Date.now() - startTime;
    const isHealthy = retrieved !== null;
    
    return {
      isHealthy,
      responseTime,
      status: responseTime < 50 ? 'excellent' : responseTime < 200 ? 'good' : 'slow',
      operations: {
        write: true,
        read: isHealthy,
        delete: true,
      },
    };
  } catch (error) {
    return {
      isHealthy: false,
      responseTime: Date.now() - startTime,
      status: 'error',
      error: error instanceof Error ? error.message : 'Redis not available',
      operations: {
        write: false,
        read: false,
        delete: false,
      },
    };
  }
}