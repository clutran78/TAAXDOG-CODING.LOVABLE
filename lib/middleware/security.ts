import { NextApiRequest, NextApiResponse } from 'next';
import { withRateLimit } from './rateLimiter';
import { withSecurityHeaders } from './securityHeaders';
import { withValidation, ValidationChain } from './validation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export interface SecurityConfig {
  rateLimit?: 'auth' | 'goals' | 'receipts' | 'general';
  requireAuth?: boolean;
  validations?: ValidationChain[];
  allowedMethods?: string[];
  csrf?: boolean;
}

export function withSecurity(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  config: SecurityConfig = {},
) {
  const {
    rateLimit = 'general',
    requireAuth = true,
    validations = [],
    allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'],
    csrf = true,
  } = config;

  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Check allowed methods
    if (!allowedMethods.includes(req.method || '')) {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Apply security headers
    await withSecurityHeaders(async (req, res) => {
      // Check authentication if required
      if (requireAuth) {
        const session = await getServerSession(req, res, authOptions);
        if (!session) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Add user to request
        (req as any).user = session.user;
      }

      // CSRF protection for state-changing methods
      if (csrf && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method || '')) {
        const csrfToken = req.headers['x-csrf-token'];
        const sessionToken = req.cookies['next-auth.csrf-token'];

        if (!csrfToken || !sessionToken || csrfToken !== sessionToken.split('|')[0]) {
          return res.status(403).json({ error: 'Invalid CSRF token' });
        }
      }

      // Apply validation
      await withValidation(async (req, res) => {
        // Apply rate limiting
        await withRateLimit(handler, rateLimit)(req, res);
      }, validations)(req, res);
    })(req, res);
  };
}

// Pre-configured security wrappers for common use cases
export const secureAuthEndpoint = (
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
) => withSecurity(handler, { rateLimit: 'auth', requireAuth: false });

export const secureApiEndpoint = (
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  validations?: ValidationChain[],
) => withSecurity(handler, { validations });

export const securePublicEndpoint = (
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  validations?: ValidationChain[],
) => withSecurity(handler, { requireAuth: false, validations });
