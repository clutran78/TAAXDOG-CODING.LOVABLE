/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/explicit-function-return-type */
// Server-side polyfills for Next.js build process
// This file must be the first thing required in next.config.js

// Polyfill self for server/build environment - CRITICAL FOR VENDOR.JS
if (typeof self === 'undefined') {
  global.self = global;
}

// Also ensure globalThis.self is defined
if (typeof globalThis !== 'undefined' && typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

// Polyfill window for server/build environment - but only specific properties
// Don't create a full window object to avoid triggering browser detection
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
  // Only polyfill in development/build time, not in production runtime
  global.window = {
    // Add only required properties, not the full global object
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
      assign: () => {},
      reload: () => {},
      replace: () => {},
    },
    // DO NOT add navigator or document - this triggers browser detection in libraries
    // Add fetch if not available
    fetch: global.fetch || (() => Promise.reject(new Error('fetch not available'))),
  };
}

// Ensure process is available
if (typeof process === 'undefined') {
  global.process = { env: {} };
}

// Polyfill document basics for build tools
if (typeof document === 'undefined') {
  const createMockElement = () => ({
    appendChild: () => {},
    removeChild: () => {},
    insertBefore: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false,
      toggle: () => {},
    },
    style: {},
    innerHTML: '',
    textContent: '',
    children: [],
    childNodes: [],
    onload: null,
    onerror: null,
  });

  global.document = {
    createElement: () => createMockElement(),
    createTextNode: () => ({ nodeValue: '' }),
    getElementById: () => null,
    getElementsByClassName: () => [],
    getElementsByTagName: () => [],
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: createMockElement(),
    head: createMockElement(),
    documentElement: {
      style: {},
      appendChild: () => {},
    },
  };
}

// Polyfill navigator for build tools
if (typeof navigator === 'undefined') {
  global.navigator = {
    userAgent: 'Mozilla/5.0 (compatible; Node.js)',
    platform: 'node',
    language: 'en',
    languages: ['en'],
    onLine: true,
    hardwareConcurrency: 1,
    cookieEnabled: false,
    appCodeName: 'Mozilla',
    appName: 'Netscape',
    appVersion: '5.0',
    vendor: '',
    vendorSub: '',
    product: 'Gecko',
    productSub: '20100101',
  };
}

// Polyfill location for build tools
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
    assign: () => {},
    reload: () => {},
    replace: () => {},
  };
}

// Polyfill localStorage for build tools
if (typeof localStorage === 'undefined') {
  const storage = {};
  global.localStorage = {
    getItem: (key) => {
      const value = storage[key];
      return value !== undefined ? value : null;
    },
    setItem: (key, value) => {
      storage[key] = String(value);
    },
    removeItem: (key) => {
      delete storage[key];
    },
    clear: () => {
      for (const key in storage) delete storage[key];
    },
    key: (index) => Object.keys(storage)[index] || null,
    get length() {
      return Object.keys(storage).length;
    },
  };
}

// Polyfill sessionStorage for build tools
if (typeof sessionStorage === 'undefined') {
  const storage = {};
  global.sessionStorage = {
    getItem: (key) => {
      const value = storage[key];
      return value !== undefined ? value : null;
    },
    setItem: (key, value) => {
      storage[key] = String(value);
    },
    removeItem: (key) => {
      delete storage[key];
    },
    clear: () => {
      for (const key in storage) delete storage[key];
    },
    key: (index) => Object.keys(storage)[index] || null,
    get length() {
      return Object.keys(storage).length;
    },
  };
}

// Ensure globalThis is available
if (typeof globalThis === 'undefined') {
  global.globalThis = global;
}

// Polyfill requestAnimationFrame for build tools
if (typeof requestAnimationFrame === 'undefined') {
  const FRAME_DURATION = 16; // 60fps
  global.requestAnimationFrame = (callback) => setTimeout(callback, FRAME_DURATION);
  global.cancelAnimationFrame = (id) => {
    clearTimeout(id);
  };
}

// Import the detailed self polyfill as backup
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./self-polyfill.js');
} catch {
  // Self polyfill might not be needed if we've already defined it
}

// Build-time logging
if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line no-console
  console.log('[Build] Server polyfills loaded successfully');
}
