import { PoolConfig } from 'pg';

// Database connection configurations
export const DATABASE_CONFIGS = {
  // Production configuration
  production: {
    // Direct connection (port 25060)
    direct: {
      host: 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
      port: 25060,
      user: 'taaxdog-admin',
      password: process.env.DB_PASSWORD || '',
      database: 'taaxdog-production',
      ssl: {
        rejectUnauthorized: false
      }
    },
    // Connection pool (port 25061) - Better for high traffic
    pool: {
      host: 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
      port: 25061,
      user: 'taaxdog-admin',
      password: process.env.DB_PASSWORD || '',
      database: 'taaxdog-production',
      ssl: {
        rejectUnauthorized: false
      }
    },
    // Admin access for maintenance
    admin: {
      host: 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
      port: 25060,
      user: 'doadmin',
      password: process.env.DB_ADMIN_PASSWORD || '',
      database: 'taaxdog-production',
      ssl: {
        rejectUnauthorized: false
      }
    },
    // Admin pool access
    adminPool: {
      host: 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
      port: 25061,
      user: 'doadmin',
      password: process.env.DB_ADMIN_PASSWORD || '',
      database: 'defaultdb-connection-pool',
      ssl: {
        rejectUnauthorized: false
      }
    }
  },
  // Development configuration
  development: {
    direct: {
      host: 'localhost',
      port: 5432,
      user: 'genesis',
      database: 'taaxdog_development',
      ssl: false
    },
    pool: {
      host: 'localhost',
      port: 5432,
      user: 'genesis',
      database: 'taaxdog_development',
      ssl: false
    }
  }
};

// Get database configuration based on environment and connection type
export function getDatabaseConfig(
  environment: 'production' | 'development' = process.env.NODE_ENV === 'production' ? 'production' : 'development',
  connectionType: 'direct' | 'pool' = 'pool'
): PoolConfig {
  const config = DATABASE_CONFIGS[environment][connectionType];
  
  // Check if we have necessary environment variables for production
  if (environment === 'production' && !process.env.DB_PASSWORD) {
    throw new Error('DB_PASSWORD environment variable is required for production');
  }
  
  return {
    ...config,
    // Pool-specific settings
    min: environment === 'production' ? 5 : 2,
    max: environment === 'production' ? 20 : 10,
    idleTimeoutMillis: environment === 'production' ? 30000 : 10000,
    connectionTimeoutMillis: environment === 'production' ? 10000 : 5000,
    statement_timeout: environment === 'production' ? 30000 : 60000,
  };
}

// Connection strings for different scenarios
export const CONNECTION_STRINGS = {
  production: {
    direct: process.env.DATABASE_URL || '',
    pool: process.env.DATABASE_POOL_URL || '',
    admin: process.env.DATABASE_ADMIN_URL || '',
    adminPool: process.env.DATABASE_ADMIN_POOL_URL || ''
  },
  development: {
    direct: 'postgresql://genesis@localhost:5432/taaxdog_development',
    pool: 'postgresql://genesis@localhost:5432/taaxdog_development'
  }
};

// Helper to get the appropriate connection string
export function getConnectionString(
  environment: 'production' | 'development' = process.env.NODE_ENV === 'production' ? 'production' : 'development',
  connectionType: 'direct' | 'pool' | 'admin' | 'adminPool' = 'pool'
): string {
  const connectionString = CONNECTION_STRINGS[environment][connectionType as keyof typeof CONNECTION_STRINGS.production];
  
  if (!connectionString && environment === 'production') {
    throw new Error(`${connectionType.toUpperCase()} connection string not configured. Please set the appropriate environment variable.`);
  }
  
  return connectionString;
}