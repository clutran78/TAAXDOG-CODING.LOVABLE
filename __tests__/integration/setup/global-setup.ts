import { config } from 'dotenv';
import path from 'path';

export default async function globalSetup() {
  // Load test environment
  config({ path: path.join(__dirname, 'test.env') });

  console.log('🚀 Starting integration test suite...');
  console.log(`📁 Test database: ${process.env.TEST_DATABASE_URL?.split('@')[1] || 'local'}`);
  console.log(`🔧 Mock external services: ${process.env.MOCK_EXTERNAL_SERVICES}`);

  // Store original env for cleanup
  (global as any).__ORIGINAL_ENV__ = { ...process.env };
}
