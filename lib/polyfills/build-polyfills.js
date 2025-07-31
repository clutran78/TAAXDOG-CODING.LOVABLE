// Build-time polyfills for Next.js
// These are minimal polyfills specifically for the build process
// They should not interfere with runtime detection of browser vs server

// Only polyfill self for webpack/build tools
if (typeof self === 'undefined') {
  global.self = {};
}

// Ensure process exists for Node.js detection
if (typeof process === 'undefined') {
  global.process = { env: {} };
}

// Minimal document polyfill for build tools only
if (typeof document === 'undefined' && process.env.NODE_ENV === 'production') {
  // Only add the absolute minimum needed for build
  global.document = {
    createElement: () => ({}),
    head: {},
    body: {},
  };
}

// Don't polyfill window, navigator, or location to avoid browser detection
// Let runtime code properly detect server vs browser environment

console.log('[Build] Minimal build polyfills loaded');
