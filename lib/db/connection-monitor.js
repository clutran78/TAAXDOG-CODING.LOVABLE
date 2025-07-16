import db from './postgres.js';

// Connection monitoring and logging utility
class ConnectionMonitor {
  constructor() {
    this.metrics = {
      totalQueries: 0,
      failedQueries: 0,
      slowQueries: 0,
      activeConnections: 0,
      connectionErrors: [],
      queryHistory: []
    };
    
    this.slowQueryThreshold = 1000; // 1 second
    this.maxHistorySize = 100;
  }

  // Log query execution
  logQuery(queryInfo) {
    this.metrics.totalQueries++;
    
    if (queryInfo.error) {
      this.metrics.failedQueries++;
      this.logError(queryInfo.error, queryInfo);
    }
    
    if (queryInfo.duration > this.slowQueryThreshold) {
      this.metrics.slowQueries++;
      console.warn('[Monitor] Slow query detected:', {
        query: queryInfo.query.substring(0, 100),
        duration: `${queryInfo.duration}ms`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Keep recent query history
    this.metrics.queryHistory.push({
      ...queryInfo,
      timestamp: new Date().toISOString()
    });
    
    if (this.metrics.queryHistory.length > this.maxHistorySize) {
      this.metrics.queryHistory.shift();
    }
  }

  // Log connection errors
  logError(error, context = {}) {
    const errorEntry = {
      message: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      context
    };
    
    this.metrics.connectionErrors.push(errorEntry);
    
    // Keep only recent errors
    if (this.metrics.connectionErrors.length > 50) {
      this.metrics.connectionErrors.shift();
    }
    
    console.error('[Monitor] Database error:', errorEntry);
  }

  // Get current metrics
  getMetrics() {
    return {
      ...this.metrics,
      errorRate: this.metrics.totalQueries > 0 
        ? (this.metrics.failedQueries / this.metrics.totalQueries * 100).toFixed(2) + '%'
        : '0%',
      slowQueryRate: this.metrics.totalQueries > 0
        ? (this.metrics.slowQueries / this.metrics.totalQueries * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  // Reset metrics
  resetMetrics() {
    this.metrics = {
      totalQueries: 0,
      failedQueries: 0,
      slowQueries: 0,
      activeConnections: 0,
      connectionErrors: [],
      queryHistory: []
    };
  }

  // Monitor connection health
  async checkHealth() {
    try {
      const health = await db.healthCheck();
      
      if (health.status === 'unhealthy') {
        this.logError(new Error(health.error || 'Health check failed'), { health });
      }
      
      return health;
    } catch (error) {
      this.logError(error, { operation: 'healthCheck' });
      throw error;
    }
  }

  // Start periodic health checks
  startHealthChecks(intervalMs = 60000) {
    console.log(`[Monitor] Starting health checks every ${intervalMs}ms`);
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth();
        console.log('[Monitor] Health check:', {
          status: health.status,
          latency: health.latency,
          pool: health.pool
        });
      } catch (error) {
        console.error('[Monitor] Health check failed:', error.message);
      }
    }, intervalMs);
  }

  // Stop health checks
  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('[Monitor] Health checks stopped');
    }
  }
}

// Create singleton instance
const monitor = new ConnectionMonitor();

// Wrapper for monitored queries
export const monitoredQuery = async (text, params = [], options = {}) => {
  const startTime = Date.now();
  const queryInfo = {
    query: text,
    params: params?.length || 0,
    duration: 0,
    success: false
  };

  try {
    const result = await db.query(text, params, options);
    queryInfo.success = true;
    queryInfo.rowCount = result.rowCount;
    return result;
  } catch (error) {
    queryInfo.error = error;
    throw error;
  } finally {
    queryInfo.duration = Date.now() - startTime;
    monitor.logQuery(queryInfo);
  }
};

// Wrapper for monitored transactions
export const monitoredTransaction = async (callback) => {
  const startTime = Date.now();
  const transactionInfo = {
    operation: 'transaction',
    duration: 0,
    success: false
  };

  try {
    const result = await db.transaction(callback);
    transactionInfo.success = true;
    return result;
  } catch (error) {
    transactionInfo.error = error;
    monitor.logError(error, transactionInfo);
    throw error;
  } finally {
    transactionInfo.duration = Date.now() - startTime;
    console.log(`[Monitor] Transaction completed in ${transactionInfo.duration}ms`, {
      success: transactionInfo.success
    });
  }
};

// Export monitor instance and methods
export default monitor;
export { monitor };