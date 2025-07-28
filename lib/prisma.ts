import { PrismaClient } from '@prisma/client';

import { logger } from '@/lib/logger';

// Get database URL with better error handling
let databaseUrl: string;
try {
  // Simple approach - use DATABASE_URL directly if available
  databaseUrl = process.env['DATABASE_URL'] || '';
  
  if (!databaseUrl) {
    // Try alternative environment variables for production
    if (process.env.NODE_ENV === 'production') {
      databaseUrl = process.env['PRODUCTION_DATABASE_URL'] || process.env['DATABASE_URL_PRODUCTION'] || '';
    } else {
      databaseUrl = process.env['DATABASE_URL_DEVELOPMENT'] || process.env['DEV_DATABASE_URL'] || '';
    }
  }

  if (!databaseUrl) {
    throw new Error('No DATABASE_URL found in environment variables');
  }

  // Log connection info safely
  try {
    const parsedUrl = new URL(databaseUrl);
    logger.info('Database connection configured:', {
      host: parsedUrl.hostname,
      port: parsedUrl.port,
      database: parsedUrl.pathname.substring(1),
      ssl: parsedUrl.searchParams.get('sslmode') || 'none',
      username: parsedUrl.username,
    });
  } catch {
    logger.warn('Could not parse DATABASE_URL for logging, but proceeding with connection');
  }

} catch (error) {
  logger.error('Failed to configure database URL:', error);
  // Use fallback URL for better error messages
  databaseUrl = 'postgresql://error:error@localhost:5432/error_database';
}

// Set the DATABASE_URL for Prisma
process.env['DATABASE_URL'] = databaseUrl;

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create Prisma Client with basic configuration
const createPrismaClient = (): PrismaClient => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  return new PrismaClient({
    log: isDevelopment ? ['query', 'info', 'warn', 'error'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
};

// Use singleton pattern for Prisma Client
const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Store in global for development hot reloading
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
