import { FullConfig } from '@playwright/test';

/**
 * Global teardown for Playwright tests
 * Runs once after all tests
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up test environment...');

  // Add any cleanup logic here
  // For example:
  // - Clean up test database
  // - Remove temporary files
  // - Stop test services

  console.log('✅ Cleanup complete');
}

export default globalTeardown;
