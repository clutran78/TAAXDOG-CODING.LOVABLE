import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {
      server: true,
      database: false,
      auth: false,
    },
  };

  // Check database connection
  try {
    // Dynamically import prisma to avoid initialization issues
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = true;
  } catch (error) {
    health.status = 'degraded';
    console.error('Database health check failed:', error);
  }

  // Check auth configuration
  if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_URL) {
    health.checks.auth = true;
  } else {
    health.status = 'degraded';
    console.error('Auth configuration incomplete');
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  return res.status(statusCode).json(health);
}