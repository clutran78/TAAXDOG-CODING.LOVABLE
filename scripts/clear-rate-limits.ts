#!/usr/bin/env ts-node

/**
 * Script to clear rate limits for testing
 * Usage: npm run clear-rate-limits -- --ip=1.145.131.180
 */

import { rateLimiter } from '../lib/auth/rate-limiter';

const [, , ...args] = process.argv;
let ipToClear: string | undefined;

// Parse command line arguments
args.forEach(arg => {
  if (arg.startsWith('--ip=')) {
    ipToClear = arg.split('=')[1];
  }
});

if (!ipToClear) {
  console.error('Please provide an IP address to clear: --ip=xxx.xxx.xxx.xxx');
  process.exit(1);
}

// Clear rate limits for the specified IP
console.log(`Clearing rate limits for IP: ${ipToClear}`);

// Clear all auth-related rate limits
rateLimiter.clearAllCaches();

console.log('✅ Rate limits cleared successfully');
console.log('Note: This only clears the in-memory cache. If using distributed rate limiting, you may need to clear Redis/external cache separately.');

process.exit(0);