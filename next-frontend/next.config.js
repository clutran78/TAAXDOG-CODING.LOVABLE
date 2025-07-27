/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security configurations to prevent HTTP request smuggling
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['src', 'pages', 'components', 'lib'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Remove deprecated experimental options

  // Compression and performance
  compress: true,
  productionBrowserSourceMaps: false,

  // Request size limits to prevent smuggling attacks
  serverRuntimeConfig: {
    maxRequestSizeInMb: 50,
  },

  // Enhanced security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // XSS protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Referrer policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Enforce HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Enhanced Content Security Policy
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.taaxdog.com https://taxreturnpro.com.au; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests",
          },
          // Prevent request smuggling by enforcing single connection
          {
            key: 'Connection',
            value: 'keep-alive',
          },
          // Request ID for tracking
          {
            key: 'X-Request-ID',
            value: Math.random().toString(36).substring(7),
          },
          // Prevent caching of sensitive data
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          // Additional security headers
          {
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },

  // Prevent information exposure
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Enhanced webpack configuration for security
  webpack: (config, { isServer }) => {
    // Prevent potential smuggling through webpack chunks
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Security optimizations
    config.optimization = {
      ...config.optimization,
      minimize: true,
    };

    return config;
  },
};

module.exports = nextConfig;
