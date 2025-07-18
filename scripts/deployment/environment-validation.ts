#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { Client } from 'pg';
import Stripe from 'stripe';
import sgMail from '@sendgrid/mail';

dotenv.config();

interface ValidationResult {
  category: string;
  check: string;
  status: 'pass' | 'fail' | 'warning';
  details: string;
  required: boolean;
}

interface EnvironmentReport {
  timestamp: Date;
  environment: string;
  overallStatus: 'ready' | 'not_ready' | 'warnings';
  results: ValidationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

class EnvironmentValidator {
  private report: EnvironmentReport;
  private requiredEnvVars = [
    // Core Configuration
    'NODE_ENV',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    
    // Database
    'DATABASE_URL',
    
    // Authentication
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    
    // Payment Processing
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    
    // Email Service
    'SENDGRID_API_KEY',
    'EMAIL_FROM',
    
    // AI Services
    'ANTHROPIC_API_KEY',
    'OPENROUTER_API_KEY',
    'GEMINI_API_KEY',
    
    // Banking Integration
    'BASIQ_API_KEY',
    
    // Security
    'ENCRYPTION_KEY',
    'JWT_SECRET',
    
    // Backup Configuration
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'BACKUP_BUCKET',
    'BACKUP_ENCRYPTION_KEY'
  ];

  private optionalEnvVars = [
    'RATE_LIMIT_WINDOW',
    'RATE_LIMIT_MAX',
    'SESSION_TIMEOUT',
    'LOG_LEVEL',
    'MONITORING_ENABLED',
    'SENTRY_DSN'
  ];

  constructor() {
    this.report = {
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development',
      overallStatus: 'ready',
      results: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
  }

  async validate(): Promise<EnvironmentReport> {
    console.log('🔍 Starting Environment Validation...\n');

    // Check environment variables
    await this.validateEnvironmentVariables();
    
    // Check database connectivity
    await this.validateDatabaseConnection();
    
    // Check external API integrations
    await this.validateStripeIntegration();
    await this.validateSendGridIntegration();
    await this.validateBasiqIntegration();
    await this.validateAIServices();
    
    // Check SSL certificates
    await this.validateSSLConfiguration();
    
    // Check file permissions and directories
    await this.validateFileSystem();
    
    // Check system resources
    await this.validateSystemResources();
    
    // Calculate summary
    this.calculateSummary();
    
    // Save report
    await this.saveReport();
    
    // Display results
    this.displayResults();

    return this.report;
  }

  private async validateEnvironmentVariables(): Promise<void> {
    console.log('📋 Validating Environment Variables...');

    // Check required variables
    for (const varName of this.requiredEnvVars) {
      const value = process.env[varName];
      const isSet = value !== undefined && value !== '';
      
      this.addResult({
        category: 'Environment Variables',
        check: `Required: ${varName}`,
        status: isSet ? 'pass' : 'fail',
        details: isSet ? 'Variable is set' : 'Variable is missing or empty',
        required: true
      });
    }

    // Check optional variables
    for (const varName of this.optionalEnvVars) {
      const value = process.env[varName];
      const isSet = value !== undefined && value !== '';
      
      this.addResult({
        category: 'Environment Variables',
        check: `Optional: ${varName}`,
        status: isSet ? 'pass' : 'warning',
        details: isSet ? 'Variable is set' : 'Using default value',
        required: false
      });
    }

    // Validate environment-specific settings
    if (process.env.NODE_ENV === 'production') {
      this.validateProductionSettings();
    }
  }

  private validateProductionSettings(): void {
    // Check production-specific requirements
    const productionChecks = [
      {
        check: 'NEXTAUTH_URL uses HTTPS',
        condition: process.env.NEXTAUTH_URL?.startsWith('https://'),
        details: process.env.NEXTAUTH_URL || 'Not set'
      },
      {
        check: 'Debug mode disabled',
        condition: process.env.DEBUG !== 'true',
        details: process.env.DEBUG === 'true' ? 'Debug enabled in production!' : 'Debug disabled'
      },
      {
        check: 'Secure cookies enabled',
        condition: process.env.SECURE_COOKIES !== 'false',
        details: 'Secure cookie flag set'
      }
    ];

    for (const check of productionChecks) {
      this.addResult({
        category: 'Production Settings',
        check: check.check,
        status: check.condition ? 'pass' : 'fail',
        details: check.details,
        required: true
      });
    }
  }

  private async validateDatabaseConnection(): Promise<void> {
    console.log('🗄️  Validating Database Connection...');

    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      // Test basic query
      const result = await client.query('SELECT NOW()');
      
      this.addResult({
        category: 'Database',
        check: 'Connection test',
        status: 'pass',
        details: `Connected successfully at ${result.rows[0].now}`,
        required: true
      });

      // Check database version
      const versionResult = await client.query('SELECT version()');
      const version = versionResult.rows[0].version;
      
      this.addResult({
        category: 'Database',
        check: 'PostgreSQL version',
        status: version.includes('14.') || version.includes('15.') ? 'pass' : 'warning',
        details: version,
        required: false
      });

      // Check SSL connection
      const sslResult = await client.query('SELECT ssl_is_used()');
      const sslEnabled = sslResult.rows[0].ssl_is_used;
      
      this.addResult({
        category: 'Database',
        check: 'SSL connection',
        status: sslEnabled ? 'pass' : process.env.NODE_ENV === 'production' ? 'fail' : 'warning',
        details: sslEnabled ? 'SSL enabled' : 'SSL disabled',
        required: process.env.NODE_ENV === 'production'
      });

      // Check required tables
      const tables = ['users', 'subscriptions', 'transactions', 'audit_logs'];
      for (const table of tables) {
        const tableResult = await client.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )`,
          [table]
        );
        
        this.addResult({
          category: 'Database',
          check: `Table: ${table}`,
          status: tableResult.rows[0].exists ? 'pass' : 'fail',
          details: tableResult.rows[0].exists ? 'Table exists' : 'Table missing',
          required: true
        });
      }

      await client.end();
    } catch (error: any) {
      this.addResult({
        category: 'Database',
        check: 'Connection test',
        status: 'fail',
        details: `Connection failed: ${error.message}`,
        required: true
      });
    }
  }

  private async validateStripeIntegration(): Promise<void> {
    console.log('💳 Validating Stripe Integration...');

    if (!process.env.STRIPE_SECRET_KEY) {
      this.addResult({
        category: 'Stripe',
        check: 'API configuration',
        status: 'fail',
        details: 'Stripe secret key not configured',
        required: true
      });
      return;
    }

    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16'
      });

      // Test API connection
      const account = await stripe.accounts.retrieve();
      
      this.addResult({
        category: 'Stripe',
        check: 'API connection',
        status: 'pass',
        details: `Connected to account: ${account.email}`,
        required: true
      });

      // Check webhook configuration
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      this.addResult({
        category: 'Stripe',
        check: 'Webhook secret',
        status: webhookSecret ? 'pass' : 'fail',
        details: webhookSecret ? 'Webhook secret configured' : 'Webhook secret missing',
        required: true
      });

      // Check for required products/prices
      const products = await stripe.products.list({ limit: 10 });
      const hasProducts = products.data.length > 0;
      
      this.addResult({
        category: 'Stripe',
        check: 'Products configured',
        status: hasProducts ? 'pass' : 'warning',
        details: `${products.data.length} products found`,
        required: false
      });

    } catch (error: any) {
      this.addResult({
        category: 'Stripe',
        check: 'API connection',
        status: 'fail',
        details: `Connection failed: ${error.message}`,
        required: true
      });
    }
  }

  private async validateSendGridIntegration(): Promise<void> {
    console.log('📧 Validating SendGrid Integration...');

    if (!process.env.SENDGRID_API_KEY) {
      this.addResult({
        category: 'SendGrid',
        check: 'API configuration',
        status: 'fail',
        details: 'SendGrid API key not configured',
        required: true
      });
      return;
    }

    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      // Test API key validity (SendGrid doesn't have a direct test endpoint)
      // We'll validate the key format
      const keyValid = process.env.SENDGRID_API_KEY.startsWith('SG.');
      
      this.addResult({
        category: 'SendGrid',
        check: 'API key format',
        status: keyValid ? 'pass' : 'fail',
        details: keyValid ? 'Valid API key format' : 'Invalid API key format',
        required: true
      });

      // Check sender email
      const senderEmail = process.env.EMAIL_FROM;
      const emailValid = senderEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail);
      
      this.addResult({
        category: 'SendGrid',
        check: 'Sender email',
        status: emailValid ? 'pass' : 'fail',
        details: emailValid ? `Sender: ${senderEmail}` : 'Invalid sender email',
        required: true
      });

    } catch (error: any) {
      this.addResult({
        category: 'SendGrid',
        check: 'Configuration',
        status: 'fail',
        details: `Configuration error: ${error.message}`,
        required: true
      });
    }
  }

  private async validateBasiqIntegration(): Promise<void> {
    console.log('🏦 Validating BASIQ Integration...');

    if (!process.env.BASIQ_API_KEY) {
      this.addResult({
        category: 'BASIQ',
        check: 'API configuration',
        status: 'warning',
        details: 'BASIQ API key not configured (optional feature)',
        required: false
      });
      return;
    }

    try {
      // Test BASIQ API connection
      const response = await axios.post('https://au-api.basiq.io/token', {
        grant_type: 'client_credentials'
      }, {
        headers: {
          'Authorization': `Basic ${Buffer.from(process.env.BASIQ_API_KEY + ':').toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        validateStatus: () => true
      });

      this.addResult({
        category: 'BASIQ',
        check: 'API authentication',
        status: response.status === 200 ? 'pass' : 'fail',
        details: response.status === 200 ? 'Authentication successful' : `Auth failed: ${response.status}`,
        required: false
      });

    } catch (error: any) {
      this.addResult({
        category: 'BASIQ',
        check: 'API connection',
        status: 'fail',
        details: `Connection failed: ${error.message}`,
        required: false
      });
    }
  }

  private async validateAIServices(): Promise<void> {
    console.log('🤖 Validating AI Services...');

    // Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      this.addResult({
        category: 'AI Services',
        check: 'Anthropic API key',
        status: 'pass',
        details: 'API key configured',
        required: false
      });
    } else {
      this.addResult({
        category: 'AI Services',
        check: 'Anthropic API key',
        status: 'warning',
        details: 'API key not configured',
        required: false
      });
    }

    // OpenRouter
    if (process.env.OPENROUTER_API_KEY) {
      this.addResult({
        category: 'AI Services',
        check: 'OpenRouter API key',
        status: 'pass',
        details: 'API key configured',
        required: false
      });
    }

    // Gemini
    if (process.env.GEMINI_API_KEY) {
      this.addResult({
        category: 'AI Services',
        check: 'Gemini API key',
        status: 'pass',
        details: 'API key configured',
        required: false
      });
    }

    // At least one AI service should be configured
    const hasAnyAI = process.env.ANTHROPIC_API_KEY || 
                     process.env.OPENROUTER_API_KEY || 
                     process.env.GEMINI_API_KEY;

    this.addResult({
      category: 'AI Services',
      check: 'At least one AI service',
      status: hasAnyAI ? 'pass' : 'fail',
      details: hasAnyAI ? 'AI services available' : 'No AI services configured',
      required: true
    });
  }

  private async validateSSLConfiguration(): Promise<void> {
    console.log('🔒 Validating SSL Configuration...');

    if (process.env.NODE_ENV !== 'production') {
      this.addResult({
        category: 'SSL',
        check: 'SSL certificates',
        status: 'warning',
        details: 'SSL validation skipped (non-production)',
        required: false
      });
      return;
    }

    // Check if HTTPS is enforced
    const httpsUrl = process.env.NEXTAUTH_URL?.startsWith('https://');
    
    this.addResult({
      category: 'SSL',
      check: 'HTTPS enforcement',
      status: httpsUrl ? 'pass' : 'fail',
      details: httpsUrl ? 'HTTPS enforced' : 'HTTPS not enforced',
      required: true
    });

    // Check certificate files (if custom SSL)
    const certPaths = {
      cert: process.env.SSL_CERT_PATH || '/etc/ssl/certs/cert.pem',
      key: process.env.SSL_KEY_PATH || '/etc/ssl/private/key.pem'
    };

    for (const [type, path] of Object.entries(certPaths)) {
      if (fs.existsSync(path)) {
        this.addResult({
          category: 'SSL',
          check: `${type} file`,
          status: 'pass',
          details: `File exists: ${path}`,
          required: false
        });
      }
    }
  }

  private async validateFileSystem(): Promise<void> {
    console.log('📁 Validating File System...');

    const requiredDirs = [
      'logs',
      'uploads',
      'public',
      '.next'
    ];

    for (const dir of requiredDirs) {
      const dirPath = path.join(process.cwd(), dir);
      const exists = fs.existsSync(dirPath);
      
      if (exists) {
        // Check write permissions
        try {
          const testFile = path.join(dirPath, '.write-test');
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          
          this.addResult({
            category: 'File System',
            check: `Directory: ${dir}`,
            status: 'pass',
            details: 'Directory exists with write permissions',
            required: true
          });
        } catch {
          this.addResult({
            category: 'File System',
            check: `Directory: ${dir}`,
            status: 'fail',
            details: 'Directory exists but no write permissions',
            required: true
          });
        }
      } else {
        this.addResult({
          category: 'File System',
          check: `Directory: ${dir}`,
          status: 'fail',
          details: 'Directory does not exist',
          required: true
        });
      }
    }

    // Check disk space
    try {
      const { execSync } = require('child_process');
      const dfOutput = execSync('df -h .').toString();
      const lines = dfOutput.split('\n');
      const dataLine = lines[1];
      const usage = parseInt(dataLine.split(/\s+/)[4]);
      
      this.addResult({
        category: 'File System',
        check: 'Disk space',
        status: usage < 80 ? 'pass' : usage < 90 ? 'warning' : 'fail',
        details: `${usage}% disk usage`,
        required: true
      });
    } catch {
      this.addResult({
        category: 'File System',
        check: 'Disk space',
        status: 'warning',
        details: 'Could not check disk space',
        required: false
      });
    }
  }

  private async validateSystemResources(): Promise<void> {
    console.log('💻 Validating System Resources...');

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    
    this.addResult({
      category: 'System',
      check: 'Node.js version',
      status: majorVersion >= 18 ? 'pass' : 'fail',
      details: `Node.js ${nodeVersion} (required: >= 18)`,
      required: true
    });

    // Check memory
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    const usedPercent = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    this.addResult({
      category: 'System',
      check: 'Memory usage',
      status: usedPercent < 80 ? 'pass' : usedPercent < 90 ? 'warning' : 'fail',
      details: `${usedPercent.toFixed(1)}% memory used`,
      required: true
    });

    // Check CPU load
    const loadAverage = require('os').loadavg()[0];
    const cpuCount = require('os').cpus().length;
    const loadPerCpu = loadAverage / cpuCount;
    
    this.addResult({
      category: 'System',
      check: 'CPU load',
      status: loadPerCpu < 0.7 ? 'pass' : loadPerCpu < 0.9 ? 'warning' : 'fail',
      details: `Load average: ${loadAverage.toFixed(2)} (${cpuCount} CPUs)`,
      required: false
    });
  }

  private addResult(result: ValidationResult): void {
    this.report.results.push(result);
  }

  private calculateSummary(): void {
    this.report.summary.total = this.report.results.length;
    this.report.summary.passed = this.report.results.filter(r => r.status === 'pass').length;
    this.report.summary.failed = this.report.results.filter(r => r.status === 'fail').length;
    this.report.summary.warnings = this.report.results.filter(r => r.status === 'warning').length;

    // Check if any required checks failed
    const requiredFailed = this.report.results.filter(r => r.required && r.status === 'fail').length;
    
    if (requiredFailed > 0) {
      this.report.overallStatus = 'not_ready';
    } else if (this.report.summary.warnings > 0) {
      this.report.overallStatus = 'warnings';
    } else {
      this.report.overallStatus = 'ready';
    }
  }

  private async saveReport(): Promise<void> {
    const reportPath = path.join(process.cwd(), 'logs', 'environment-validation.json');
    
    await fs.promises.writeFile(
      reportPath,
      JSON.stringify(this.report, null, 2)
    );
  }

  private displayResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 ENVIRONMENT VALIDATION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\nEnvironment: ${this.report.environment.toUpperCase()}`);
    console.log(`Timestamp: ${this.report.timestamp.toISOString()}`);
    
    const statusEmoji = {
      ready: '✅',
      warnings: '⚠️',
      not_ready: '❌'
    };
    
    console.log(`\nOverall Status: ${statusEmoji[this.report.overallStatus]} ${this.report.overallStatus.toUpperCase().replace('_', ' ')}`);
    
    console.log('\n📊 Summary:');
    console.log(`  Total Checks: ${this.report.summary.total}`);
    console.log(`  Passed: ${this.report.summary.passed}`);
    console.log(`  Failed: ${this.report.summary.failed}`);
    console.log(`  Warnings: ${this.report.summary.warnings}`);
    
    // Group results by category
    const categories = [...new Set(this.report.results.map(r => r.category))];
    
    for (const category of categories) {
      console.log(`\n${category}:`);
      const categoryResults = this.report.results.filter(r => r.category === category);
      
      for (const result of categoryResults) {
        const icon = result.status === 'pass' ? '✅' : 
                    result.status === 'fail' ? '❌' : '⚠️';
        const required = result.required ? ' (required)' : '';
        
        console.log(`  ${icon} ${result.check}${required}`);
        if (result.status !== 'pass') {
          console.log(`     → ${result.details}`);
        }
      }
    }
    
    // Show critical failures
    const criticalFailures = this.report.results.filter(r => r.required && r.status === 'fail');
    
    if (criticalFailures.length > 0) {
      console.log('\n🚨 CRITICAL FAILURES (must be fixed):');
      criticalFailures.forEach(f => {
        console.log(`  - ${f.check}: ${f.details}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Main execution
async function main() {
  const validator = new EnvironmentValidator();
  const report = await validator.validate();
  
  if (report.overallStatus === 'not_ready') {
    console.error('\n❌ Environment is NOT ready for deployment!');
    process.exit(1);
  } else if (report.overallStatus === 'warnings') {
    console.warn('\n⚠️  Environment has warnings but can be deployed.');
    process.exit(0);
  } else {
    console.log('\n✅ Environment is ready for deployment!');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { EnvironmentValidator, EnvironmentReport };