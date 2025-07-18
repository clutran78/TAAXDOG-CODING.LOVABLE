import { NextApiRequest, NextApiResponse } from 'next';
import { secureApiEndpoint } from '@/lib/middleware/security';
import { apiKeyManager } from '@/lib/services/apiKeyManager';

export default secureApiEndpoint(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Example of making a secure request to BASIQ API
    const response = await apiKeyManager.makeSecureRequest(
      'basiq',
      'https://au-api.basiq.io/users/me/accounts',
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      throw new Error(`BASIQ API error: ${response.status}`);
    }

    const data = await response.json();
    
    res.status(200).json({ 
      success: true,
      accounts: data
    });
  } catch (error) {
    console.error('BASIQ API error:', error);
    res.status(500).json({ error: 'Failed to fetch banking data' });
  }
});