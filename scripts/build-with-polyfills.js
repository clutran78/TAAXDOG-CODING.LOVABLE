#!/usr/bin/env node
/* eslint-disable */

// Apply polyfills before anything else
if (typeof self === 'undefined') {
  global.self = global;
}
if (typeof window === 'undefined') {
  global.window = global;
}
if (typeof document === 'undefined') {
  global.document = {
    createElement: () => ({}),
    createTextNode: () => ({}),
    getElementById: () => null,
    getElementsByClassName: () => [],
    getElementsByTagName: () => [],
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: {},
    head: {},
    documentElement: { style: {} }
  };
}
if (typeof navigator === 'undefined') {
  global.navigator = {
    userAgent: 'Mozilla/5.0 (compatible; Node.js)',
    platform: 'node',
    language: 'en',
    languages: ['en'],
    onLine: true
  };
}
if (typeof location === 'undefined') {
  global.location = {
    href: '',
    origin: '',
    protocol: 'https:',
    host: '',
    hostname: '',
    port: '',
    pathname: '/',
    search: '',
    hash: ''
  };
}

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