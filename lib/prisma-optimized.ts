import { PrismaClient, Prisma } from "../generated/prisma";
import { createEncryptionMiddleware } from "./prisma-encryption-middleware";

// Type definitions
interface QueryMetrics {
  model?: string;
  action?: string;
  duration: number;
  timestamp: Date;
  params?: any;
}

interface PrismaConfig {
  log: Prisma.LogLevel[];
  errorFormat: "pretty" | "minimal" | "colorless";
  datasources: {
    db: {
      url: string;
    };
  };
}

// Global store for Prisma instance
declare global {
  var __prisma: PrismaClient | undefined;
  var __queryMetrics: QueryMetrics[] | undefined;
}

// Configuration based on environment
const getConfig = (): PrismaConfig => {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";
  
  // Database URL with connection pooling parameters
  const databaseUrl = isProduction
    ? process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL
    : process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Database URL not configured");
  }

  // Add connection pooling parameters if not already present
  const urlWithPooling = new URL(databaseUrl);
  if (!urlWithPooling.searchParams.has("connection_limit")) {
    urlWithPooling.searchParams.set("connection_limit", isProduction ? "25" : "5");
  }
  if (!urlWithPooling.searchParams.has("pool_timeout")) {
    urlWithPooling.searchParams.set("pool_timeout", "10");
  }

  return {
    log: isDevelopment 
      ? ["query", "error", "warn", "info"] 
      : ["error", "warn"],
    errorFormat: isDevelopment ? "pretty" : "minimal",
    datasources: {
      db: {
        url: urlWithPooling.toString()
      }
    }
  };
};

// Query metrics storage for development
const queryMetrics: QueryMetrics[] = global.__queryMetrics || [];
if (process.env.NODE_ENV === "development") {
  global.__queryMetrics = queryMetrics;
}

// Slow query threshold in milliseconds
const SLOW_QUERY_THRESHOLD = parseInt(process.env.PRISMA_SLOW_QUERY_THRESHOLD || "1000", 10);

// Create enhanced Prisma client
const createPrismaClient = (): PrismaClient => {
  const config = getConfig();
  const client = new PrismaClient(config);

  // Apply encryption middleware first (runs before other middleware)
  client.$use(createEncryptionMiddleware());

  // Middleware for query monitoring and logging
  client.$use(async (params, next) => {
    const start = Date.now();
    
    try {
      const result = await next(params);
      const duration = Date.now() - start;
      
      // Store metrics in development
      if (process.env.NODE_ENV === "development") {
        const metric: QueryMetrics = {
          model: params.model,
          action: params.action,
          duration,
          timestamp: new Date(),
          params: params.args
        };
        
        queryMetrics.push(metric);
        
        // Keep only last 100 queries to prevent memory leak
        if (queryMetrics.length > 100) {
          queryMetrics.shift();
        }
        
        // Log slow queries
        if (duration > SLOW_QUERY_THRESHOLD) {
          console.warn(`[Prisma] Slow query detected:`, {
            model: params.model,
            action: params.action,
            duration: `${duration.toFixed(2)}ms`,
            threshold: `${SLOW_QUERY_THRESHOLD}ms`
          });
        }
      }
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - start;
      
      // Enhanced error logging
      console.error(`[Prisma] Query error:`, {
        model: params.model,
        action: params.action,
        duration: `${duration.toFixed(2)}ms`,
        error: {
          name: error.name,
          code: error.code,
          meta: error.meta,
          message: process.env.NODE_ENV === "development" 
            ? error.message 
            : "Database operation failed"
        }
      });
      
      // Re-throw with sanitized error in production
      if (process.env.NODE_ENV === "production") {
        const sanitizedError = new Error("Database operation failed");
        sanitizedError.name = error.name;
        if (error.code) {
          (sanitizedError as any).code = error.code;
        }
        throw sanitizedError;
      }
      
      throw error;
    }
  });

  // Middleware for connection retries
  client.$use(async (params, next) => {
    let retries = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    
    while (retries < maxRetries) {
      try {
        return await next(params);
      } catch (error: any) {
        // Retry on connection errors
        if (
          error.code === "P1001" || // Can't reach database server
          error.code === "P1002" || // Database server timeout
          error.code === "P2024"    // Connection pool timeout
        ) {
          retries++;
          if (retries < maxRetries) {
            console.warn(`[Prisma] Retrying after connection error (attempt ${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * retries));
            continue;
          }
        }
        throw error;
      }
    }
  });

  return client;
};

// Singleton pattern with proper initialization
export const prisma = global.__prisma || createPrismaClient();

// Store in global only in development to support hot reloading
if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

// Query monitoring utilities
export const getQueryMetrics = (): QueryMetrics[] => {
  if (process.env.NODE_ENV !== "development") {
    console.warn("[Prisma] Query metrics are only available in development");
    return [];
  }
  return [...queryMetrics];
};

export const clearQueryMetrics = (): void => {
  if (process.env.NODE_ENV !== "development") {
    console.warn("[Prisma] Query metrics are only available in development");
    return;
  }
  queryMetrics.length = 0;
};

export const getSlowQueries = (threshold?: number): QueryMetrics[] => {
  const slowThreshold = threshold || SLOW_QUERY_THRESHOLD;
  return getQueryMetrics().filter(metric => metric.duration > slowThreshold);
};

// Health check function
export const checkDatabaseHealth = async (): Promise<{
  status: "healthy" | "unhealthy";
  responseTime?: number;
  error?: string;
}> => {
  const start = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;
    
    return {
      status: "healthy",
      responseTime
    };
  } catch (error: any) {
    return {
      status: "unhealthy",
      error: process.env.NODE_ENV === "development" 
        ? error.message 
        : "Database connection failed"
    };
  }
};

// Graceful shutdown
export const disconnectPrisma = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log("[Prisma] Disconnected successfully");
  } catch (error) {
    console.error("[Prisma] Error during disconnect:", error);
  }
};

// Handle process termination gracefully
if (typeof process !== "undefined") {
  process.on("beforeExit", async () => {
    await disconnectPrisma();
  });

  process.on("SIGINT", async () => {
    await disconnectPrisma();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

// Export types
export type { QueryMetrics };