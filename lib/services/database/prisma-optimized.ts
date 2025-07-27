import { PrismaClient } from '@prisma/client';

// Global store for Prisma instance (prevents multiple instances in development)
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create Prisma client with basic configuration
const createPrismaClient = (): PrismaClient => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const client = new PrismaClient({
    log: isDevelopment ? ['error', 'warn'] : ['error'],
    errorFormat: isDevelopment ? 'pretty' : 'minimal',
  });

  // Basic error logging middleware
  client.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (error: any) {
      // Log errors in development
      if (isDevelopment) {
        console.error(`[Prisma] Database error:`, {
          model: params.model,
          action: params.action,
          error: error.message,
        });
      }

      // Re-throw the error
      throw error;
    }
  });

  return client;
};

// Create singleton instance
export const prisma = global.__prisma || createPrismaClient();

// Store in global only in development to support hot reloading
if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// Simple health check
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    return false;
  }
};

// Graceful shutdown
export const disconnectPrisma = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
  } catch (error) {
    // Ignore disconnect errors
  }
};
