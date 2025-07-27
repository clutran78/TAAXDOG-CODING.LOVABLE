import { chromium, FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */
async function globalSetup(config: FullConfig) {
  // Load environment variables
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });

  // Ensure test database is ready
  console.log('🚀 Setting up test environment...');

  // Create browser context for setup tasks
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Check if application is running
    const baseURL = config.projects[0].use?.baseURL || 'http://localhost:3000';
    const response = await page.goto(baseURL, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    if (!response || response.status() >= 400) {
      throw new Error(`Application not accessible at ${baseURL}`);
    }

    console.log('✅ Application is running and accessible');

    // Store authentication state if needed
    // This can be used to login once and reuse the session
    const adminStorageState = path.join(__dirname, '..', 'fixtures', '.auth', 'admin.json');
    const userStorageState = path.join(__dirname, '..', 'fixtures', '.auth', 'user.json');

    // You can add login logic here to create authenticated states
    // await loginAsAdmin(page);
    // await context.storageState({ path: adminStorageState });

    console.log('✅ Test environment setup complete');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  // Set environment variables for tests
  process.env.TEST_BASE_URL = config.projects[0].use?.baseURL || 'http://localhost:3000';
  process.env.TEST_TIMEOUT = '30000';
}

export default globalSetup;
