import { NextApiRequest, NextApiResponse } from 'next';
import { secureApiEndpoint } from '@/lib/middleware/security';
import { apiKeyManager } from '@/lib/services/apiKeyManager';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default secureApiEndpoint(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    // Example of making a secure request to BASIQ API
    const response = await apiKeyManager.makeSecureRequest(
      'basiq',
      'https://au-api.basiq.io/users/me/accounts',
      {
        method: 'GET',
      },
    );

    if (!response.ok) {
      throw new Error(`BASIQ API error: ${response.status}`);
    }

    const data = await response.json();

    apiResponse.success(res, {
      success: true,
      accounts: data,
    });
  } catch (error) {
    logger.error('BASIQ API error:', error);
    apiResponse.internalError(res, { error: 'Failed to fetch banking data' });
  }
});
