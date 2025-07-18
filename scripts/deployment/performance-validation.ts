#!/usr/bin/env npx tsx

import axios from 'axios';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface PerformanceTest {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  payload?: any;
  expectedTime: number; // milliseconds
  concurrentUsers?: number;
}

interface PerformanceResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  metrics: {
    avgResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    successRate: number;
    requestsPerSecond: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  details: string;
}

interface PerformanceReport {
  timestamp: Date;
  baseUrl: string;
  overallStatus: 'pass' | 'fail' | 'warning';
  results: PerformanceResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    warnings: number;
    avgResponseTime: number;
    successRate: number;
  };
  recommendations: string[];
}

class PerformanceValidator {
  private baseUrl: string;
  private authToken?: string;
  private report: PerformanceReport;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl || 'http://localhost:3000';
    this.report = {
      timestamp: new Date(),
      baseUrl: this.baseUrl,
      overallStatus: 'pass',
      results: [],
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        avgResponseTime: 0,
        successRate: 0
      },
      recommendations: []
    };
  }

  async runValidation(): Promise<PerformanceReport> {
    console.log('🚀 Starting Performance Validation...');
    console.log(`Target: ${this.baseUrl}\n`);

    try {
      // Authenticate first if needed
      await this.authenticate();

      // Run performance tests
      await this.testCriticalEndpoints();
      await this.testDatabasePerformance();
      await this.testConcurrentUsers();
      await this.testResourceIntensiveOperations();
      await this.testCDNPerformance();
      await this.testCachingEffectiveness();

      // Calculate summary
      this.calculateSummary();

      // Generate recommendations
      this.generateRecommendations();

      // Save report
      await this.saveReport();

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('Performance validation error:', error);
    }

    return this.report;
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
        email: process.env.TEST_USER_EMAIL || 'test@example.com',
        password: process.env.TEST_USER_PASSWORD || 'testpassword'
      });

      if (response.data.token) {
        this.authToken = response.data.token;
      }
    } catch (error) {
      console.warn('Authentication failed, running tests without auth');
    }
  }

  private async testCriticalEndpoints(): Promise<void> {
    console.log('📍 Testing Critical Endpoints...');

    const criticalTests: PerformanceTest[] = [
      {
        name: 'Homepage',
        endpoint: '/',
        method: 'GET',
        expectedTime: 200
      },
      {
        name: 'Login Page',
        endpoint: '/login',
        method: 'GET',
        expectedTime: 150
      },
      {
        name: 'Dashboard',
        endpoint: '/dashboard',
        method: 'GET',
        expectedTime: 500
      },
      {
        name: 'API Health Check',
        endpoint: '/api/health',
        method: 'GET',
        expectedTime: 50
      },
      {
        name: 'User Profile API',
        endpoint: '/api/users/profile',
        method: 'GET',
        expectedTime: 200
      },
      {
        name: 'Transactions List',
        endpoint: '/api/transactions?limit=20',
        method: 'GET',
        expectedTime: 300
      }
    ];

    for (const test of criticalTests) {
      await this.runPerformanceTest(test);
    }
  }

  private async testDatabasePerformance(): Promise<void> {
    console.log('🗄️  Testing Database Performance...');

    const dbTests: PerformanceTest[] = [
      {
        name: 'Complex Query - User Analytics',
        endpoint: '/api/analytics/user-summary',
        method: 'GET',
        expectedTime: 500
      },
      {
        name: 'Bulk Data Fetch - Transactions',
        endpoint: '/api/transactions?limit=100',
        method: 'GET',
        expectedTime: 800
      },
      {
        name: 'Search Operation',
        endpoint: '/api/search?q=test&type=all',
        method: 'GET',
        expectedTime: 400
      },
      {
        name: 'Aggregation Query',
        endpoint: '/api/reports/monthly-summary',
        method: 'GET',
        expectedTime: 600
      }
    ];

    for (const test of dbTests) {
      await this.runPerformanceTest(test);
    }
  }

  private async testConcurrentUsers(): Promise<void> {
    console.log('👥 Testing Concurrent Users...');

    const concurrentTests: PerformanceTest[] = [
      {
        name: 'Login - 10 concurrent users',
        endpoint: '/api/auth/login',
        method: 'POST',
        payload: { email: 'test@example.com', password: 'test' },
        expectedTime: 500,
        concurrentUsers: 10
      },
      {
        name: 'Dashboard - 20 concurrent users',
        endpoint: '/dashboard',
        method: 'GET',
        expectedTime: 1000,
        concurrentUsers: 20
      },
      {
        name: 'API Load - 50 concurrent requests',
        endpoint: '/api/transactions',
        method: 'GET',
        expectedTime: 2000,
        concurrentUsers: 50
      }
    ];

    for (const test of concurrentTests) {
      await this.runConcurrentTest(test);
    }
  }

  private async testResourceIntensiveOperations(): Promise<void> {
    console.log('⚡ Testing Resource Intensive Operations...');

    const intensiveTests: PerformanceTest[] = [
      {
        name: 'Receipt Processing',
        endpoint: '/api/ai/process-receipt',
        method: 'POST',
        payload: { imageUrl: 'test.jpg' },
        expectedTime: 3000
      },
      {
        name: 'Report Generation',
        endpoint: '/api/reports/generate',
        method: 'POST',
        payload: { type: 'annual', year: 2024 },
        expectedTime: 5000
      },
      {
        name: 'Data Export',
        endpoint: '/api/export/transactions',
        method: 'POST',
        payload: { format: 'csv', dateRange: 'year' },
        expectedTime: 4000
      }
    ];

    for (const test of intensiveTests) {
      await this.runPerformanceTest(test);
    }
  }

  private async testCDNPerformance(): Promise<void> {
    console.log('🌐 Testing CDN Performance...');

    const staticAssets = [
      '/_next/static/css/main.css',
      '/_next/static/js/main.js',
      '/images/logo.png',
      '/favicon.ico'
    ];

    for (const asset of staticAssets) {
      const test: PerformanceTest = {
        name: `Static Asset: ${asset}`,
        endpoint: asset,
        method: 'GET',
        expectedTime: 100
      };
      
      await this.runPerformanceTest(test);
    }
  }

  private async testCachingEffectiveness(): Promise<void> {
    console.log('💾 Testing Caching Effectiveness...');

    // Test cache hit rates
    const cacheTests = [
      {
        name: 'API Cache - User Profile',
        endpoint: '/api/users/profile',
        method: 'GET',
        expectedTime: 50
      },
      {
        name: 'Page Cache - Dashboard',
        endpoint: '/dashboard',
        method: 'GET',
        expectedTime: 100
      }
    ];

    for (const test of cacheTests) {
      // First request (cache miss)
      await this.runPerformanceTest({
        ...test,
        name: `${test.name} (First Request)`
      });

      // Second request (cache hit)
      await this.runPerformanceTest({
        ...test,
        name: `${test.name} (Cached)`,
        expectedTime: test.expectedTime / 2
      });
    }
  }

  private async runPerformanceTest(test: PerformanceTest): Promise<void> {
    const iterations = 10;
    const responseTimes: number[] = [];
    let successCount = 0;

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        const response = await axios({
          method: test.method,
          url: `${this.baseUrl}${test.endpoint}`,
          data: test.payload,
          headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
          timeout: 30000,
          validateStatus: (status) => status < 500
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        if (response.status < 400) {
          successCount++;
          responseTimes.push(responseTime);
        }
      } catch (error) {
        // Request failed
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate metrics
    if (responseTimes.length > 0) {
      responseTimes.sort((a, b) => a - b);
      
      const metrics = {
        avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        minResponseTime: responseTimes[0],
        maxResponseTime: responseTimes[responseTimes.length - 1],
        successRate: (successCount / iterations) * 100,
        requestsPerSecond: 1000 / (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
        p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)],
        p99ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.99)]
      };

      const status = metrics.avgResponseTime <= test.expectedTime ? 'pass' :
                    metrics.avgResponseTime <= test.expectedTime * 1.5 ? 'warning' : 'fail';

      this.report.results.push({
        test: test.name,
        status,
        metrics,
        details: `Avg: ${metrics.avgResponseTime.toFixed(0)}ms (expected: <${test.expectedTime}ms)`
      });
    } else {
      this.report.results.push({
        test: test.name,
        status: 'fail',
        metrics: {
          avgResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          successRate: 0,
          requestsPerSecond: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0
        },
        details: 'All requests failed'
      });
    }
  }

  private async runConcurrentTest(test: PerformanceTest): Promise<void> {
    const concurrentUsers = test.concurrentUsers || 10;
    const promises: Promise<any>[] = [];
    const responseTimes: number[] = [];
    let successCount = 0;

    console.log(`  Running ${concurrentUsers} concurrent requests...`);

    const startTime = performance.now();

    for (let i = 0; i < concurrentUsers; i++) {
      promises.push(
        axios({
          method: test.method,
          url: `${this.baseUrl}${test.endpoint}`,
          data: test.payload,
          headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
          timeout: 30000,
          validateStatus: (status) => status < 500
        }).then(response => {
          const endTime = performance.now();
          if (response.status < 400) {
            successCount++;
            responseTimes.push(endTime - startTime);
          }
        }).catch(() => {
          // Request failed
        })
      );
    }

    await Promise.all(promises);

    if (responseTimes.length > 0) {
      responseTimes.sort((a, b) => a - b);
      
      const metrics = {
        avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        minResponseTime: responseTimes[0],
        maxResponseTime: responseTimes[responseTimes.length - 1],
        successRate: (successCount / concurrentUsers) * 100,
        requestsPerSecond: (concurrentUsers * 1000) / responseTimes[responseTimes.length - 1],
        p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)],
        p99ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.99)]
      };

      const status = metrics.avgResponseTime <= test.expectedTime ? 'pass' :
                    metrics.avgResponseTime <= test.expectedTime * 1.5 ? 'warning' : 'fail';

      this.report.results.push({
        test: test.name,
        status,
        metrics,
        details: `Avg: ${metrics.avgResponseTime.toFixed(0)}ms, Success: ${metrics.successRate.toFixed(1)}%`
      });
    } else {
      this.report.results.push({
        test: test.name,
        status: 'fail',
        metrics: {
          avgResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          successRate: 0,
          requestsPerSecond: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0
        },
        details: 'All concurrent requests failed'
      });
    }
  }

  private calculateSummary(): void {
    this.report.summary.totalTests = this.report.results.length;
    this.report.summary.passed = this.report.results.filter(r => r.status === 'pass').length;
    this.report.summary.failed = this.report.results.filter(r => r.status === 'fail').length;
    this.report.summary.warnings = this.report.results.filter(r => r.status === 'warning').length;

    const allResponseTimes = this.report.results
      .filter(r => r.metrics.avgResponseTime > 0)
      .map(r => r.metrics.avgResponseTime);

    if (allResponseTimes.length > 0) {
      this.report.summary.avgResponseTime = 
        allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length;
    }

    const allSuccessRates = this.report.results
      .filter(r => r.metrics.successRate >= 0)
      .map(r => r.metrics.successRate);

    if (allSuccessRates.length > 0) {
      this.report.summary.successRate = 
        allSuccessRates.reduce((a, b) => a + b, 0) / allSuccessRates.length;
    }

    // Determine overall status
    if (this.report.summary.failed > 0) {
      this.report.overallStatus = 'fail';
    } else if (this.report.summary.warnings > 3) {
      this.report.overallStatus = 'warning';
    } else {
      this.report.overallStatus = 'pass';
    }
  }

  private generateRecommendations(): void {
    // Analyze results and generate recommendations
    const slowEndpoints = this.report.results.filter(
      r => r.status === 'fail' || r.status === 'warning'
    );

    if (slowEndpoints.length > 0) {
      this.report.recommendations.push(
        `Optimize ${slowEndpoints.length} slow endpoints`
      );
    }

    const avgResponseTime = this.report.summary.avgResponseTime;
    if (avgResponseTime > 500) {
      this.report.recommendations.push(
        'Consider implementing more aggressive caching strategies'
      );
    }

    const lowSuccessRate = this.report.results.filter(
      r => r.metrics.successRate < 95
    );

    if (lowSuccessRate.length > 0) {
      this.report.recommendations.push(
        'Investigate and fix reliability issues in failing endpoints'
      );
    }

    // Check for database performance issues
    const dbTests = this.report.results.filter(r => 
      r.test.includes('Database') || r.test.includes('Query')
    );
    
    const slowDbTests = dbTests.filter(r => r.status !== 'pass');
    if (slowDbTests.length > 0) {
      this.report.recommendations.push(
        'Optimize database queries and consider adding indexes'
      );
    }

    // Check concurrent user performance
    const concurrentTests = this.report.results.filter(r => 
      r.test.includes('concurrent')
    );
    
    const failedConcurrent = concurrentTests.filter(r => r.status === 'fail');
    if (failedConcurrent.length > 0) {
      this.report.recommendations.push(
        'Scale infrastructure to handle concurrent load'
      );
    }
  }

  private async saveReport(): Promise<void> {
    const reportPath = path.join(process.cwd(), 'logs', 'performance-validation.json');
    
    await fs.promises.writeFile(
      reportPath,
      JSON.stringify(this.report, null, 2)
    );
  }

  private displayResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 PERFORMANCE VALIDATION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\nTarget: ${this.report.baseUrl}`);
    console.log(`Timestamp: ${this.report.timestamp.toISOString()}`);
    
    const statusEmoji = {
      pass: '✅',
      warning: '⚠️',
      fail: '❌'
    };
    
    console.log(`\nOverall Status: ${statusEmoji[this.report.overallStatus]} ${this.report.overallStatus.toUpperCase()}`);
    
    console.log('\n📊 Summary:');
    console.log(`  Total Tests: ${this.report.summary.totalTests}`);
    console.log(`  Passed: ${this.report.summary.passed}`);
    console.log(`  Failed: ${this.report.summary.failed}`);
    console.log(`  Warnings: ${this.report.summary.warnings}`);
    console.log(`  Average Response Time: ${this.report.summary.avgResponseTime.toFixed(0)}ms`);
    console.log(`  Overall Success Rate: ${this.report.summary.successRate.toFixed(1)}%`);
    
    // Show failed tests
    const failedTests = this.report.results.filter(r => r.status === 'fail');
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`  - ${test.test}: ${test.details}`);
      });
    }
    
    // Show warnings
    const warningTests = this.report.results.filter(r => r.status === 'warning');
    if (warningTests.length > 0) {
      console.log('\n⚠️  Warning Tests:');
      warningTests.forEach(test => {
        console.log(`  - ${test.test}: ${test.details}`);
      });
    }
    
    // Show recommendations
    if (this.report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      this.report.recommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }
    
    // Show top 5 slowest endpoints
    const sortedByTime = [...this.report.results]
      .filter(r => r.metrics.avgResponseTime > 0)
      .sort((a, b) => b.metrics.avgResponseTime - a.metrics.avgResponseTime)
      .slice(0, 5);
    
    console.log('\n🐌 Slowest Endpoints:');
    sortedByTime.forEach(test => {
      console.log(`  - ${test.test}: ${test.metrics.avgResponseTime.toFixed(0)}ms`);
    });
    
    console.log('\n' + '='.repeat(60));
  }
}

// Main execution
async function main() {
  const baseUrl = process.argv[2] || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const validator = new PerformanceValidator(baseUrl);
  
  const report = await validator.runValidation();
  
  if (report.overallStatus === 'fail') {
    console.error('\n❌ Performance validation FAILED!');
    process.exit(1);
  } else if (report.overallStatus === 'warning') {
    console.warn('\n⚠️  Performance validation passed with warnings.');
    process.exit(0);
  } else {
    console.log('\n✅ Performance validation PASSED!');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { PerformanceValidator, PerformanceReport };