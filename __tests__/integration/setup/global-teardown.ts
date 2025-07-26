export default async function globalTeardown() {
  console.log('✅ Integration test suite completed');

  // Restore original environment
  if ((global as any).__ORIGINAL_ENV__) {
    process.env = (global as any).__ORIGINAL_ENV__;
  }
}
