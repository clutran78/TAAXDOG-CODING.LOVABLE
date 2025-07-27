// Polyfill for 'self' in server-side environment
// This prevents "self is not defined" errors during SSR

if (typeof self === 'undefined') {
  // Create a mock self object with commonly used properties
  const mockSelf = {
    // Basic properties
    location: {
      href: '',
      origin: '',
      protocol: 'https:',
      host: '',
      hostname: '',
      port: '',
      pathname: '/',
      search: '',
      hash: '',
    },
    navigator: {
      userAgent: 'node',
      language: 'en',
      languages: ['en'],
      platform: 'server',
      onLine: true,
    },
    // Mock console (use the real one if available)
    console: typeof console !== 'undefined' ? console : {
      log: () => {},
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
    },
    // Mock window methods that might be called
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
    // Mock fetch if not available
    fetch: typeof fetch !== 'undefined' ? fetch : () => Promise.reject(new Error('fetch not available in SSR')),
    // Mock storage
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    },
    // Mock performance
    performance: {
      now: () => Date.now(),
      timing: {},
    },
    // Mock crypto (basic)
    crypto: {
      getRandomValues: (arr) => {
        // Simple fallback for server-side
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
    },
  };

  // Assign to global
  if (typeof global !== 'undefined') {
    global.self = mockSelf;
  }
}

// Export default for webpack ProvidePlugin
module.exports = global.self || {};
module.exports.default = global.self || {};