// Server-side polyfills for Next.js
// More comprehensive polyfills to prevent "self is not defined" errors

// Import the detailed self polyfill
require('./self-polyfill.js');

// Ensure self is available (fallback if self-polyfill didn't work)
if (typeof self === 'undefined') {
  global.self = global;
}

// Additional polyfills for server-side compatibility
if (typeof window === 'undefined') {
  global.window = global;
}

// Ensure process is available
if (typeof process === 'undefined') {
  global.process = { env: {} };
}

// Polyfill for document
if (typeof document === 'undefined') {
  global.document = {
    createElement: () => ({}),
    createTextNode: () => ({}),
    getElementById: () => null,
    getElementsByClassName: () => [],
    getElementsByTagName: () => [],
    querySelector: () => null,
    querySelectorAll: () => [],
    body: {},
    head: {},
  };
}

// Polyfill for navigator
if (typeof navigator === 'undefined') {
  global.navigator = {
    userAgent: 'node',
    platform: 'server',
    language: 'en',
  };
}

// Ensure global is properly set
if (typeof globalThis === 'undefined') {
  global.globalThis = global;
}