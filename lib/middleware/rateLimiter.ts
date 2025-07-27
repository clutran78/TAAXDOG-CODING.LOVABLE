import rateLimit from 'express-rate-limit';
import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '@/lib/logger';

const rateLimiters = {
  auth: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return (
        (req.headers['x-real-ip'] as string) ||
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        'unknown'
      );
    },
  }),

  goals: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return (
        (req.headers['x-real-ip'] as string) ||
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        'unknown'
      );
    },
  }),

  receipts: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Too many receipt processing requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return (
        (req.headers['x-real-ip'] as string) ||
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        'unknown'
      );
    },
  }),

  general: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return (
        (req.headers['x-real-ip'] as string) ||
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        'unknown'
      );
    },
  }),

  compliance: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute for compliance endpoints
    message: 'Too many compliance requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return (
        (req.headers['x-real-ip'] as string) ||
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        'unknown'
      );
    },
  }),
};

export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  type: keyof typeof rateLimiters = 'general',
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    return new Promise((resolve) => {
      const limiter = rateLimiters[type];

      limiter(req as any, res as any, (result: any) => {
        if (result instanceof Error) {
          res.status(429).json({ error: 'Too many requests' });
          return resolve(undefined);
        }

        handler(req, res)
          .then(resolve)
          .catch((error) => {
            logger.error('Handler error:', error);
            res.status(500).json({ error: 'Internal server error' });
            resolve(undefined);
          });
      });
    });
  };
}

export default rateLimiters;
