// Server-side polyfills for Next.js
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