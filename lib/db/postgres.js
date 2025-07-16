import { Pool } from 'pg';
import { performance } from 'perf_hooks';

// Singleton pattern for database connection
let pool = null;
let isInitialized = false;
let initializationError = null;

// Connection configuration with optimal pooling settings
const getPoolConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const connectionString = isProduction
    ? process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL
    : process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('Database connection string not configured. Please set DATABASE_URL environment variable.');
  }

  // Ensure SSL is properly configured for DigitalOcean
  // DigitalOcean uses self-signed certificates, so we need to allow them
  let sslConfig = false;
  
  if (connectionString.includes('sslmode=require') || isProduction || connectionString.includes('ondigitalocean.com')) {
    // For DigitalOcean, we need to disable certificate verification
    // In production, set NODE_TLS_REJECT_UNAUTHORIZED=0 as an environment variable
    if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      console.warn('[DB] Setting NODE_TLS_REJECT_UNAUTHORIZED=0 for DigitalOcean SSL compatibility');
    }
    
    sslConfig = {
      rejectUnauthorized: false,
      require: true
    };
  }

  return {
    connectionString,
    ssl: sslConfig,
    // Connection pool configuration
    max: 20, // Maximum number of clients in the pool
    min: 2, // Minimum number of clients in the pool
    idleTimeoutMillis: 30000, // 30 seconds - close idle clients
    connectionTimeoutMillis: 10000, // 10 seconds - wait for connection
    // Query execution settings
    statement_timeout: 30000, // 30 seconds query timeout
    query_timeout: 30000,
    // Connection retry settings
    allowExitOnIdle: false, // Keep pool alive
  };
};

// Initialize connection pool with retry logic
export const initializePool = async (retries = 3, delay = 1000) => {
  if (pool && isInitialized) {
    return pool;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[DB] Initializing connection pool (attempt ${attempt}/${retries})...`);
      
      const config = getPoolConfig();
      
      // Debug logging for SSL configuration
      if (process.env.NODE_ENV === 'development') {
        console.log('[DB] Pool configuration:', {
          ssl: config.ssl,
          connectionString: config.connectionString.replace(/:[^:@]+@/, ':****@'), // Hide password
          max: config.max,
          min: config.min
        });
      }
      
      pool = new Pool(config);

      // Set up pool error handlers
      pool.on('error', (err, client) => {
        console.error('[DB] Unexpected error on idle client:', {
          error: err.message,
          code: err.code,
          timestamp: new Date().toISOString()
        });
      });

      pool.on('connect', (client) => {
        console.log('[DB] New client connected to pool');
        // Set session-level settings for each new connection
        client.query('SET statement_timeout = 30000');
      });

      pool.on('acquire', (client) => {
        console.log('[DB] Client acquired from pool');
      });

      pool.on('remove', (client) => {
        console.log('[DB] Client removed from pool');
      });

      // Test the connection
      const testResult = await pool.query('SELECT NOW() as current_time, current_database() as db');
      console.log('[DB] Connection test successful:', {
        database: testResult.rows[0].db,
        time: testResult.rows[0].current_time,
        poolSize: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      });

      isInitialized = true;
      initializationError = null;
      return pool;

    } catch (error) {
      console.error(`[DB] Connection attempt ${attempt} failed:`, {
        error: error.message,
        code: error.code,
        attempt,
        retries
      });

      initializationError = error;

      if (attempt < retries) {
        console.log(`[DB] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        // Clean up failed pool
        if (pool) {
          try {
            await pool.end();
          } catch (endError) {
            console.error('[DB] Error ending failed pool:', endError.message);
          }
          pool = null;
        }
        throw new Error(`Failed to initialize database after ${retries} attempts: ${error.message}`);
      }
    }
  }
};

// Execute query with comprehensive error handling
export const query = async (text, params = [], options = {}) => {
  const { 
    retries = 2,
    includeMetadata = false,
    logQuery = process.env.NODE_ENV !== 'production'
  } = options;

  // Ensure pool is initialized
  if (!pool || !isInitialized) {
    await initializePool();
  }

  const queryId = Math.random().toString(36).substring(7);
  const startTime = performance.now();

  for (let attempt = 1; attempt <= retries; attempt++) {
    let client = null;
    
    try {
      // Log query in development
      if (logQuery) {
        console.log('[DB] Executing query:', {
          queryId,
          query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          params: params?.map(p => typeof p === 'string' && p.length > 20 ? p.substring(0, 20) + '...' : p),
          attempt
        });
      }

      // Get a client from the pool
      client = await pool.connect();
      
      // Execute query
      const result = await client.query(text, params);
      
      const duration = performance.now() - startTime;

      // Log slow queries
      if (duration > 1000) {
        console.warn('[DB] Slow query detected:', {
          queryId,
          duration: `${duration.toFixed(2)}ms`,
          query: text.substring(0, 100),
          rowCount: result.rowCount
        });
      }

      // Return result with optional metadata
      if (includeMetadata) {
        return {
          rows: result.rows,
          rowCount: result.rowCount,
          fields: result.fields,
          metadata: {
            queryId,
            duration,
            attempt,
            timestamp: new Date().toISOString()
          }
        };
      }

      return result;

    } catch (error) {
      console.error(`[DB] Query error (attempt ${attempt}/${retries}):`, {
        queryId,
        error: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        position: error.position,
        query: text.substring(0, 100)
      });

      // Check if error is retryable
      const isRetryable = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNRESET',
        '57P01', // admin_shutdown
        '57P02', // crash_shutdown
        '57P03', // cannot_connect_now
        '08006', // connection_failure
        '08001', // sqlclient_unable_to_establish_sqlconnection
        '08004', // sqlserver_rejected_establishment_of_sqlconnection
      ].includes(error.code);

      if (!isRetryable || attempt === retries) {
        // Create a sanitized error for the client
        const clientError = new Error('Database operation failed');
        clientError.code = error.code;
        clientError.isRetryable = isRetryable;
        clientError.queryId = queryId;
        
        // Include safe details in development
        if (process.env.NODE_ENV !== 'production') {
          clientError.detail = error.detail;
          clientError.hint = error.hint;
        }

        throw clientError;
      }

      // Wait before retry with exponential backoff
      const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`[DB] Retrying query in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));

    } finally {
      // Always release the client back to the pool
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('[DB] Error releasing client:', releaseError.message);
        }
      }
    }
  }
};

// Transaction helper with automatic rollback
export const transaction = async (callback) => {
  const client = await pool.connect();
  const transactionId = Math.random().toString(36).substring(7);

  try {
    console.log(`[DB] Starting transaction ${transactionId}`);
    await client.query('BEGIN');
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    console.log(`[DB] Transaction ${transactionId} committed successfully`);
    
    return result;

  } catch (error) {
    console.error(`[DB] Transaction ${transactionId} failed, rolling back:`, {
      error: error.message,
      code: error.code
    });
    
    try {
      await client.query('ROLLBACK');
      console.log(`[DB] Transaction ${transactionId} rolled back`);
    } catch (rollbackError) {
      console.error(`[DB] Failed to rollback transaction ${transactionId}:`, rollbackError.message);
    }
    
    throw error;

  } finally {
    client.release();
  }
};

// Health check function
export const healthCheck = async () => {
  try {
    if (!pool) {
      return {
        status: 'error',
        message: 'Database pool not initialized',
        details: { initializationError: initializationError?.message }
      };
    }

    const start = performance.now();
    const result = await query('SELECT NOW() as current_time, current_database() as db, version() as version');
    const latency = performance.now() - start;

    return {
      status: 'healthy',
      latency: `${latency.toFixed(2)}ms`,
      database: result.rows[0].db,
      time: result.rows[0].current_time,
      version: result.rows[0].version,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      code: error.code,
      pool: pool ? {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      } : null
    };
  }
};

// Graceful shutdown
export const closePool = async () => {
  if (pool) {
    try {
      console.log('[DB] Closing database connection pool...');
      await pool.end();
      pool = null;
      isInitialized = false;
      console.log('[DB] Database connection pool closed');
    } catch (error) {
      console.error('[DB] Error closing pool:', error.message);
      throw error;
    }
  }
};

// Utility function to check specific constraint violations
export const isUniqueConstraintViolation = (error) => {
  return error.code === '23505'; // unique_violation
};

export const isForeignKeyViolation = (error) => {
  return error.code === '23503'; // foreign_key_violation
};

export const isCheckConstraintViolation = (error) => {
  return error.code === '23514'; // check_violation
};

// Export pool getter for advanced use cases
export const getPool = () => {
  if (!pool || !isInitialized) {
    throw new Error('Database pool not initialized. Call initializePool() first.');
  }
  return pool;
};

// Handle process termination
process.on('SIGINT', async () => {
  console.log('[DB] Received SIGINT, closing database connections...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[DB] Received SIGTERM, closing database connections...');
  await closePool();
  process.exit(0);
});

// Export default object for backward compatibility
export default {
  query,
  transaction,
  healthCheck,
  closePool,
  initializePool,
  getPool,
  isUniqueConstraintViolation,
  isForeignKeyViolation,
  isCheckConstraintViolation
};