import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

interface DatabaseEnvironment {
  NODE_ENV: 'development' | 'production' | 'test';
  DATABASE_URL: string;
  DATABASE_URL_DEVELOPMENT?: string;
  DATABASE_URL_PRODUCTION?: string;
  DATABASE_POOL_MIN?: number;
  DATABASE_POOL_MAX?: number;
  DATABASE_ENABLE_LOGGING?: boolean;
  DATABASE_SSL_REQUIRED?: boolean;
  DATABASE_SLOW_QUERY_THRESHOLD?: number;
}

class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private config: DatabaseEnvironment;
  private loaded: boolean = false;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  private loadConfiguration(): DatabaseEnvironment {
    // Load environment files in order of precedence
    const envFiles = [
      '.env.local',
      `.env.${process.env.NODE_ENV}`,
      '.env',
    ];

    for (const file of envFiles) {
      const path = join(process.cwd(), file);
      if (existsSync(path)) {
        config({ path, override: true });
      }
    }

    // Validate and set database URLs
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const databaseUrl = this.getDatabaseUrl(isDevelopment);

    if (!databaseUrl) {
      throw new Error(
        `Database URL not configured for ${process.env.NODE_ENV} environment`
      );
    }

    const envConfig: DatabaseEnvironment = {
      NODE_ENV: (process.env.NODE_ENV as any) || 'development',
      DATABASE_URL: databaseUrl,
      DATABASE_URL_DEVELOPMENT: process.env.DATABASE_URL_DEVELOPMENT,
      DATABASE_URL_PRODUCTION: process.env.DATABASE_URL_PRODUCTION,
      DATABASE_POOL_MIN: parseInt(process.env.DATABASE_POOL_MIN || (isDevelopment ? '2' : '5')),
      DATABASE_POOL_MAX: parseInt(process.env.DATABASE_POOL_MAX || (isDevelopment ? '10' : '20')),
      DATABASE_ENABLE_LOGGING: process.env.DATABASE_ENABLE_LOGGING === 'true' || isDevelopment,
      DATABASE_SSL_REQUIRED: process.env.DATABASE_SSL_REQUIRED === 'true' || !isDevelopment,
      DATABASE_SLOW_QUERY_THRESHOLD: parseInt(process.env.DATABASE_SLOW_QUERY_THRESHOLD || '1000'),
    };

    this.validateConfiguration(envConfig);
    this.loaded = true;

    return envConfig;
  }

  private getDatabaseUrl(isDevelopment: boolean): string {
    if (isDevelopment) {
      return (
        process.env.DATABASE_URL_DEVELOPMENT ||
        process.env.DATABASE_URL ||
        'postgresql://genesis@localhost:5432/taaxdog_development'
      );
    }

    return (
      process.env.DATABASE_URL_PRODUCTION ||
      process.env.DATABASE_URL ||
      ''
    );
  }

  private validateConfiguration(config: DatabaseEnvironment): void {
    // Validate database URL format
    const urlPattern = /^postgresql:\/\/.+/;
    if (!urlPattern.test(config.DATABASE_URL)) {
      throw new Error('Invalid database URL format');
    }

    // Validate pool settings
    if (config.DATABASE_POOL_MIN! > config.DATABASE_POOL_MAX!) {
      throw new Error('DATABASE_POOL_MIN cannot be greater than DATABASE_POOL_MAX');
    }

    // Production-specific validations
    if (config.NODE_ENV === 'production') {
      if (!config.DATABASE_URL.includes('sslmode=require')) {
        console.warn('Production database URL should include sslmode=require');
      }

      if (config.DATABASE_ENABLE_LOGGING) {
        console.warn('Query logging is enabled in production - this may impact performance');
      }
    }

    // Security validations
    if (config.DATABASE_URL.includes('AVNS_')) {
      console.log('✓ Production database credentials detected');
    }
  }

  public getConfig(): DatabaseEnvironment {
    if (!this.loaded) {
      throw new Error('Environment configuration not loaded');
    }
    return { ...this.config };
  }

  public getDatabaseUrl(): string {
    if (!this.config || !this.config.DATABASE_URL) {
      // Fallback to process.env if config not loaded yet
      return process.env.DATABASE_URL || '';
    }
    return this.config.DATABASE_URL;
  }

  public getPoolConfig() {
    return {
      min: this.config.DATABASE_POOL_MIN!,
      max: this.config.DATABASE_POOL_MAX!,
      enableLogging: this.config.DATABASE_ENABLE_LOGGING!,
      sslRequired: this.config.DATABASE_SSL_REQUIRED!,
      slowQueryThreshold: this.config.DATABASE_SLOW_QUERY_THRESHOLD!,
    };
  }

  public isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  public isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  // Helper to safely log configuration (without exposing secrets)
  public getSafeConfig(): Record<string, any> {
    const safeConfig: Record<string, any> = {
      NODE_ENV: this.config.NODE_ENV,
      DATABASE_POOL_MIN: this.config.DATABASE_POOL_MIN,
      DATABASE_POOL_MAX: this.config.DATABASE_POOL_MAX,
      DATABASE_ENABLE_LOGGING: this.config.DATABASE_ENABLE_LOGGING,
      DATABASE_SSL_REQUIRED: this.config.DATABASE_SSL_REQUIRED,
      DATABASE_SLOW_QUERY_THRESHOLD: this.config.DATABASE_SLOW_QUERY_THRESHOLD,
    };

    // Sanitize database URLs
    if (this.config.DATABASE_URL) {
      safeConfig.DATABASE_URL = this.config.DATABASE_URL
        .replace(/:[^:@]+@/, ':[REDACTED]@')
        .replace(/AVNS_[^@]+/, 'AVNS_[REDACTED]');
    }

    return safeConfig;
  }
}

export const envConfig = EnvironmentConfig.getInstance();
export { DatabaseEnvironment };