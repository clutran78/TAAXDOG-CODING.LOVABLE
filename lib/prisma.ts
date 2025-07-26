import { PrismaClient, Prisma } from '@prisma/client';
import { queryMonitor } from './monitoring/query-monitor';
import { logger } from '@/lib/logger';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Type definitions for Prisma logging
type LogLevel = 'info' | 'query' | 'warn' | 'error';
type LogDefinition = {
  level: LogLevel;
  emit: 'stdout' | 'event';
};

// Configure logging based on environment
const getLogConfig = (): Array<LogLevel | LogDefinition> => {
  if (process.env.NODE_ENV === 'development') {
    return ['query', 'error', 'warn'] as const;
  }

  // Production logging configuration
  const logConfig: Array<LogLevel | LogDefinition> = ['error', 'warn'];

  // Enable query logging for monitoring (configurable)
  if (process.env.ENABLE_QUERY_LOGGING === 'true') {
    logConfig.push({
      emit: 'event',
      level: 'query',
    });
  }

  // Log slow queries in production
  logConfig.push({
    emit: 'event',
    level: 'info',
  });

  return logConfig;
};

// Create a single instance of Prisma Client
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: getLogConfig(),
    errorFormat: 'pretty',
  });

// Type definitions for Prisma events
interface PrismaQueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

interface PrismaLogEvent {
  timestamp: Date;
  message: string;
  target?: string;
}

// Type-safe Prisma client with event emitter
type PrismaWithEvents = PrismaClient & {
  $on(event: 'query', handler: (e: PrismaQueryEvent) => void): void;
  $on(event: 'error' | 'warn' | 'info', handler: (e: PrismaLogEvent) => void): void;
};

// Set up event listeners for production logging
if (process.env.NODE_ENV === 'production') {
  const prismaWithEvents = prisma as PrismaWithEvents;
  
  // Log all queries if enabled
  if (process.env.ENABLE_QUERY_LOGGING === 'true') {
    prismaWithEvents.$on('query', (e: PrismaQueryEvent) => {
      // Sanitize sensitive data from queries
      const sanitizedQuery = e.query.replace(/\$\d+ = '.*?'/g, '$X = [REDACTED]');

      logger.info('Database Query', {
        query: sanitizedQuery,
        params: '[REDACTED]', // Don't log actual parameters
        duration: e.duration,
        timestamp: e.timestamp,
      });

      // Record in query monitor
      queryMonitor.recordQuery(e.query, e.duration);

      // Alert on slow queries (> 1000ms)
      if (e.duration > 1000) {
        logger.warn('Slow Query Detected', {
          query: sanitizedQuery,
          duration: e.duration,
          threshold: 1000,
        });
      }
    });
  }

  // Always log errors
  prismaWithEvents.$on('error', (e: PrismaLogEvent) => {
    logger.error('Database Error', {
      message: e.message,
      target: e.target,
      timestamp: e.timestamp,
    });
  });

  // Log warnings
  prismaWithEvents.$on('warn', (e: PrismaLogEvent) => {
    logger.warn('Database Warning', {
      message: e.message,
      timestamp: e.timestamp,
    });
  });
}

// Store the instance globally in development to prevent re-creation
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Connection management utilities
export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
    return true;
  } catch (error) {
    logger.error('❌ Failed to connect to database:', error);
    return false;
  }
}

export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
  }
}

// Graceful shutdown handler
if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', async () => {
    logger.info('Shutting down Prisma Client...');
    await disconnectDatabase();
  });

  // Handle termination signals
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await disconnectDatabase();
      process.exit(0);
    });
  });
}

// Health check function
export async function checkDatabaseHealth() {
  try {
    // Use Prisma's safe query method for health check
    await prisma.user.count({ take: 1 });
    return { healthy: true, message: 'Database is responsive' };
  } catch (error) {
    return {
      healthy: false,
      message: 'Database health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export types for convenience
export * from '@prisma/client';

// Default export for easier imports
export default prisma;
