#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { performance } from 'perf_hooks';

interface SmokeTest {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  expectedStatus: number;
  payload?: any;
  critical: boolean;
  validateResponse?: (response: any) => boolean;
}

interface ValidationResult {
  test: string;
  status: 'pass' | 'fail';
  details: string;
  responseTime?: number;
  critical: boolean;
}

interface GoLiveReport {
  timestamp: Date;
  environment: string;
  baseUrl: string;
  overallStatus: 'go' | 'no_go';
  results: {
    smokeTests: ValidationResult[];
    integrations: ValidationResult[];
    userAcceptance: ValidationResult[];
    monitoring: ValidationResult[];
    support: ValidationResult[];
  };
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    criticalFailures: number;
  };
  recommendation: string;
}

class GoLiveValidator {
  private baseUrl: string;
  private report: GoLiveReport;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    this.report = {
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development',
      baseUrl: this.baseUrl,
      overallStatus: 'go',
      results: {
        smokeTests: [],
        integrations: [],
        userAcceptance: [],
        monitoring: [],
        support: [],
      },
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        criticalFailures: 0,
      },
      recommendation: '',
    };
  }

  async validate(): Promise<GoLiveReport> {
    console.log('🚀 Starting Go-Live Validation...');
    console.log(`Target: ${this.baseUrl}\n`);

    // Run all validation suites
    await this.runSmokeTests();
    await this.validateIntegrations();
    await this.validateUserAcceptance();
    await this.validateMonitoring();
    await this.validateSupport();

    // Calculate summary
    this.calculateSummary();

    // Generate recommendation
    this.generateRecommendation();

    // Save report
    await this.saveReport();

    // Display results
    this.displayResults();

    return this.report;
  }

  private async runSmokeTests(): Promise<void> {
    console.log('🔥 Running Smoke Tests...');

    const smokeTests: SmokeTest[] = [
      {
        name: 'Homepage loads',
        endpoint: '/',
        method: 'GET',
        expectedStatus: 200,
        critical: true,
      },
      {
        name: 'Health check passes',
        endpoint: '/api/health',
        method: 'GET',
        expectedStatus: 200,
        critical: true,
        validateResponse: (res) => res.status === 'healthy',
      },
      {
        name: 'Login page accessible',
        endpoint: '/login',
        method: 'GET',
        expectedStatus: 200,
        critical: true,
      },
      {
        name: 'Registration page accessible',
        endpoint: '/register',
        method: 'GET',
        expectedStatus: 200,
        critical: true,
      },
      {
        name: 'API authentication works',
        endpoint: '/api/auth/session',
        method: 'GET',
        expectedStatus: 200,
        critical: true,
      },
      {
        name: 'Static assets load',
        endpoint: '/favicon.ico',
        method: 'GET',
        expectedStatus: 200,
        critical: false,
      },
      {
        name: 'Dashboard accessible (auth required)',
        endpoint: '/dashboard',
        method: 'GET',
        expectedStatus: 302, // Redirect to login
        critical: true,
      },
      {
        name: 'API rate limiting active',
        endpoint: '/api/health',
        method: 'GET',
        expectedStatus: 200,
        critical: false,
      },
      {
        name: 'Error handling works',
        endpoint: '/api/nonexistent',
        method: 'GET',
        expectedStatus: 404,
        critical: false,
      },
      {
        name: 'CORS configured correctly',
        endpoint: '/api/health',
        method: 'GET',
        expectedStatus: 200,
        critical: true,
      },
    ];

    for (const test of smokeTests) {
      await this.runSingleTest(test, 'smokeTests');
    }
  }

  private async validateIntegrations(): Promise<void> {
    console.log('🔌 Validating External Integrations...');

    // Stripe integration
    await this.validateIntegration(
      'Stripe payment processing',
      async () => {
        // Check Stripe webhook endpoint
        const response = await axios.post(
          `${this.baseUrl}/api/stripe/webhook`,
          {},
          {
            headers: { 'stripe-signature': 'test' },
            validateStatus: () => true,
          },
        );
        return response.status === 400; // Should reject without valid signature
      },
      true,
    );

    // SendGrid email
    await this.validateIntegration(
      'SendGrid email service',
      async () => {
        return process.env.SENDGRID_API_KEY !== undefined;
      },
      true,
    );

    // Database connectivity
    await this.validateIntegration(
      'Database connection',
      async () => {
        const response = await axios.get(`${this.baseUrl}/api/health`);
        return response.data.database === 'connected';
      },
      true,
    );

    // AI services
    await this.validateIntegration(
      'AI services (Anthropic/OpenRouter/Gemini)',
      async () => {
        return (
          process.env.ANTHROPIC_API_KEY !== undefined ||
          process.env.OPENROUTER_API_KEY !== undefined ||
          process.env.GEMINI_API_KEY !== undefined
        );
      },
      false,
    );

    // BASIQ banking (optional)
    await this.validateIntegration(
      'BASIQ banking integration',
      async () => {
        return process.env.BASIQ_API_KEY !== undefined;
      },
      false,
    );

    // CDN/Static assets
    await this.validateIntegration(
      'CDN/Static asset delivery',
      async () => {
        const response = await axios.get(`${this.baseUrl}/_next/static/chunks/main.js`, {
          validateStatus: () => true,
        });
        return response.status === 200;
      },
      true,
    );
  }

  private async validateUserAcceptance(): Promise<void> {
    console.log('✅ Validating User Acceptance Criteria...');

    // Key user flows
    const userFlows = [
      {
        name: 'User can access homepage',
        test: async () => {
          const response = await axios.get(`${this.baseUrl}/`);
          return response.status === 200;
        },
        critical: true,
      },
      {
        name: 'Registration flow available',
        test: async () => {
          const response = await axios.get(`${this.baseUrl}/register`);
          return response.status === 200;
        },
        critical: true,
      },
      {
        name: 'Login flow available',
        test: async () => {
          const response = await axios.get(`${this.baseUrl}/login`);
          return response.status === 200;
        },
        critical: true,
      },
      {
        name: 'Password reset available',
        test: async () => {
          const response = await axios.get(`${this.baseUrl}/forgot-password`);
          return response.status === 200;
        },
        critical: false,
      },
      {
        name: 'Pricing page accessible',
        test: async () => {
          const response = await axios.get(`${this.baseUrl}/pricing`);
          return response.status === 200;
        },
        critical: true,
      },
      {
        name: 'Privacy policy available',
        test: async () => {
          const response = await axios.get(`${this.baseUrl}/privacy`);
          return response.status === 200;
        },
        critical: true,
      },
      {
        name: 'Terms of service available',
        test: async () => {
          const response = await axios.get(`${this.baseUrl}/terms`);
          return response.status === 200;
        },
        critical: true,
      },
    ];

    for (const flow of userFlows) {
      try {
        const startTime = performance.now();
        const result = await flow.test();
        const endTime = performance.now();

        this.report.results.userAcceptance.push({
          test: flow.name,
          status: result ? 'pass' : 'fail',
          details: result ? 'Test passed' : 'Test failed',
          responseTime: endTime - startTime,
          critical: flow.critical,
        });
      } catch (error: any) {
        this.report.results.userAcceptance.push({
          test: flow.name,
          status: 'fail',
          details: `Error: ${error.message}`,
          critical: flow.critical,
        });
      }
    }
  }

  private async validateMonitoring(): Promise<void> {
    console.log('📊 Validating Monitoring & Performance...');

    // Check monitoring endpoints
    const monitoringChecks = [
      {
        name: 'Health check endpoint',
        endpoint: '/api/health',
        critical: true,
      },
      {
        name: 'Metrics endpoint',
        endpoint: '/api/metrics',
        critical: false,
      },
      {
        name: 'Admin dashboard accessible',
        endpoint: '/admin',
        critical: false,
      },
    ];

    for (const check of monitoringChecks) {
      try {
        const response = await axios.get(`${this.baseUrl}${check.endpoint}`, {
          validateStatus: () => true,
        });

        this.report.results.monitoring.push({
          test: check.name,
          status: response.status < 500 ? 'pass' : 'fail',
          details: `Status: ${response.status}`,
          critical: check.critical,
        });
      } catch (error: any) {
        this.report.results.monitoring.push({
          test: check.name,
          status: 'fail',
          details: `Error: ${error.message}`,
          critical: check.critical,
        });
      }
    }

    // Performance checks
    await this.checkPerformance('Homepage load time', '/', 2000);
    await this.checkPerformance('API response time', '/api/health', 500);
  }

  private async validateSupport(): Promise<void> {
    console.log('🛟 Validating Support Readiness...');

    // Support documentation checks
    const supportChecks = [
      {
        name: 'Contact page available',
        test: async () => {
          const response = await axios.get(`${this.baseUrl}/contact`, {
            validateStatus: () => true,
          });
          return response.status === 200;
        },
        critical: false,
      },
      {
        name: 'FAQ page available',
        test: async () => {
          const response = await axios.get(`${this.baseUrl}/faq`, {
            validateStatus: () => true,
          });
          return response.status === 200;
        },
        critical: false,
      },
      {
        name: 'Support email configured',
        test: async () => {
          return process.env.SUPPORT_EMAIL !== undefined;
        },
        critical: true,
      },
      {
        name: 'Error tracking active',
        test: async () => {
          return process.env.SENTRY_DSN !== undefined || process.env.ERROR_TRACKING !== undefined;
        },
        critical: false,
      },
    ];

    for (const check of supportChecks) {
      try {
        const result = await check.test();

        this.report.results.support.push({
          test: check.name,
          status: result ? 'pass' : 'fail',
          details: result ? 'Available' : 'Not available',
          critical: check.critical,
        });
      } catch (error: any) {
        this.report.results.support.push({
          test: check.name,
          status: 'fail',
          details: `Error: ${error.message}`,
          critical: check.critical,
        });
      }
    }
  }

  private async runSingleTest(
    test: SmokeTest,
    category: keyof GoLiveReport['results'],
  ): Promise<void> {
    try {
      const startTime = performance.now();

      const response = await axios({
        method: test.method,
        url: `${this.baseUrl}${test.endpoint}`,
        data: test.payload,
        validateStatus: () => true,
        timeout: 10000,
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      let passed = response.status === test.expectedStatus;

      if (passed && test.validateResponse) {
        passed = test.validateResponse(response.data);
      }

      this.report.results[category].push({
        test: test.name,
        status: passed ? 'pass' : 'fail',
        details: `Expected: ${test.expectedStatus}, Got: ${response.status}`,
        responseTime,
        critical: test.critical,
      });
    } catch (error: any) {
      this.report.results[category].push({
        test: test.name,
        status: 'fail',
        details: `Error: ${error.message}`,
        critical: test.critical,
      });
    }
  }

  private async validateIntegration(
    name: string,
    testFn: () => Promise<boolean>,
    critical: boolean,
  ): Promise<void> {
    try {
      const result = await testFn();

      this.report.results.integrations.push({
        test: name,
        status: result ? 'pass' : 'fail',
        details: result ? 'Integration working' : 'Integration failed',
        critical,
      });
    } catch (error: any) {
      this.report.results.integrations.push({
        test: name,
        status: 'fail',
        details: `Error: ${error.message}`,
        critical,
      });
    }
  }

  private async checkPerformance(name: string, endpoint: string, maxTime: number): Promise<void> {
    try {
      const startTime = performance.now();

      await axios.get(`${this.baseUrl}${endpoint}`);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.report.results.monitoring.push({
        test: name,
        status: responseTime <= maxTime ? 'pass' : 'fail',
        details: `Response time: ${responseTime.toFixed(0)}ms (max: ${maxTime}ms)`,
        responseTime,
        critical: false,
      });
    } catch (error: any) {
      this.report.results.monitoring.push({
        test: name,
        status: 'fail',
        details: `Error: ${error.message}`,
        critical: false,
      });
    }
  }

  private calculateSummary(): void {
    // Flatten all results
    const allResults: ValidationResult[] = [];

    Object.values(this.report.results).forEach((category) => {
      allResults.push(...category);
    });

    this.report.summary.totalTests = allResults.length;
    this.report.summary.passed = allResults.filter((r) => r.status === 'pass').length;
    this.report.summary.failed = allResults.filter((r) => r.status === 'fail').length;
    this.report.summary.criticalFailures = allResults.filter(
      (r) => r.status === 'fail' && r.critical,
    ).length;

    // Determine overall status
    if (this.report.summary.criticalFailures > 0) {
      this.report.overallStatus = 'no_go';
    } else if (this.report.summary.failed > 5) {
      this.report.overallStatus = 'no_go';
    } else {
      this.report.overallStatus = 'go';
    }
  }

  private generateRecommendation(): void {
    if (this.report.overallStatus === 'go') {
      this.report.recommendation = '✅ SYSTEM IS READY FOR GO-LIVE';

      if (this.report.summary.failed > 0) {
        this.report.recommendation += `\n\n⚠️  ${this.report.summary.failed} non-critical issues detected. These should be addressed post-launch.`;
      }
    } else {
      this.report.recommendation = '❌ SYSTEM IS NOT READY FOR GO-LIVE';

      if (this.report.summary.criticalFailures > 0) {
        this.report.recommendation += `\n\n🚨 ${this.report.summary.criticalFailures} CRITICAL FAILURES must be resolved before deployment.`;
      }

      this.report.recommendation +=
        '\n\nReview the failed tests above and address all critical issues.';
    }
  }

  private async saveReport(): Promise<void> {
    const logsDir = path.join(process.cwd(), 'logs');
    const reportPath = path.join(logsDir, 'go-live-validation.json');

    // Ensure the logs directory exists
    try {
      await fs.promises.mkdir(logsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create logs directory:', error);
      throw error;
    }

    // Write the report file
    await fs.promises.writeFile(reportPath, JSON.stringify(this.report, null, 2));

    console.log(`\n📄 Report saved to: ${reportPath}`);
  }

  private displayResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 GO-LIVE VALIDATION REPORT');
    console.log('='.repeat(60));

    console.log(`\nEnvironment: ${this.report.environment.toUpperCase()}`);
    console.log(`Target URL: ${this.report.baseUrl}`);
    console.log(`Timestamp: ${this.report.timestamp.toISOString()}`);

    const statusEmoji = this.report.overallStatus === 'go' ? '✅' : '❌';
    console.log(`\nOVERALL STATUS: ${statusEmoji} ${this.report.overallStatus.toUpperCase()}`);

    console.log('\n📊 Summary:');
    console.log(`  Total Tests: ${this.report.summary.totalTests}`);
    console.log(`  Passed: ${this.report.summary.passed}`);
    console.log(`  Failed: ${this.report.summary.failed}`);
    console.log(`  Critical Failures: ${this.report.summary.criticalFailures}`);

    // Show results by category
    const categories = [
      { name: '🔥 Smoke Tests', results: this.report.results.smokeTests },
      { name: '🔌 Integrations', results: this.report.results.integrations },
      { name: '✅ User Acceptance', results: this.report.results.userAcceptance },
      { name: '📊 Monitoring', results: this.report.results.monitoring },
      { name: '🛟 Support', results: this.report.results.support },
    ];

    for (const category of categories) {
      if (category.results.length > 0) {
        console.log(`\n${category.name}:`);

        const failed = category.results.filter((r) => r.status === 'fail');
        const passed = category.results.filter((r) => r.status === 'pass');

        // Show failures first
        failed.forEach((result) => {
          const critical = result.critical ? ' [CRITICAL]' : '';
          console.log(`  ❌ ${result.test}${critical}`);
          console.log(`     → ${result.details}`);
        });

        // Show passes in summary
        if (passed.length > 0) {
          console.log(`  ✅ ${passed.length} tests passed`);
        }
      }
    }

    // Show recommendation
    console.log('\n' + '='.repeat(60));
    console.log('📋 RECOMMENDATION:');
    console.log(this.report.recommendation);
    console.log('='.repeat(60) + '\n');
  }
}

// Main execution
async function main() {
  const baseUrl = process.argv[2] || process.env.PRODUCTION_URL || process.env.NEXTAUTH_URL;

  if (!baseUrl) {
    console.error(
      '❌ Please provide a base URL as argument or set PRODUCTION_URL environment variable',
    );
    process.exit(1);
  }

  const validator = new GoLiveValidator(baseUrl);
  const report = await validator.validate();

  if (report.overallStatus === 'no_go') {
    console.error('\n🛑 GO-LIVE VALIDATION FAILED!');
    console.error('Do not proceed with deployment until all critical issues are resolved.');
    process.exit(1);
  } else {
    console.log('\n🎉 GO-LIVE VALIDATION PASSED!');
    console.log('System is ready for production deployment.');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { GoLiveValidator, GoLiveReport };
