import { PoolConfig } from 'pg';

export function getDatabaseConfig(isProduction: boolean = process.env.NODE_ENV === 'production'): PoolConfig {
  if (isProduction) {
    return {
      host: 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
      port: 25060,
      user: 'taaxdog-admin',
      password: 'AVNS_kp_8AWjX2AzlvWOqm_V',
      database: 'taaxdog-production',
      min: 5,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: {
        rejectUnauthorized: false
      }
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
      ssl: false
    };
  }
}

export const PRODUCTION_CONNECTION_STRING = 'postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production';
export const DEVELOPMENT_CONNECTION_STRING = 'postgresql://genesis@localhost:5432/taaxdog_development';