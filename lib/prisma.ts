import { PrismaClient } from '@prisma/client';

import { logger } from '@/lib/logger';

// Get database URL with better error handling
import { getDatabaseUrl, logDatabaseConnectionInfo } from '@/lib/utils/database-url';

// Get database URL using the utility function
let databaseUrl: string;
try {
  databaseUrl = getDatabaseUrl();
  logDatabaseConnectionInfo(databaseUrl);
} catch (error) {
  logger.error('Failed to configure database URL:', error);
  throw error; // Fail fast instead of using a fake URL
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

export { prisma };
export default prisma;
