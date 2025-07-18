import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import winston from 'winston';

// Configure logger for client metrics
const clientLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/client-metrics.log' })
  ]
});

// Store client metrics in memory (in production, use a database)
const clientMetricsStore: any[] = [];

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

    const { metrics, userAgent, timestamp } = req.body;

    const metricsData = {
      userId,
      metrics,
      userAgent,
      timestamp,
      serverTimestamp: new Date()
    };

    // Store metrics
    clientMetricsStore.push(metricsData);
    
    // Keep only last 1000 entries
    if (clientMetricsStore.length > 1000) {
      clientMetricsStore.shift();
    }

    // Log to file
    clientLogger.info('Client metrics received', metricsData);

    // Check for performance issues
    if (metrics.pageLoadTime > 3000) {
      clientLogger.warn('Slow page load detected', metricsData);
    }

    if (metrics.largestContentfulPaint > 2500) {
      clientLogger.warn('Poor LCP detected', metricsData);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error storing client metrics:', error);
    return res.status(500).json({ error: 'Failed to store metrics' });
  }
}

export { clientMetricsStore };