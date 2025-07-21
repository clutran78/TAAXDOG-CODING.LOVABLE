import { z } from 'zod';
import envConfig from './environment';

// Environment enum
export const Environment = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

export type Environment = typeof Environment[keyof typeof Environment];

// Base configuration schema
const baseConfigSchema = z.object({
  env: z.enum(['development', 'production', 'test']),
  
  // Database
  database: z.object({
    url: z.string().url().or(z.string().startsWith('postgresql://')),
    poolMin: z.number().int().positive().default(2),
    poolMax: z.number().int().positive().default(10),
    enableLogging: z.boolean().default(false),
    sslRequired: z.boolean().default(false),
    slowQueryThreshold: z.number().int().positive().default(1000),
  }),
  
  // NextAuth
  auth: z.object({
    url: z.string().url(),
    secret: z.string().min(32),
    providers: z.object({
      google: z.object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      }).optional(),
    }),
  }),
  
  // Stripe
  stripe: z.object({
    publishableKey: z.string().startsWith('pk_'),
    secretKey: z.string().startsWith('sk_'),
    webhookSecret: z.string().startsWith('whsec_'),
  }),
  
  // AI Providers
  ai: z.object({
    anthropic: z.object({
      apiKey: z.string().startsWith('sk-ant-'),
    }),
    openrouter: z.object({
      apiKey: z.string().startsWith('sk-or-'),
    }),
    gemini: z.object({
      apiKey: z.string().startsWith('AIzaSy'),
    }),
  }),
  
  // BASIQ Banking
  basiq: z.object({
    apiKey: z.string(),
    serverUrl: z.string().url().default('https://au-api.basiq.io'),
  }),
  
  // Application
  app: z.object({
    url: z.string().url(),
    apiUrl: z.string().url(),
    domain: z.string().default('taxreturnpro.com.au'),
  }),
  
  // Feature Flags
  features: z.object({
    stripeWebhooks: z.boolean().default(true),
    aiFeatures: z.boolean().default(true),
    bankingIntegration: z.boolean().default(true),
  }),
  
  // Security
  security: z.object({
    enableRateLimiting: z.boolean().default(false),
    corsOrigin: z.string().or(z.array(z.string())),
    sessionCookieSecure: z.boolean().default(false),
    healthCheckToken: z.string(),
  }),
  
  // Logging
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['dev', 'json']).default('json'),
  }),
});

export type Config = z.infer<typeof baseConfigSchema>;

// Environment-specific configuration loaders
function loadDevelopmentConfig(): Config {
  return {
    env: 'development',
    database: {
      url: process.env.DATABASE_URL || '',
      poolMin: 2,
      poolMax: 10,
      enableLogging: true,
      sslRequired: false,
      slowQueryThreshold: 1000,
    },
    auth: {
      url: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      secret: process.env.NEXTAUTH_SECRET || '',
      providers: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      },
    },
    stripe: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    ai: {
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      },
      openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY || '',
      },
      gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
      },
    },
    basiq: {
      apiKey: process.env.BASIQ_API_KEY || '',
      serverUrl: 'https://au-api.basiq.io',
    },
    app: {
      url: process.env.APP_URL || 'http://localhost:3000',
      apiUrl: process.env.API_URL || 'http://localhost:3000/api',
      domain: 'localhost:3000',
    },
    features: {
      stripeWebhooks: true,
      aiFeatures: true,
      bankingIntegration: true,
    },
    security: {
      enableRateLimiting: false,
      corsOrigin: 'http://localhost:3000',
      sessionCookieSecure: false,
      healthCheckToken: process.env.HEALTH_CHECK_TOKEN || '',
    },
    logging: {
      level: 'debug',
      format: 'dev',
    },
  };
}

function loadProductionConfig(): Config {
  return {
    env: 'production',
    database: {
      url: process.env.DATABASE_URL || '',
      poolMin: 5,
      poolMax: 20,
      enableLogging: false,
      sslRequired: true,
      slowQueryThreshold: 500,
    },
    auth: {
      url: process.env.NEXTAUTH_URL || 'https://taxreturnpro.com.au',
      secret: process.env.NEXTAUTH_SECRET || '',
      providers: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      },
    },
    stripe: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    ai: {
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      },
      openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY || '',
      },
      gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
      },
    },
    basiq: {
      apiKey: process.env.BASIQ_API_KEY || '',
      serverUrl: 'https://au-api.basiq.io',
    },
    app: {
      url: process.env.APP_URL || 'https://taxreturnpro.com.au',
      apiUrl: process.env.API_URL || 'https://taxreturnpro.com.au/api',
      domain: 'taxreturnpro.com.au',
    },
    features: {
      stripeWebhooks: true,
      aiFeatures: true,
      bankingIntegration: true,
    },
    security: {
      enableRateLimiting: true,
      corsOrigin: 'https://taxreturnpro.com.au',
      sessionCookieSecure: true,
      healthCheckToken: process.env.HEALTH_CHECK_TOKEN || '',
    },
    logging: {
      level: 'info',
      format: 'json',
    },
  };
}

// Configuration cache
let cachedConfig: Config | null = null;
let configEnvironment: string | null = null;

// Load configuration based on environment
export function loadConfig(forceReload = false): Config {
  const currentEnv = process.env.NODE_ENV || 'development';
  
  // Return cached config if environment hasn't changed and not forcing reload
  if (!forceReload && cachedConfig && configEnvironment === currentEnv) {
    return cachedConfig;
  }
  
  let config: Config;
  
  switch (currentEnv) {
    case 'production':
      config = loadProductionConfig();
      break;
    case 'test':
      // For tests, use development config with test database
      config = loadDevelopmentConfig();
      config.env = 'test';
      config.database.url = process.env.DATABASE_URL || 'postgresql://genesis@localhost:5432/taaxdog_test';
      break;
    default:
      config = loadDevelopmentConfig();
  }
  
  // Validate configuration
  try {
    const validatedConfig = baseConfigSchema.parse(config);
    cachedConfig = validatedConfig;
    configEnvironment = currentEnv;
    return validatedConfig;
  } catch (error) {
    console.error('Configuration validation error:', error);
    throw new Error('Invalid configuration');
  }
}

// Get current configuration
export function getConfig(): Config {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}

// Configuration validation
export function validateConfig(config: unknown): config is Config {
  try {
    baseConfigSchema.parse(config);
    return true;
  } catch {
    return false;
  }
}

// Environment helpers
export function isDevelopment(): boolean {
  return getConfig().env === 'development';
}

export function isProduction(): boolean {
  return getConfig().env === 'production';
}

export function isTest(): boolean {
  return getConfig().env === 'test';
}

// Export specific configurations
export function getDatabaseConfig() {
  return getConfig().database;
}

export function getAuthConfig() {
  return getConfig().auth;
}

export function getStripeConfig() {
  return getConfig().stripe;
}

export function getAIConfig() {
  return getConfig().ai;
}

export function getBasiqConfig() {
  return getConfig().basiq;
}

export function getSecurityConfig() {
  return getConfig().security;
}

export function getFeatureFlags() {
  return getConfig().features;
}

// Configuration drift detection
export function detectConfigurationDrift(): Record<string, any> {
  const config = getConfig();
  const drift: Record<string, any> = {};
  
  // Check if environment variables match configuration
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== config.database.url) {
    drift.database_url = {
      env: process.env.DATABASE_URL,
      config: config.database.url,
    };
  }
  
  if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL !== config.auth.url) {
    drift.nextauth_url = {
      env: process.env.NEXTAUTH_URL,
      config: config.auth.url,
    };
  }
  
  return drift;
}