import os from 'os';
import { performance } from 'perf_hooks';
import { logger } from '@/lib/logger';

// Use the centralized logger for application monitoring
const appLogger = logger;

interface SystemMetrics {
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  osMetrics: {
    totalMemory: number;
    freeMemory: number;
    cpuLoad: number[];
  };
  timestamp: Date;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  evictions: number;
}

class ApplicationMonitor {
  private static instance: ApplicationMonitor;
  private systemMetrics: SystemMetrics[] = [];
  private cacheMetrics: Map<string, CacheMetrics> = new Map();
  private performanceMarks: Map<string, number> = new Map();
  private cpuUsageStart = process.cpuUsage();

  private constructor() {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Clean up old metrics every hour
    setInterval(
      () => {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        this.clearOldMetrics(oneHourAgo);
      },
      60 * 60 * 1000,
    );
  }

  static getInstance(): ApplicationMonitor {
    if (!ApplicationMonitor.instance) {
      ApplicationMonitor.instance = new ApplicationMonitor();
    }
    return ApplicationMonitor.instance;
  }

  private collectSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.cpuUsageStart);

    const metrics: SystemMetrics = {
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        arrayBuffers: memoryUsage.arrayBuffers,
      },
      cpuUsage: {
        user: cpuUsage.user / 1000000, // Convert to seconds
        system: cpuUsage.system / 1000000,
      },
      osMetrics: {
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpuLoad: os.loadavg(),
      },
      timestamp: new Date(),
    };

    this.systemMetrics.push(metrics);

    // Keep only last 1000 metrics
    if (this.systemMetrics.length > 1000) {
      this.systemMetrics.shift();
    }

    // Log warnings for high memory or CPU usage
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 80) {
      appLogger.warn('High memory usage detected', { memoryUsagePercent, metrics });
    }

    appLogger.info('System metrics collected', metrics);
  }

  // Cache monitoring
  recordCacheHit(cacheName: string) {
    if (!this.cacheMetrics.has(cacheName)) {
      this.cacheMetrics.set(cacheName, {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        evictions: 0,
      });
    }

    const metrics = this.cacheMetrics.get(cacheName)!;
    metrics.hits++;
    metrics.hitRate = metrics.hits / (metrics.hits + metrics.misses);
  }

  recordCacheMiss(cacheName: string) {
    if (!this.cacheMetrics.has(cacheName)) {
      this.cacheMetrics.set(cacheName, {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        evictions: 0,
      });
    }

    const metrics = this.cacheMetrics.get(cacheName)!;
    metrics.misses++;
    metrics.hitRate = metrics.hits / (metrics.hits + metrics.misses);
  }

  updateCacheSize(cacheName: string, size: number) {
    if (!this.cacheMetrics.has(cacheName)) {
      this.cacheMetrics.set(cacheName, {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        evictions: 0,
      });
    }

    const metrics = this.cacheMetrics.get(cacheName)!;
    metrics.size = size;
  }

  recordCacheEviction(cacheName: string) {
    if (!this.cacheMetrics.has(cacheName)) {
      this.cacheMetrics.set(cacheName, {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        evictions: 0,
      });
    }

    const metrics = this.cacheMetrics.get(cacheName)!;
    metrics.evictions++;
  }

  // Performance monitoring
  startPerformanceMark(name: string) {
    this.performanceMarks.set(name, performance.now());
  }

  endPerformanceMark(name: string): number | null {
    const start = this.performanceMarks.get(name);
    if (!start) return null;

    const duration = performance.now() - start;
    this.performanceMarks.delete(name);

    appLogger.info('Performance mark', { name, duration });

    return duration;
  }

  // Get current metrics
  getMetrics() {
    const latestSystem = this.systemMetrics[this.systemMetrics.length - 1];

    // Calculate averages
    const avgMemoryUsage =
      this.systemMetrics.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) /
        this.systemMetrics.length || 0;

    const avgCpuUsage =
      this.systemMetrics.reduce((sum, m) => sum + m.cpuUsage.user + m.cpuUsage.system, 0) /
        this.systemMetrics.length || 0;

    // Memory trend (increasing/decreasing)
    const memoryTrend = this.calculateTrend(this.systemMetrics.map((m) => m.memoryUsage.heapUsed));

    return {
      current: latestSystem,
      averages: {
        memoryUsage: avgMemoryUsage,
        cpuUsage: avgCpuUsage,
      },
      trends: {
        memory: memoryTrend,
      },
      cacheMetrics: Array.from(this.cacheMetrics.entries()).map(([name, metrics]) => ({
        name,
        ...metrics,
      })),
      systemHistory: this.systemMetrics.slice(-20),
    };
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';

    const recent = values.slice(-10);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder = values.slice(-20, -10).reduce((a, b) => a + b, 0) / 10 || avgRecent;

    const change = (avgRecent - avgOlder) / avgOlder;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  clearOldMetrics(olderThan: Date) {
    this.systemMetrics = this.systemMetrics.filter((m) => m.timestamp > olderThan);
  }
}

// Helper function for monitoring async operations
export async function withPerformanceMonitoring<T>(
  name: string,
  operation: () => Promise<T>,
): Promise<T> {
  const monitor = ApplicationMonitor.getInstance();
  monitor.startPerformanceMark(name);

  try {
    const result = await operation();
    const duration = monitor.endPerformanceMark(name);

    if (duration && duration > 1000) {
      appLogger.warn(`Slow operation detected: ${name}`, { duration });
    }

    return result;
  } catch (error) {
    monitor.endPerformanceMark(name);
    throw error;
  }
}

export { ApplicationMonitor };
