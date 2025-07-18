import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import winston from 'winston';

// Configure logger for client errors
const errorLogger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/client-errors.log' })
  ]
});

// Store client errors in memory (in production, use a database)
const clientErrorStore: any[] = [];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.id;

    const { error, userAgent, timestamp, url } = req.body;

    const errorData = {
      userId,
      error,
      userAgent,
      timestamp,
      url,
      serverTimestamp: new Date()
    };

    // Store error
    clientErrorStore.push(errorData);
    
    // Keep only last 500 errors
    if (clientErrorStore.length > 500) {
      clientErrorStore.shift();
    }

    // Log to file
    errorLogger.error('Client error received', errorData);

    // TODO: Send alerts for critical errors
    if (error.message?.includes('Critical') || error.message?.includes('Fatal')) {
      // Send alert to monitoring service or email
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error storing client error:', error);
    return res.status(500).json({ error: 'Failed to store error' });
  }
}

export { clientErrorStore };