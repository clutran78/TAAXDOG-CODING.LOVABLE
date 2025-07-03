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
      password: 'AVNS_kp_8AWjX2AzlvWOqm_V',
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
      password: 'AVNS_kp_8AWjX2AzlvWOqm_V',
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
      password: 'AVNS___ZoxHp7i5cnz64V8ms',
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
      password: 'AVNS___ZoxHp7i5cnz64V8ms',
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
    direct: 'postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production',
    pool: 'postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25061/taaxdog-production',
    admin: 'postgresql://doadmin:AVNS___ZoxHp7i5cnz64V8ms@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production',
    adminPool: 'postgresql://doadmin:AVNS___ZoxHp7i5cnz64V8ms@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25061/defaultdb-connection-pool'
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
  return CONNECTION_STRINGS[environment][connectionType as keyof typeof CONNECTION_STRINGS.production];
}