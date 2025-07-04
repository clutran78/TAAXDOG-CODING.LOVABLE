import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    checks: {
      server: 'ok',
      database: 'unknown'
    }
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.checks.database = 'ok';
  } catch (error) {
    healthCheck.status = 'degraded';
    healthCheck.checks.database = 'error';
    console.error('Database health check failed:', error);
  }

  const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
}