#!/usr/bin/env node
import axios from 'axios';
import { logger } from '../lib/utils/logger';

// Test configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const API_KEY = process.env.TEST_API_KEY || '';

// Test user credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test@1234',
};

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

// Test result tracking
let passedTests = 0;
let failedTests = 0;

async function testEndpoint(
  name: string,
  method: string,
  url: string,
  options?: {
    data?: any;
    headers?: any;
    expectedStatus?: number;
    validateResponse?: (response: any) => void;
  },
) {
  console.log(`\n${colors.blue}Testing: ${name}${colors.reset}`);
  console.log(`${method} ${url}`);

  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${url}`,
      data: options?.data,
      headers: options?.headers,
      validateStatus: () => true, // Don't throw on any status
    });

    const expectedStatus = options?.expectedStatus || 200;
    console.log(`Status: ${response.status} (expected: ${expectedStatus})`);

    // Validate status code
    if (response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
    }

    // Validate response structure
    const responseData = response.data;

    // Check standard response format
    if (response.status >= 200 && response.status < 300) {
      // Success responses should have success: true
      if (responseData.success !== true) {
        throw new Error('Success response missing success: true');
      }

      // Should have data field
      if (!('data' in responseData)) {
        throw new Error('Success response missing data field');
      }

      // May have meta field
      if (responseData.meta) {
        if (!responseData.meta.timestamp) {
          throw new Error('Meta field missing timestamp');
        }
      }
    } else {
      // Error responses should have success: false
      if (responseData.success !== false) {
        throw new Error('Error response missing success: false');
      }

      // Should have error field
      if (!responseData.error) {
        throw new Error('Error response missing error field');
      }

      // Error should have code and message
      if (!responseData.error.code || !responseData.error.message) {
        throw new Error('Error response missing code or message');
      }
    }

    // Run custom validation if provided
    if (options?.validateResponse) {
      options.validateResponse(responseData);
    }

    console.log(`${colors.green}✓ Test passed${colors.reset}`);
    console.log('Response structure:', JSON.stringify(responseData, null, 2));
    passedTests++;
  } catch (error) {
    console.log(`${colors.red}✗ Test failed${colors.reset}`);
    console.error('Error:', error instanceof Error ? error.message : error);
    failedTests++;
  }
}

async function runTests() {
  console.log(`${colors.yellow}Starting API Response Standardization Tests${colors.reset}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log('=====================================\n');

  // Test health check endpoints
  await testEndpoint('Health Check - Readiness', 'GET', '/api/health/readiness', {
    validateResponse: (data) => {
      if (data.success === true && !data.data.ready) {
        throw new Error('Readiness check should include ready field');
      }
    },
  });

  // Test authentication endpoints
  await testEndpoint('Auth - Login (Invalid)', 'POST', '/api/auth/login', {
    data: {
      email: 'invalid@example.com',
      password: 'wrongpassword',
    },
    expectedStatus: 401,
    validateResponse: (data) => {
      if (data.error.code !== 'UNAUTHORIZED' && data.error.code !== 'INVALID_CREDENTIALS') {
        throw new Error('Invalid login should return UNAUTHORIZED or INVALID_CREDENTIALS code');
      }
    },
  });

  // Test validation errors
  await testEndpoint('Auth - Login (Missing fields)', 'POST', '/api/auth/login', {
    data: {},
    expectedStatus: 400,
    validateResponse: (data) => {
      if (data.error.code !== 'VALIDATION_ERROR') {
        throw new Error('Missing fields should return VALIDATION_ERROR code');
      }
    },
  });

  // Test method not allowed
  await testEndpoint('Goals - Method Not Allowed', 'DELETE', '/api/goals', {
    expectedStatus: 405,
    validateResponse: (data) => {
      if (data.error.code !== 'OPERATION_NOT_ALLOWED') {
        throw new Error('Method not allowed should return OPERATION_NOT_ALLOWED code');
      }
    },
  });

  // Test unauthenticated access
  await testEndpoint('Goals - Unauthenticated', 'GET', '/api/goals', {
    expectedStatus: 401,
    validateResponse: (data) => {
      if (data.error.code !== 'UNAUTHORIZED') {
        throw new Error('Unauthenticated access should return UNAUTHORIZED code');
      }
    },
  });

  // Test rate limiting (if we can trigger it)
  console.log(`\n${colors.blue}Testing: Rate Limiting${colors.reset}`);
  console.log('Sending multiple requests to trigger rate limit...');

  let rateLimitHit = false;
  for (let i = 0; i < 20; i++) {
    try {
      const response = await axios.post(
        `${BASE_URL}/api/auth/login`,
        {
          email: 'test@example.com',
          password: 'test',
        },
        {
          validateStatus: () => true,
        },
      );

      if (response.status === 429) {
        rateLimitHit = true;
        console.log(`Rate limit hit after ${i + 1} requests`);

        // Validate rate limit response
        if (response.data.error.code !== 'RATE_LIMIT_EXCEEDED') {
          throw new Error('Rate limit should return RATE_LIMIT_EXCEEDED code');
        }

        console.log(`${colors.green}✓ Rate limit test passed${colors.reset}`);
        passedTests++;
        break;
      }
    } catch (error) {
      // Ignore errors for rate limit test
    }
  }

  if (!rateLimitHit) {
    console.log(
      `${colors.yellow}⚠ Rate limit not triggered (may need more requests)${colors.reset}`,
    );
  }

  // Summary
  console.log('\n=====================================');
  console.log(`${colors.yellow}Test Summary${colors.reset}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log('=====================================\n');

  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error(`${colors.red}Test suite failed:${colors.reset}`, error);
  process.exit(1);
});
