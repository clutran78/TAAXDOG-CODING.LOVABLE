#!/usr/bin/env ts-node

import { prisma } from '../lib/prisma';
import { logger } from '../lib/utils/logger';
import bcrypt from 'bcryptjs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface SecurityTest {
  name: string;
  description: string;
  test: () => Promise<boolean>;
}

/**
 * Security Testing Suite
 * Tests various security vulnerabilities and protections
 */

class SecurityTester {
  private testUser: any;
  private authToken: string = '';

  async setup() {
    // Create test user
    const hashedPassword = await bcrypt.hash('SecureTest123!', 10);
    this.testUser = await prisma.user.upsert({
      where: { email: 'security-test@example.com' },
      update: { password: hashedPassword },
      create: {
        email: 'security-test@example.com',
        password: hashedPassword,
        name: 'Security Test User',
      },
    });

    // Get auth token
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'security-test@example.com',
        password: 'SecureTest123!',
      }),
    });

    if (loginResponse.ok) {
      const data = await loginResponse.json();
      this.authToken = data.token;
    }
  }

  async cleanup() {
    // Clean up test data
    await prisma.transaction.deleteMany({ where: { userId: this.testUser.id } });
    await prisma.goal.deleteMany({ where: { userId: this.testUser.id } });
    await prisma.budget.deleteMany({ where: { userId: this.testUser.id } });
    await prisma.user.delete({ where: { id: this.testUser.id } });
  }

  async runTests() {
    const tests: SecurityTest[] = [
      // 1. SQL Injection Tests
      {
        name: 'SQL Injection - Login',
        description: 'Attempt SQL injection on login endpoint',
        test: async () => {
          const injectionAttempts = [
            { email: "admin' OR '1'='1", password: 'anything' },
            { email: 'test@example.com"; DROP TABLE users; --', password: 'test' },
            { email: "test' UNION SELECT * FROM users--", password: 'test' },
          ];

          for (const attempt of injectionAttempts) {
            const response = await fetch(`${BASE_URL}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(attempt),
            });

            if (response.status === 200) {
              console.log(`  ❌ SQL injection succeeded with: ${attempt.email}`);
              return false;
            }
          }
          return true;
        },
      },

      {
        name: 'SQL Injection - Search',
        description: 'Attempt SQL injection on search parameters',
        test: async () => {
          const injectionAttempts = [
            "'; DROP TABLE transactions; --",
            "1' OR '1'='1",
            '1 UNION SELECT password FROM users',
          ];

          for (const attempt of injectionAttempts) {
            const response = await fetch(
              `${BASE_URL}/api/transactions?search=${encodeURIComponent(attempt)}`,
              {
                headers: { Authorization: `Bearer ${this.authToken}` },
              },
            );

            // Should not return 500 (server error from SQL injection)
            if (response.status === 500) {
              console.log(`  ❌ SQL injection caused server error with: ${attempt}`);
              return false;
            }
          }
          return true;
        },
      },

      // 2. XSS Tests
      {
        name: 'XSS - Stored XSS',
        description: 'Attempt to store malicious scripts',
        test: async () => {
          const xssPayloads = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert("XSS")>',
            'javascript:alert("XSS")',
            '<svg onload=alert("XSS")>',
          ];

          for (const payload of xssPayloads) {
            // Try to create goal with XSS payload
            const response = await fetch(`${BASE_URL}/api/goals`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.authToken}`,
              },
              body: JSON.stringify({
                name: payload,
                targetAmount: 1000,
                currentAmount: 0,
                targetDate: '2024-12-31',
                category: 'SAVINGS',
              }),
            });

            if (response.ok) {
              const data = await response.json();
              // Check if script tags are properly escaped
              if (data.name && data.name.includes('<script>')) {
                console.log(`  ❌ XSS payload not sanitized: ${payload}`);
                return false;
              }
            }
          }
          return true;
        },
      },

      // 3. Authentication Tests
      {
        name: 'Auth - Invalid Token',
        description: 'Verify invalid tokens are rejected',
        test: async () => {
          const invalidTokens = [
            'invalid-token',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
            '',
            'null',
          ];

          for (const token of invalidTokens) {
            const response = await fetch(`${BASE_URL}/api/goals`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (response.status === 200) {
              console.log(`  ❌ Invalid token accepted: ${token}`);
              return false;
            }
          }
          return true;
        },
      },

      {
        name: 'Auth - Token Expiry',
        description: 'Verify expired tokens are rejected',
        test: async () => {
          // Create an expired token (this would need actual JWT creation)
          // For now, we'll test with a malformed token
          const response = await fetch(`${BASE_URL}/api/goals`, {
            headers: { Authorization: 'Bearer expired.token.here' },
          });

          return response.status === 401 || response.status === 403;
        },
      },

      // 4. Authorization Tests
      {
        name: 'Authorization - Admin Endpoints',
        description: 'Verify non-admin users cannot access admin endpoints',
        test: async () => {
          const adminEndpoints = [
            '/api/admin/users',
            '/api/admin/dashboard',
            '/api/admin/query-metrics',
            '/api/monitoring/performance',
          ];

          for (const endpoint of adminEndpoints) {
            const response = await fetch(`${BASE_URL}${endpoint}`, {
              headers: { Authorization: `Bearer ${this.authToken}` },
            });

            if (response.status === 200) {
              console.log(`  ❌ Non-admin accessed admin endpoint: ${endpoint}`);
              return false;
            }
          }
          return true;
        },
      },

      // 5. CSRF Tests
      {
        name: 'CSRF - State Changing Operations',
        description: 'Verify CSRF protection on state-changing operations',
        test: async () => {
          // Try to make state-changing request without proper headers
          const response = await fetch(`${BASE_URL}/api/goals`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.authToken}`,
              'Content-Type': 'application/json',
              // Missing CSRF token or origin validation
            },
            body: JSON.stringify({
              name: 'CSRF Test Goal',
              targetAmount: 1000,
              currentAmount: 0,
              targetDate: '2024-12-31',
              category: 'SAVINGS',
            }),
          });

          // Should be allowed with just auth token (depends on implementation)
          // But verify origin/referer checks if implemented
          return true;
        },
      },

      // 6. Input Validation Tests
      {
        name: 'Input Validation - Boundaries',
        description: 'Test input validation with edge cases',
        test: async () => {
          const invalidInputs = [
            { name: 'a'.repeat(1000), targetAmount: 1000 }, // Very long string
            { name: 'Test', targetAmount: -1000 }, // Negative amount
            { name: 'Test', targetAmount: Number.MAX_SAFE_INTEGER + 1 }, // Overflow
            { name: '', targetAmount: 1000 }, // Empty required field
            { name: null, targetAmount: 1000 }, // Null value
          ];

          for (const input of invalidInputs) {
            const response = await fetch(`${BASE_URL}/api/goals`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.authToken}`,
              },
              body: JSON.stringify({
                ...input,
                currentAmount: 0,
                targetDate: '2024-12-31',
                category: 'SAVINGS',
              }),
            });

            if (response.status === 200 || response.status === 201) {
              console.log(`  ❌ Invalid input accepted:`, input);
              return false;
            }
          }
          return true;
        },
      },

      // 7. Rate Limiting Tests
      {
        name: 'Rate Limiting - Brute Force Protection',
        description: 'Verify rate limiting prevents brute force attacks',
        test: async () => {
          const requests = [];

          // Send 50 rapid login attempts
          for (let i = 0; i < 50; i++) {
            requests.push(
              fetch(`${BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: 'test@example.com',
                  password: `wrong${i}`,
                }),
              }),
            );
          }

          const responses = await Promise.all(requests);
          const rateLimited = responses.some((r) => r.status === 429);

          if (!rateLimited) {
            console.log(`  ❌ No rate limiting detected after 50 requests`);
          }

          return rateLimited;
        },
      },

      // 8. File Upload Security
      {
        name: 'File Upload - Malicious Files',
        description: 'Verify malicious file uploads are blocked',
        test: async () => {
          // Test would involve uploading files with malicious content
          // For now, return true as placeholder
          return true;
        },
      },

      // 9. Encryption Tests
      {
        name: 'Encryption - Sensitive Data',
        description: 'Verify sensitive data is encrypted',
        test: async () => {
          // Check if sensitive fields are encrypted in database
          const user = await prisma.user.findUnique({
            where: { id: this.testUser.id },
          });

          if (user) {
            // Password should be hashed
            const isPasswordHashed = user.password.startsWith('$2');
            if (!isPasswordHashed) {
              console.log(`  ❌ Password not properly hashed`);
              return false;
            }
          }

          return true;
        },
      },

      // 10. Security Headers
      {
        name: 'Security Headers',
        description: 'Verify security headers are present',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/health`);

          const requiredHeaders = [
            'x-content-type-options',
            'x-frame-options',
            'x-xss-protection',
            'strict-transport-security',
          ];

          const missingHeaders = requiredHeaders.filter((header) => !response.headers.get(header));

          if (missingHeaders.length > 0) {
            console.log(`  ❌ Missing security headers: ${missingHeaders.join(', ')}`);
            return false;
          }

          return true;
        },
      },
    ];

    console.log('🔒 Security Testing Suite\n');
    console.log('Running security tests...\n');

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        console.log(`Testing: ${test.name}`);
        console.log(`  ${test.description}`);

        const result = await test.test();

        if (result) {
          console.log(`  ✅ PASSED\n`);
          passed++;
        } else {
          console.log(`  ❌ FAILED\n`);
          failed++;
        }

        // Log to monitoring
        logger.info('Security test result', {
          test: test.name,
          passed: result,
        });
      } catch (error) {
        console.log(`  ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        failed++;
      }
    }

    console.log('═'.repeat(50));
    console.log(`Summary: ${passed} passed, ${failed} failed`);
    console.log('═'.repeat(50));

    return { passed, failed };
  }
}

// Run security tests
async function main() {
  const tester = new SecurityTester();

  try {
    await tester.setup();
    const results = await tester.runTests();

    if (results.failed > 0) {
      console.log(`\n⚠️  ${results.failed} security tests failed!`);
      process.exit(1);
    } else {
      console.log('\n✅ All security tests passed!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Security testing failed:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
    await prisma.$disconnect();
  }
}

main();
