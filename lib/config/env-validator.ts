import { logger } from '@/lib/logger';

// Environment variable validation
export interface EnvConfig {
  // Database
  DATABASE_URL: string;
  PRODUCTION_DATABASE_URL?: string;

  // Authentication
  NEXTAUTH_URL: string;
  NEXTAUTH_SECRET: string;
  JWT_SECRET?: string;

  // Email
  SENDGRID_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_PROVIDER?: 'sendgrid' | 'smtp' | 'console';
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;

  // Stripe
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  // AI Services
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  GEMINI_API_KEY?: string;

  // Banking
  BASIQ_API_KEY?: string;

  // Application
  NODE_ENV: 'development' | 'production' | 'test';
  APP_URL?: string;
}

// Required environment variables by environment
const requiredVars = {
  common: ['DATABASE_URL', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET'],
  development: [],
  production: ['PRODUCTION_DATABASE_URL', 'JWT_SECRET', 'EMAIL_FROM'],
  test: [],
};

// Validate environment variables
export function validateEnv(): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const env = process.env.NODE_ENV || 'development';

  // Check common required variables
  for (const varName of requiredVars.common) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Check environment-specific required variables
  const envSpecificVars = requiredVars[env as keyof typeof requiredVars] || [];
  for (const varName of envSpecificVars) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable for ${env}: ${varName}`);
    }
  }

  // Check email configuration
  if (!process.env.SENDGRID_API_KEY && !process.env.SMTP_USER) {
    warnings.push('No email service configured. Emails will be logged to console.');
  }

  // Check Stripe configuration
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PUBLISHABLE_KEY) {
    warnings.push('Stripe is not configured. Payment features will be disabled.');
  }

  // Check AI services
  if (
    !process.env.ANTHROPIC_API_KEY &&
    !process.env.OPENROUTER_API_KEY &&
    !process.env.GEMINI_API_KEY
  ) {
    warnings.push('No AI services configured. AI features will be disabled.');
  }

  // Validate DATABASE_URL format
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
  }

  // Validate NEXTAUTH_URL format
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.match(/^https?:\/\//)) {
    errors.push('NEXTAUTH_URL must be a valid URL');
  }

  // Check for production security
  if (env === 'production') {
    if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
      errors.push('NEXTAUTH_SECRET must be at least 32 characters in production');
    }

    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Get typed environment config
export function getEnvConfig(): Partial<EnvConfig> {
  return {
    // Database
    DATABASE_URL: process.env.DATABASE_URL,
    PRODUCTION_DATABASE_URL: process.env.PRODUCTION_DATABASE_URL,

    // Authentication
    NEXTAUTH_URL: process.env.NEXTAUTH_URL!,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
    JWT_SECRET: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET,

    // Email
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER as any,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,

    // Stripe
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

    // AI Services
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,

    // Banking
    BASIQ_API_KEY: process.env.BASIQ_API_KEY,

    // Application
    NODE_ENV: (process.env.NODE_ENV || 'development') as any,
    APP_URL: process.env.APP_URL || process.env.NEXTAUTH_URL,
  };
}

// Log environment validation results
export function logEnvValidation(): void {
  const { isValid, errors, warnings } = validateEnv();
  const env = process.env.NODE_ENV || 'development';

  logger.info(`\n=== Environment Validation (${env}) ===`);

  if (errors.length > 0) {
    logger.error('\n❌ Errors:');
    errors.forEach((error) => logger.error(`   - ${error}`));
  }

  if (warnings.length > 0) {
    logger.warn('\n⚠️  Warnings:');
    warnings.forEach((warning) => logger.warn(`   - ${warning}`));
  }

  if (isValid) {
    logger.info('\n✅ Environment configuration is valid');
  } else {
    logger.error('\n❌ Environment configuration is invalid');
  }

  logger.info('\n================================\n');
}

// Ensure required environment variables are set
export function ensureEnv(varName: string, defaultValue?: string): string {
  const value = process.env[varName] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${varName} is required but not set`);
  }
  return value;
}
