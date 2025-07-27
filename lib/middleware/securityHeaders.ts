import { NextApiRequest, NextApiResponse } from 'next';
import helmet from 'helmet';
import { logger } from '@/lib/logger';

const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://js.stripe.com'],
      connectSrc: [
        "'self'",
        'https://api.stripe.com',
        'https://api.openai.com',
        'https://api.anthropic.com',
      ],
      frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

export function withSecurityHeaders(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Apply helmet middleware
    await new Promise((resolve) => {
      helmetConfig(req as any, res as any, resolve);
    });

    // Additional security headers
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // CORS headers for API
    if (req.headers.origin) {
      const allowedOrigins = [
        process.env.NEXTAUTH_URL || 'http://localhost:3000',
        'https://taxreturnpro.com.au',
        'https://www.taxreturnpro.com.au',
      ];

      if (allowedOrigins.includes(req.headers.origin)) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    try {
      await handler(req, res);
    } catch (error) {
      logger.error('Handler error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
