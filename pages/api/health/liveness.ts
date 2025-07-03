import { NextApiRequest, NextApiResponse } from 'next';

// Simple liveness check - no dependencies
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Simple response indicating the service is alive
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    service: 'taaxdog-api',
  });
}