import { NextApiRequest, NextApiResponse } from 'next';
import winston from 'winston';

// Configure logger for API monitoring
const apiLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/api-requests.log' }),
    new winston.transports.File({ 
      filename: 'logs/api-errors.log', 
      level: 'error' 
    })
  ]
});

interface ApiMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userId?: string;
  error?: string;
  userAgent?: string;
  ip?: string;
}

interface EndpointStats {
  endpoint: string;
  totalRequests: number;
  avgDuration: number;
  errorRate: number;
  statusCodes: Record<number, number>;
  requestsPerMinute: number;
}

class ApiMonitor {
  private static instance: ApiMonitor;
  private metrics: ApiMetrics[] = [];
  private endpointStats: Map<string, EndpointStats> = new Map();

  private constructor() {
    // Clean up old metrics every hour
    setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      this.clearOldMetrics(oneHourAgo);
    }, 60 * 60 * 1000);
  }

  static getInstance(): ApiMonitor {
    if (!ApiMonitor.instance) {
      ApiMonitor.instance = new ApiMonitor();
    }
    return ApiMonitor.instance;
  }

  logRequest(metrics: ApiMetrics) {
    this.metrics.push(metrics);
    
    // Keep only last 10000 requests in memory
    if (this.metrics.length > 10000) {
      this.metrics.shift();
    }

    // Update endpoint stats
    this.updateEndpointStats(metrics);

    // Log to file
    if (metrics.error || metrics.statusCode >= 400) {
      apiLogger.error('API error', metrics);
    } else {
      apiLogger.info('API request', metrics);
    }
  }

  private updateEndpointStats(metrics: ApiMetrics) {
    const key = `${metrics.method} ${metrics.endpoint}`;
    
    if (!this.endpointStats.has(key)) {
      this.endpointStats.set(key, {
        endpoint: key,
        totalRequests: 0,
        avgDuration: 0,
        errorRate: 0,
        statusCodes: {},
        requestsPerMinute: 0
      });
    }

    const stats = this.endpointStats.get(key)!;
    stats.totalRequests++;
    stats.avgDuration = (stats.avgDuration * (stats.totalRequests - 1) + metrics.duration) / stats.totalRequests;
    stats.statusCodes[metrics.statusCode] = (stats.statusCodes[metrics.statusCode] || 0) + 1;
    
    // Calculate error rate
    const errors = Object.entries(stats.statusCodes)
      .filter(([code]) => parseInt(code) >= 400)
      .reduce((sum, [, count]) => sum + count, 0);
    stats.errorRate = errors / stats.totalRequests;

    // Calculate requests per minute
    const recentRequests = this.metrics.filter(m => 
      m.endpoint === metrics.endpoint && 
      m.method === metrics.method &&
      m.timestamp > new Date(Date.now() - 60000)
    );
    stats.requestsPerMinute = recentRequests.length;
  }

  getMetrics() {
    const recentMetrics = this.metrics.slice(-1000);
    const errors = recentMetrics.filter(m => m.statusCode >= 400);
    const avgDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length || 0;

    // Get top slowest endpoints
    const slowestEndpoints = Array.from(this.endpointStats.values())
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);

    // Get endpoints with highest error rates
    const errorProneEndpoints = Array.from(this.endpointStats.values())
      .filter(s => s.errorRate > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 10);

    // Get busiest endpoints
    const busiestEndpoints = Array.from(this.endpointStats.values())
      .sort((a, b) => b.requestsPerMinute - a.requestsPerMinute)
      .slice(0, 10);

    return {
      totalRequests: this.metrics.length,
      recentErrors: errors.length,
      avgResponseTime: avgDuration,
      slowestEndpoints,
      errorProneEndpoints,
      busiestEndpoints,
      recentErrorDetails: errors.slice(-20),
      endpointStats: Array.from(this.endpointStats.values())
    };
  }

  clearOldMetrics(olderThan: Date) {
    this.metrics = this.metrics.filter(m => m.timestamp > olderThan);
  }
}

// Middleware for API monitoring
export function withApiMonitoring(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const start = Date.now();
    const monitor = ApiMonitor.getInstance();
    
    // Capture original end function
    const originalEnd = res.end;
    const originalJson = res.json;
    const originalStatus = res.status;
    
    let statusCode = 200;
    let error: string | undefined;

    // Override status to capture status code
    res.status = function(code: number) {
      statusCode = code;
      return originalStatus.call(this, code);
    };

    // Override json to capture errors
    res.json = function(body: any) {
      if (body?.error) {
        error = body.error;
      }
      return originalJson.call(this, body);
    };

    // Override end to log metrics
    res.end = function(...args: any[]) {
      const duration = Date.now() - start;
      
      monitor.logRequest({
        endpoint: req.url || 'unknown',
        method: req.method || 'unknown',
        statusCode,
        duration,
        timestamp: new Date(),
        userId: (req as any).userId,
        error,
        userAgent: req.headers['user-agent'],
        ip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress
      });

      return originalEnd.apply(this, args);
    };

    try {
      await handler(req, res);
    } catch (err) {
      error = err.message;
      throw err;
    }
  };
}

export { ApiMonitor };