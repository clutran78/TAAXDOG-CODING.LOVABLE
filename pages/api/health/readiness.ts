import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getConfig } from '../../../lib/config';

// Readiness check - verify critical dependencies
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const checks: Record<string, boolean> = {};
  const errors: Record<string, string> = {};
  
  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    checks.database = false;
    errors.database = error instanceof Error ? error.message : 'Database connection failed';
  }
  
  // Check configuration
  try {
    const config = getConfig();
    checks.configuration = !!(
      config.database.url && 
      config.auth.secret &&
      config.stripe.secretKey
    );
    
    if (!checks.configuration) {
      errors.configuration = 'Missing required configuration';
    }
  } catch (error) {
    checks.configuration = false;
    errors.configuration = error instanceof Error ? error.message : 'Configuration load failed';
  }
  
  // Check environment
  checks.environment = !!(
    process.env.NODE_ENV &&
    process.env.DATABASE_URL &&
    process.env.NEXTAUTH_SECRET
  );
  
  if (!checks.environment) {
    errors.environment = 'Missing required environment variables';
  }
  
  // Determine if ready
  const ready = Object.values(checks).every(check => check);
  const statusCode = ready ? 200 : 503;
  
  res.status(statusCode).json({
    ready,
    timestamp: new Date().toISOString(),
    checks,
    ...(Object.keys(errors).length > 0 && { errors }),
  });
}