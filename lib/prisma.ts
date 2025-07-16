import { PrismaClient } from "../generated/prisma";

declare global {
  var prisma: PrismaClient | undefined;
}

// Enhanced Prisma configuration with connection pooling and error handling
const prismaClientOptions = {
  log: process.env.NODE_ENV === "development" 
    ? ["query", "error", "warn", "info"] 
    : ["error"],
  errorFormat: process.env.NODE_ENV === "development" ? "pretty" : "minimal",
  datasources: {
    db: {
      url: process.env.NODE_ENV === "production"
        ? process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL
        : process.env.DATABASE_URL
    }
  }
};

// Create Prisma client with retry logic
const createPrismaClient = () => {
  const client = new PrismaClient(prismaClientOptions);

  // Add middleware for logging and error handling
  client.$use(async (params, next) => {
    const before = Date.now();
    
    try {
      const result = await next(params);
      const after = Date.now();
      
      // Log slow queries in development
      if (process.env.NODE_ENV === "development" && (after - before) > 1000) {
        console.warn(`[Prisma] Slow query: ${params.model}.${params.action} took ${after - before}ms`);
      }
      
      return result;
    } catch (error) {
      const after = Date.now();
      console.error(`[Prisma] Query failed: ${params.model}.${params.action}`, {
        duration: `${after - before}ms`,
        error: error.message,
        code: error.code
      });
      throw error;
    }
  });

  return client;
};

// Singleton pattern with lazy initialization
export const prisma = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

// Graceful shutdown helper
export const disconnectPrisma = async () => {
  try {
    await prisma.$disconnect();
    console.log("[Prisma] Disconnected successfully");
  } catch (error) {
    console.error("[Prisma] Error during disconnect:", error);
  }
};

// Handle process termination
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