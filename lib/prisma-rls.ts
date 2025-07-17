import { PrismaClient } from '../generated/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { createEncryptionMiddleware } from './prisma-encryption-middleware';

// Extend PrismaClient to support RLS and encryption
export class PrismaClientWithRLS extends PrismaClient {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
    
    // Add encryption middleware
    this.$use(createEncryptionMiddleware());
  }

  /**
   * Set the current user context for RLS policies
   * This should be called before any database operation
   */
  async setUserContext(userId: string | null) {
    if (!userId) return;
    
    try {
      // Set the current user ID in PostgreSQL session
      await this.$executeRawUnsafe(
        `SET LOCAL app.current_user_id = $1`,
        userId
      );
    } catch (error) {
      console.error('Failed to set user context for RLS:', error);
      throw new Error('Failed to set security context');
    }
  }

  /**
   * Execute a query with user context for RLS
   */
  async withUserContext<T>(
    userId: string | null,
    callback: () => Promise<T>
  ): Promise<T> {
    if (!userId) {
      throw new Error('User ID is required for RLS operations');
    }

    return await this.$transaction(async (tx) => {
      // Set user context within the transaction
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_user_id = $1`,
        userId
      );
      
      // Execute the callback within the same transaction
      return await callback();
    });
  }
}

// Create a singleton instance
let prismaWithRLS: PrismaClientWithRLS;

if (process.env.NODE_ENV === 'production') {
  prismaWithRLS = new PrismaClientWithRLS();
} else {
  // In development, use a global variable to prevent multiple instances
  if (!global.prismaWithRLS) {
    global.prismaWithRLS = new PrismaClientWithRLS();
  }
  prismaWithRLS = global.prismaWithRLS;
}

// Helper function to get Prisma client with user context from session
export async function getPrismaWithContext(req: any) {
  const session = await getServerSession(req, req.res, authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized: No valid session');
  }

  return {
    prisma: prismaWithRLS,
    userId: session.user.id,
    // Wrapper for executing queries with RLS context
    execute: async <T>(callback: () => Promise<T>): Promise<T> => {
      return await prismaWithRLS.withUserContext(session.user.id, callback);
    }
  };
}

// Middleware helper for API routes
export function withRLS(handler: any) {
  return async (req: any, res: any) => {
    try {
      const { prisma, userId, execute } = await getPrismaWithContext(req);
      
      // Attach to request for use in handler
      req.prismaRLS = {
        prisma,
        userId,
        execute
      };
      
      return await handler(req, res);
    } catch (error: any) {
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      throw error;
    }
  };
}

export default prismaWithRLS;

// Type definitions for global
declare global {
  var prismaWithRLS: PrismaClientWithRLS | undefined;
}