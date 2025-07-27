import { PoolConfig } from 'pg';

export function getDatabaseConfig(
  isProduction: boolean = process.env.NODE_ENV === 'production',
): PoolConfig {
  if (isProduction) {
    if (!process.env.DB_PASSWORD) {
      throw new Error('DB_PASSWORD environment variable is required for production');
    }

    return {
      host: process.env.DB_HOST || 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
      port: parseInt(process.env.DB_PORT || '25060'),
      user: process.env.DB_USER || 'taaxdog-admin',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'taaxdog-production',
      min: 5,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: {
        rejectUnauthorized: false,
      },
    };
  } else {
    return {
      host: 'localhost',
      port: 5432,
      user: 'genesis',
      database: 'taaxdog_development',
      min: 2,
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      ssl: false,
    };
  }
}

export const PRODUCTION_CONNECTION_STRING = process.env.DATABASE_URL || '';
export const DEVELOPMENT_CONNECTION_STRING =
  'postgresql://genesis@localhost:5432/taaxdog_development';
