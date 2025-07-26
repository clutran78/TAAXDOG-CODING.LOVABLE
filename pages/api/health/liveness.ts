import { NextApiRequest, NextApiResponse } from 'next';
import { withPublicRateLimit } from '../../../lib/security/rateLimiter';
import { apiResponse } from '@/lib/api/response';

// Simple liveness check - no dependencies
async function livenessHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  // Simple response indicating the service is alive
  apiResponse.success(res, {
    alive: true,
    timestamp: new Date().toISOString(),
    service: 'taaxdog-api',
  });
}

// Export with rate limiting for public health check
export default withPublicRateLimit(livenessHandler, {
  window: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute (higher limit for liveness checks)
  message: 'Too many liveness check requests.',
});
