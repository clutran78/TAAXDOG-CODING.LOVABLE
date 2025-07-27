// Runtime polyfills for server-side rendering
// This file is injected at the beginning of the server bundle

// Polyfill self for server environment
if (typeof self === 'undefined') {
  global.self = global;
}

// Polyfill window for server environment
if (typeof window === 'undefined') {
  global.window = global;
}

// Polyfill document basics
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
  };
}

// Polyfill navigator
if (typeof navigator === 'undefined') {
  global.navigator = {
    userAgent: 'Mozilla/5.0 (compatible; Node.js)',
    platform: 'node',
    language: 'en',
    languages: ['en'],
    onLine: true,
  };
}

// Polyfill location
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
    hash: '',
  };
}

// Ensure globalThis is available
if (typeof globalThis === 'undefined') {
  global.globalThis = global;
}

// Export empty object for CommonJS compatibility
module.exports = {};