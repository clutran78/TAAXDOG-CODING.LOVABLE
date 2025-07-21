import { PrismaClient } from '@prisma/client';

// Only check DATABASE_URL on server-side (not in browser)
if (typeof window === 'undefined' && !process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('Please create a .env.local file with your PostgreSQL connection string');
  throw new Error('DATABASE_URL is required');
}

// Global singleton to prevent multiple instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? (
  typeof window === 'undefined' 
    ? new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      })
    : {} as PrismaClient  // Return empty object on client-side
);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Test connection on startup (server-side only)
if (typeof window === 'undefined' && prisma.$connect) {
  prisma.$connect()
    .then(() => {
      console.log('✅ Database connected successfully');
    })
    .catch((error) => {
      console.error('❌ Database connection failed:', error.message);
      console.error('Please check your DATABASE_URL in .env.local');
    });
}

export default prisma;