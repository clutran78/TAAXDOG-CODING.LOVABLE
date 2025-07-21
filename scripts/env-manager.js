#!/usr/bin/env node

/**
 * Environment Configuration Manager
 * Helps switch between development and production configurations
 * Prevents key overlap and validates environment settings
 */

const fs = require('fs');
const path = require('path');

const ENVS = {
  development: 'config/env.development.template',
  production: 'config/env.production.template',
  staging: 'config/env.staging.template'
};

const ENV_FILE = '.env.local';

/**
 * Copy environment template to .env.local
 */
function setEnvironment(env) {
  const templatePath = ENVS[env];
  
  if (!templatePath) {
    console.error(`❌ Unknown environment: ${env}`);
    console.log(`Available environments: ${Object.keys(ENVS).join(', ')}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Template not found: ${templatePath}`);
    process.exit(1);
  }
  
  try {
    // Read template
    const template = fs.readFileSync(templatePath, 'utf8');
    
    // Backup existing .env.local if it exists
    if (fs.existsSync(ENV_FILE)) {
      const backup = `${ENV_FILE}.backup.${Date.now()}`;
      fs.copyFileSync(ENV_FILE, backup);
      console.log(`📋 Backed up existing ${ENV_FILE} to ${backup}`);
    }
    
    // Write new environment file
    fs.writeFileSync(ENV_FILE, template);
    
    console.log(`✅ Environment set to: ${env}`);
    console.log(`📁 Configuration copied from: ${templatePath}`);
    console.log(`📝 Active config file: ${ENV_FILE}`);
    
    // Validate the configuration
    validateEnvironment(env);
    
  } catch (error) {
    console.error(`❌ Error setting environment: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Validate current environment configuration
 */
function validateEnvironment(env) {
  console.log(`\n🔍 Validating ${env} environment...`);
  
  if (!fs.existsSync(ENV_FILE)) {
    console.error(`❌ No ${ENV_FILE} file found`);
    return;
  }
  
  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  const errors = [];
  const warnings = [];
  
  // Check NODE_ENV
  if (!envContent.includes(`NODE_ENV="${env}"`)) {
    errors.push(`NODE_ENV should be "${env}"`);
  }
  
  // Validate development environment
  if (env === 'development') {
    if (!envContent.includes('STRIPE_TEST_')) {
      errors.push('Development should use STRIPE_TEST_ keys');
    }
    if (envContent.includes('STRIPE_LIVE_')) {
      errors.push('Development should NOT use STRIPE_LIVE_ keys');
    }
    if (!envContent.includes('localhost:3000')) {
      warnings.push('Development should use localhost:3000');
    }
  }
  
  // Validate production environment
  if (env === 'production') {
    if (!envContent.includes('STRIPE_LIVE_')) {
      errors.push('Production should use STRIPE_LIVE_ keys');
    }
    if (envContent.includes('STRIPE_TEST_')) {
      errors.push('Production should NOT use STRIPE_TEST_ keys');
    }
    if (!envContent.includes('taxreturnpro.com.au')) {
      warnings.push('Production should use taxreturnpro.com.au domain');
    }
  }
  
  // Check required variables
  const required = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
  required.forEach(key => {
    if (!envContent.includes(`${key}=`)) {
      errors.push(`Missing required variable: ${key}`);
    }
  });
  
  // Report results
  if (errors.length > 0) {
    console.error(`❌ Validation failed:`);
    errors.forEach(error => console.error(`  - ${error}`));
  } else {
    console.log(`✅ Validation passed`);
  }
  
  if (warnings.length > 0) {
    console.warn(`⚠️  Warnings:`);
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  // Show configuration summary
  showConfigSummary(envContent, env);
}

/**
 * Show configuration summary
 */
function showConfigSummary(envContent, env) {
  console.log(`\n📊 Configuration Summary (${env}):`);
  
  // Extract key information
  const nodeEnv = extractVar(envContent, 'NODE_ENV');
  const nextAuthUrl = extractVar(envContent, 'NEXTAUTH_URL');
  const databaseUrl = extractVar(envContent, 'DATABASE_URL') || extractVar(envContent, 'PRODUCTION_DATABASE_URL');
  
  console.log(`  🌍 Environment: ${nodeEnv}`);
  console.log(`  🔐 Auth URL: ${nextAuthUrl}`);
  console.log(`  🗄️  Database: ${databaseUrl ? databaseUrl.substring(0, 30) + '...' : 'Not set'}`);
  
  // Check Stripe mode
  if (envContent.includes('STRIPE_LIVE_')) {
    console.log(`  💳 Stripe: Live mode (production)`);
  } else if (envContent.includes('STRIPE_TEST_')) {
    console.log(`  💳 Stripe: Test mode (development)`);
  } else {
    console.log(`  💳 Stripe: Not configured`);
  }
}

/**
 * Extract variable value from env content
 */
function extractVar(content, varName) {
  const match = content.match(new RegExp(`${varName}="([^"]+)"`));
  return match ? match[1] : null;
}

/**
 * Show current environment status
 */
function showStatus() {
  console.log('🔧 Environment Manager Status\n');
  
  if (!fs.existsSync(ENV_FILE)) {
    console.log(`❌ No ${ENV_FILE} file found`);
    console.log('Run: npm run env:dev or npm run env:prod to set up environment');
    return;
  }
  
  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  const nodeEnv = extractVar(envContent, 'NODE_ENV');
  
  console.log(`Current environment: ${nodeEnv || 'unknown'}`);
  validateEnvironment(nodeEnv || 'development');
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
🔧 Environment Configuration Manager

Usage:
  node scripts/env-manager.js <command> [environment]

Commands:
  set <env>     Set environment (development, production, staging)
  status        Show current environment status  
  validate      Validate current environment
  help          Show this help

Examples:
  node scripts/env-manager.js set development
  node scripts/env-manager.js set production
  node scripts/env-manager.js status
  node scripts/env-manager.js validate

Quick Commands:
  npm run env:dev    Set development environment
  npm run env:prod   Set production environment
  npm run env:status Show environment status
`);
}

// Main execution
const [,, command, env] = process.argv;

switch (command) {
  case 'set':
    if (!env) {
      console.error('❌ Environment required');
      console.log('Usage: node scripts/env-manager.js set <environment>');
      process.exit(1);
    }
    setEnvironment(env);
    break;
    
  case 'status':
    showStatus();
    break;
    
  case 'validate':
    if (fs.existsSync(ENV_FILE)) {
      const content = fs.readFileSync(ENV_FILE, 'utf8');
      const nodeEnv = extractVar(content, 'NODE_ENV') || 'development';
      validateEnvironment(nodeEnv);
    } else {
      console.error(`❌ No ${ENV_FILE} file found`);
    }
    break;
    
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
    
  default:
    console.error(`❌ Unknown command: ${command || 'none'}`);
    showHelp();
    process.exit(1);
} 