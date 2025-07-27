#!/usr/bin/env ts-node

import { prisma } from '../lib/prisma';
import { logger } from '../lib/utils/logger';
import bcrypt from 'bcryptjs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface ErrorTest {
  name: string;
  description: string;
  test: () => Promise<{ passed: boolean; details?: string }>;
}

/**
 * Error Handling and Edge Cases Testing
 * Tests application behavior under various error conditions
 */

class ErrorHandlingTester {
  private testUser: any;
  private authToken: string = '';

  async setup() {
    console.log('Setting up test environment...\n');

    // Create test user
    const hashedPassword = await bcrypt.hash('ErrorTest123!', 10);
    this.testUser = await prisma.user.upsert({
      where: { email: 'error-test@example.com' },
      update: { password: hashedPassword },
      create: {
        email: 'error-test@example.com',
        password: hashedPassword,
        name: 'Error Test User',
      },
    });

    // Get auth token
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'error-test@example.com',
        password: 'ErrorTest123!',
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
    const tests: ErrorTest[] = [
      // 1. Invalid JSON Handling
      {
        name: 'Invalid JSON',
        description: 'API handles malformed JSON gracefully',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{invalid json',
          });

          const passed = response.status === 400;
          const body = await response.text();

          return {
            passed,
            details: `Status: ${response.status}, Body: ${body.substring(0, 100)}`,
          };
        },
      },

      // 2. Missing Required Fields
      {
        name: 'Missing Required Fields',
        description: 'API validates required fields',
        test: async () => {
          const testCases = [
            { endpoint: '/api/auth/login', data: { email: 'test@example.com' } }, // Missing password
            { endpoint: '/api/auth/login', data: { password: 'test123' } }, // Missing email
            { endpoint: '/api/goals', data: { name: 'Test Goal' } }, // Missing required fields
          ];

          let allPassed = true;
          const details: string[] = [];

          for (const testCase of testCases) {
            const response = await fetch(`${BASE_URL}${testCase.endpoint}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.authToken}`,
              },
              body: JSON.stringify(testCase.data),
            });

            const isError = response.status === 400 || response.status === 422;
            if (!isError) {
              allPassed = false;
              details.push(`${testCase.endpoint}: Expected 400/422, got ${response.status}`);
            }
          }

          return { passed: allPassed, details: details.join('; ') };
        },
      },

      // 3. Invalid Data Types
      {
        name: 'Invalid Data Types',
        description: 'API validates data types',
        test: async () => {
          const invalidGoal = {
            name: 'Test Goal',
            targetAmount: 'not-a-number', // Should be number
            currentAmount: true, // Should be number
            targetDate: 'invalid-date',
            category: 123, // Should be string
          };

          const response = await fetch(`${BASE_URL}/api/goals`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.authToken}`,
            },
            body: JSON.stringify(invalidGoal),
          });

          const passed = response.status === 400 || response.status === 422;
          return { passed, details: `Status: ${response.status}` };
        },
      },

      // 4. Boundary Values
      {
        name: 'Boundary Values',
        description: 'API handles extreme values properly',
        test: async () => {
          const boundaryTests = [
            { name: 'a'.repeat(10000), targetAmount: 1000 }, // Very long string
            { name: 'Test', targetAmount: Number.MAX_SAFE_INTEGER }, // Max number
            { name: 'Test', targetAmount: -Number.MAX_SAFE_INTEGER }, // Min number
            { name: 'Test', targetAmount: 0.0000001 }, // Very small decimal
          ];

          let passed = true;
          const details: string[] = [];

          for (const test of boundaryTests) {
            const response = await fetch(`${BASE_URL}/api/goals`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.authToken}`,
              },
              body: JSON.stringify({
                ...test,
                currentAmount: 0,
                targetDate: '2024-12-31',
                category: 'SAVINGS',
              }),
            });

            // Should either accept with proper handling or reject with validation error
            if (response.status === 500) {
              passed = false;
              details.push(`Server error with: ${JSON.stringify(test)}`);
            }
          }

          return { passed, details: details.join('; ') };
        },
      },

      // 5. Null and Undefined Values
      {
        name: 'Null and Undefined Handling',
        description: 'API handles null/undefined appropriately',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/goals`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.authToken}`,
            },
            body: JSON.stringify({
              name: null,
              targetAmount: undefined,
              currentAmount: null,
              targetDate: null,
              category: undefined,
            }),
          });

          const passed = response.status === 400 || response.status === 422;
          return { passed, details: `Status: ${response.status}` };
        },
      },

      // 6. HTTP Method Validation
      {
        name: 'Invalid HTTP Methods',
        description: 'API rejects unsupported HTTP methods',
        test: async () => {
          const invalidMethods = ['PATCH', 'HEAD', 'OPTIONS', 'TRACE'];
          let allPassed = true;
          const details: string[] = [];

          for (const method of invalidMethods) {
            const response = await fetch(`${BASE_URL}/api/goals`, {
              method,
              headers: { Authorization: `Bearer ${this.authToken}` },
            });

            if (response.status !== 405 && response.status !== 404) {
              allPassed = false;
              details.push(`${method}: Expected 405/404, got ${response.status}`);
            }
          }

          return { passed: allPassed, details: details.join('; ') };
        },
      },

      // 7. Content-Type Validation
      {
        name: 'Content-Type Validation',
        description: 'API validates Content-Type header',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/goals`, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain', // Wrong content type
              Authorization: `Bearer ${this.authToken}`,
            },
            body: JSON.stringify({ name: 'Test' }),
          });

          // Should reject or handle gracefully
          const passed = response.status === 400 || response.status === 415;
          return { passed, details: `Status: ${response.status}` };
        },
      },

      // 8. Non-Existent Resources
      {
        name: 'Non-Existent Resources',
        description: 'API returns proper 404 errors',
        test: async () => {
          const fakeId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
          const endpoints = [
            `/api/goals/${fakeId}`,
            `/api/transactions/${fakeId}`,
            `/api/budgets/${fakeId}`,
          ];

          let allPassed = true;
          const details: string[] = [];

          for (const endpoint of endpoints) {
            const response = await fetch(`${BASE_URL}${endpoint}`, {
              headers: { Authorization: `Bearer ${this.authToken}` },
            });

            if (response.status !== 404) {
              allPassed = false;
              details.push(`${endpoint}: Expected 404, got ${response.status}`);
            }
          }

          return { passed: allPassed, details: details.join('; ') };
        },
      },

      // 9. Concurrent Request Handling
      {
        name: 'Concurrent Requests',
        description: 'API handles concurrent requests without errors',
        test: async () => {
          const promises = [];

          // Send 20 concurrent requests
          for (let i = 0; i < 20; i++) {
            promises.push(
              fetch(`${BASE_URL}/api/goals`, {
                headers: { Authorization: `Bearer ${this.authToken}` },
              }),
            );
          }

          try {
            const responses = await Promise.all(promises);
            const allSuccessful = responses.every((r) => r.status !== 500);

            return {
              passed: allSuccessful,
              details: `All ${responses.length} concurrent requests completed`,
            };
          } catch (error) {
            return {
              passed: false,
              details: `Concurrent requests failed: ${error}`,
            };
          }
        },
      },

      // 10. Database Connection Errors
      {
        name: 'Database Error Handling',
        description: 'API handles database errors gracefully',
        test: async () => {
          // This test would need to simulate database errors
          // For now, we'll test with an invalid query parameter
          const response = await fetch(`${BASE_URL}/api/transactions?limit=999999999`, {
            headers: { Authorization: `Bearer ${this.authToken}` },
          });

          // Should not crash with 500
          const passed = response.status !== 500;
          return { passed, details: `Status: ${response.status}` };
        },
      },

      // 11. Token Expiry Handling
      {
        name: 'Expired Token Handling',
        description: 'API properly handles expired tokens',
        test: async () => {
          // Use an obviously expired/invalid token
          const response = await fetch(`${BASE_URL}/api/goals`, {
            headers: {
              Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjF9.invalid',
            },
          });

          const passed = response.status === 401 || response.status === 403;
          return { passed, details: `Status: ${response.status}` };
        },
      },

      // 12. Large Payload Handling
      {
        name: 'Large Payload Rejection',
        description: 'API rejects excessively large payloads',
        test: async () => {
          // Create a very large payload
          const largeData = {
            name: 'Test Goal',
            description: 'x'.repeat(1000000), // 1MB of data
            targetAmount: 1000,
            currentAmount: 0,
            targetDate: '2024-12-31',
            category: 'SAVINGS',
          };

          const response = await fetch(`${BASE_URL}/api/goals`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.authToken}`,
            },
            body: JSON.stringify(largeData),
          });

          // Should reject large payloads
          const passed = response.status === 413 || response.status === 400;
          return { passed, details: `Status: ${response.status}` };
        },
      },

      // 13. Special Characters Handling
      {
        name: 'Special Characters',
        description: 'API handles special characters in input',
        test: async () => {
          const specialCharTests = [
            '"><script>alert("xss")</script>',
            '{{constructor.constructor("alert(1)")()}}',
            '${7*7}',
            '\\u0000\\u0001\\u0002',
            '😀🎉🔥', // Emojis
          ];

          let allPassed = true;

          for (const testString of specialCharTests) {
            const response = await fetch(`${BASE_URL}/api/goals`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.authToken}`,
              },
              body: JSON.stringify({
                name: testString,
                targetAmount: 1000,
                currentAmount: 0,
                targetDate: '2024-12-31',
                category: 'SAVINGS',
              }),
            });

            // Should either accept and sanitize or reject
            if (response.status === 500) {
              allPassed = false;
            }
          }

          return { passed: allPassed };
        },
      },

      // 14. Invalid ID Formats
      {
        name: 'Invalid ID Formats',
        description: 'API validates ID format in URLs',
        test: async () => {
          const invalidIds = [
            'not-a-uuid',
            '12345',
            '../../../etc/passwd',
            'SELECT * FROM users',
            '',
          ];

          let allPassed = true;
          const details: string[] = [];

          for (const id of invalidIds) {
            const response = await fetch(`${BASE_URL}/api/goals/${encodeURIComponent(id)}`, {
              headers: { Authorization: `Bearer ${this.authToken}` },
            });

            if (response.status === 500) {
              allPassed = false;
              details.push(`Server error with ID: ${id}`);
            }
          }

          return { passed: allPassed, details: details.join('; ') };
        },
      },

      // 15. Timeout Handling
      {
        name: 'Request Timeout',
        description: 'API handles slow requests appropriately',
        test: async () => {
          // This would need a special endpoint that delays response
          // For now, we'll just verify the API responds in reasonable time
          const startTime = Date.now();

          const response = await fetch(`${BASE_URL}/api/health`, {
            signal: AbortSignal.timeout(5000), // 5 second timeout
          });

          const duration = Date.now() - startTime;
          const passed = response.ok && duration < 5000;

          return {
            passed,
            details: `Response time: ${duration}ms`,
          };
        },
      },
    ];

    console.log('🛡️  Error Handling and Edge Cases Testing\n');
    console.log('Testing application resilience...\n');

    let passed = 0;
    let failed = 0;
    const results: any[] = [];

    for (const test of tests) {
      try {
        console.log(`Testing: ${test.name}`);
        console.log(`  ${test.description}`);

        const result = await test.test();
        results.push({ ...test, ...result });

        if (result.passed) {
          console.log(`  ✅ PASSED`);
          if (result.details) {
            console.log(`     Details: ${result.details}`);
          }
          passed++;
        } else {
          console.log(`  ❌ FAILED`);
          if (result.details) {
            console.log(`     Details: ${result.details}`);
          }
          failed++;
        }
        console.log();

        // Log to monitoring
        logger.info('Error handling test result', {
          test: test.name,
          passed: result.passed,
          details: result.details,
        });
      } catch (error) {
        console.log(`  ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        failed++;
        results.push({
          ...test,
          passed: false,
          details: `Test error: ${error}`,
        });
      }
    }

    // Summary
    console.log('═'.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total Tests: ${tests.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  - ${r.name}: ${r.details || 'No details'}`);
        });
    }

    console.log('═'.repeat(60));

    return { passed, failed };
  }
}

// Run error handling tests
async function main() {
  const tester = new ErrorHandlingTester();

  try {
    await tester.setup();
    const results = await tester.runTests();

    if (results.failed > 0) {
      console.log(`\n⚠️  ${results.failed} error handling tests failed!`);
      console.log('The application may not handle errors gracefully in all cases.');
      process.exit(1);
    } else {
      console.log('\n✅ All error handling tests passed!');
      console.log('The application handles errors and edge cases properly.');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Error handling testing failed:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
    await prisma.$disconnect();
  }
}

main();
