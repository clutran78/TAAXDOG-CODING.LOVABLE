// Webpack entry point polyfills
// This runs before any other code during the build

// Define self for server-side rendering
if (typeof self === 'undefined' && typeof global !== 'undefined') {
  global.self = global;
}

// Define window for server-side
if (typeof window === 'undefined' && typeof global !== 'undefined') {
  global.window = global;
}

// Ensure global is available
if (typeof global === 'undefined') {
  if (typeof window !== 'undefined') {
    window.global = window;
  }
}