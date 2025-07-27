import { logger } from '@/lib/logger';

/**
 * Environment Configuration System
 * Dynamically loads development or production configurations
 * Prevents key overlap and environment conflicts
 */

export type Environment = 'development' | 'production' | 'staging';

export interface DatabaseConfig {
  url: string;
  ssl: boolean;
  poolSize: number;
}

export interface StripeConfig {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  mode: 'test' | 'live';
}

export interface APIConfig {
  basiq: string;
  openrouter: string;
  gemini: string;
  anthropic: string;
}

export interface AuthConfig {
  url: string;
  secret: string;
  domain: string;
}

export interface EnvironmentConfig {
  env: Environment;
  database: DatabaseConfig;
  stripe: StripeConfig;
  apis: APIConfig;
  auth: AuthConfig;
  app: {
    url: string;
    port: number;
    debug: boolean;
  };
}

/**
 * Development Configuration
 */
const developmentConfig: EnvironmentConfig = {
  env: 'development',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://genesis@localhost:5432/taaxdog_development',
    ssl: false,
    poolSize: 5,
  },
  stripe: {
    publishableKey: process.env.STRIPE_TEST_PUBLISHABLE_KEY || '',
    secretKey: process.env.STRIPE_TEST_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET || '',
    mode: 'test',
  },
  apis: {
    basiq: process.env.BASIQ_API_KEY || '',
    openrouter: process.env.OPENROUTER_API_KEY || '',
    gemini: process.env.GEMINI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || '',
  },
  auth: {
    url: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    secret: process.env.NEXTAUTH_SECRET || '',
    domain: 'localhost',
  },
  app: {
    url: 'http://localhost:3000',
    port: 3000,
    debug: true,
  },
};

/**
 * Production Configuration
 */
const productionConfig: EnvironmentConfig = {
  env: 'production',
  database: {
    url: process.env.PRODUCTION_DATABASE_URL || '',
    ssl: true,
    poolSize: 20,
  },
  stripe: {
    publishableKey: process.env.STRIPE_LIVE_PUBLISHABLE_KEY || '',
    secretKey: process.env.STRIPE_LIVE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_LIVE_WEBHOOK_SECRET || '',
    mode: 'live',
  },
  apis: {
    basiq: process.env.BASIQ_API_KEY || '',
    openrouter: process.env.OPENROUTER_API_KEY || '',
    gemini: process.env.GEMINI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || '',
  },
  auth: {
    url: process.env.NEXTAUTH_URL || 'https://taxreturnpro.com.au',
    secret: process.env.NEXTAUTH_SECRET || '',
    domain: 'taxreturnpro.com.au',
  },
  app: {
    url: 'https://taxreturnpro.com.au',
    port: parseInt(process.env.PORT || '3000', 10),
    debug: false,
  },
};

/**
 * Staging Configuration
 */
const stagingConfig: EnvironmentConfig = {
  env: 'staging',
  database: {
    url: process.env.STAGING_DATABASE_URL || process.env.PRODUCTION_DATABASE_URL || '',
    ssl: true,
    poolSize: 10,
  },
  stripe: {
    publishableKey: process.env.STRIPE_TEST_PUBLISHABLE_KEY || '',
    secretKey: process.env.STRIPE_TEST_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET || '',
    mode: 'test', // Use test mode in staging
  },
  apis: {
    basiq: process.env.BASIQ_API_KEY || '',
    openrouter: process.env.OPENROUTER_API_KEY || '',
    gemini: process.env.GEMINI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || '',
  },
  auth: {
    url: process.env.NEXTAUTH_URL || 'https://staging.taxreturnpro.com.au',
    secret: process.env.NEXTAUTH_SECRET || '',
    domain: 'staging.taxreturnpro.com.au',
  },
  app: {
    url: 'https://staging.taxreturnpro.com.au',
    port: parseInt(process.env.PORT || '3000', 10),
    debug: true,
  },
};

/**
 * Get current environment
 */
function getCurrentEnvironment(): Environment {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();

  if (nodeEnv === 'production') return 'production';
  if (nodeEnv === 'staging') return 'staging';
  return 'development';
}

/**
 * Get configuration for current environment
 */
function getConfig(): EnvironmentConfig {
  const env = getCurrentEnvironment();

  switch (env) {
    case 'production':
      return productionConfig;
    case 'staging':
      return stagingConfig;
    case 'development':
    default:
      return developmentConfig;
  }
}

/**
 * Validate configuration
 */
function validateConfig(config: EnvironmentConfig): void {
  const errors: string[] = [];

  // Validate required database config
  if (!config.database.url) {
    errors.push(`Database URL is required for ${config.env} environment`);
  }

  // Validate auth config
  if (!config.auth.secret) {
    errors.push(`NEXTAUTH_SECRET is required for ${config.env} environment`);
  }

  // Validate Stripe config in production
  if (config.env === 'production') {
    if (!config.stripe.publishableKey || !config.stripe.secretKey) {
      errors.push('Stripe live keys are required in production');
    }
    if (!config.stripe.publishableKey.startsWith('pk_live_')) {
      errors.push('Production must use live Stripe publishable key (pk_live_...)');
    }
    if (!config.stripe.secretKey.startsWith('sk_live_')) {
      errors.push('Production must use live Stripe secret key (sk_live_...)');
    }
  }

  // Validate development Stripe config
  if (config.env === 'development') {
    if (config.stripe.publishableKey && !config.stripe.publishableKey.startsWith('pk_test_')) {
      errors.push('Development should use test Stripe publishable key (pk_test_...)');
    }
    if (config.stripe.secretKey && !config.stripe.secretKey.startsWith('sk_test_')) {
      errors.push('Development should use test Stripe secret key (sk_test_...)');
    }
  }

  if (errors.length > 0) {
    logger.error('❌ Configuration validation failed:');
    errors.forEach((error) => logger.error(`  - ${error}`););
    throw new Error(`Invalid configuration for ${config.env} environment`);
  }
}

// Get and validate configuration
const config = getConfig();
validateConfig(config);

// Log current configuration (without sensitive data)
logger.info(`🌍 Environment: ${config.env}`);
logger.info(`🗄️  Database: ${config.database.ssl ? 'SSL' : 'Local'}`);
logger.info(`💳 Stripe: ${config.stripe.mode} mode`);
logger.info(`🔐 Auth URL: ${config.auth.url}`);

export { config };
export default config;
