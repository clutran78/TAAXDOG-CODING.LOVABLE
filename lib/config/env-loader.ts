import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { logger } from '@/lib/logger';

// Environment file priority order
const ENV_FILE_PRIORITY = [
  '.env.local',
  '.env.development.local',
  '.env.production.local',
  '.env.development',
  '.env.production',
  '.env',
];

// Load environment variables
export function loadEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const rootDir = process.cwd();

  // Load environment files in priority order
  for (const envFile of ENV_FILE_PRIORITY) {
    const filePath = resolve(rootDir, envFile);

    // Skip if file doesn't exist
    if (!existsSync(filePath)) {
      continue;
    }

    // Skip production files in development and vice versa
    if (nodeEnv === 'development' && envFile.includes('production')) {
      continue;
    }
    if (nodeEnv === 'production' && envFile.includes('development')) {
      continue;
    }

    // Load the environment file
    const result = config({ path: filePath });

    if (result.error) {
      logger.warn(`Failed to load ${envFile}:`, result.error.message);
    } else {
      logger.info(`Loaded environment from ${envFile}`);
    }
  }

  // Validate critical environment variables
  validateEnvironment();
}

// Validate required environment variables
function validateEnvironment(): void {
  const required = ['DATABASE_URL', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET'];

  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    logger.warn(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Environment variable helpers
export function getEnv(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || '';
}

export function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

export function getEnvBoolean(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export function getEnvNumber(key: string, defaultValue?: number): number | undefined {
  const value = process.env[key];
  if (!value) return defaultValue;
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
}

// Export environment details
export function getEnvironmentInfo(): Record<string, any> {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
    processId: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
  };
}
