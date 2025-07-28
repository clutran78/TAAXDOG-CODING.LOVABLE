#!/usr/bin/env node
/* eslint-disable */

// Ensure self is defined globally before anything else
if (typeof global !== 'undefined' && typeof global.self === 'undefined') {
  global.self = global;
}
if (typeof globalThis !== 'undefined' && typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

// Apply other polyfills
require('../lib/polyfills/server-polyfills.js');

// Now run the Next.js build
const { spawn } = require('child_process');
const path = require('path');

console.log('[Build] Starting Next.js build with polyfills...');

const nextPath = path.join(__dirname, '..', 'node_modules', '.bin', 'next');
const buildProcess = spawn(nextPath, ['build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: `--require ${path.join(__dirname, '..', 'lib', 'polyfills', 'server-polyfills.js')} ${process.env.NODE_OPTIONS || ''}`
  }
});

buildProcess.on('exit', (code) => {
  process.exit(code);
});