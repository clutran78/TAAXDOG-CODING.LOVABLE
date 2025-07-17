import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import prismaWithRLS from '@/lib/prisma-rls';

export interface RLSContext {
  userId: string;
  userRole: string;
  execute: <T>(callback: () => Promise<T>) => Promise<T>;
}

export interface NextApiRequestWithRLS extends NextApiRequest {
  rlsContext?: RLSContext;
}

/**
 * Middleware to inject RLS context into API requests
 */
export function withRLSMiddleware(
  handler: (req: NextApiRequestWithRLS, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequestWithRLS, res: NextApiResponse) => {
    try {
      // Get session
      const session = await getServerSession(req, res, authOptions);
      
      if (!session?.user?.id) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Authentication required' 
        });
      }

      // Create RLS context
      const rlsContext: RLSContext = {
        userId: session.user.id,
        userRole: session.user.role || 'USER',
        execute: async <T>(callback: () => Promise<T>): Promise<T> => {
          return await prismaWithRLS.withUserContext(session.user.id, callback);
        }
      };

      // Attach context to request
      req.rlsContext = rlsContext;

      // Call the handler
      return await handler(req, res);
    } catch (error) {
      console.error('RLS Middleware Error:', error);
      return res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to process request' 
      });
    }
  };
}

/**
 * Helper to check if user has admin role
 */
export function requireAdmin(
  handler: (req: NextApiRequestWithRLS, res: NextApiResponse) => Promise<void>
) {
  return withRLSMiddleware(async (req: NextApiRequestWithRLS, res: NextApiResponse) => {
    if (req.rlsContext?.userRole !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Admin access required' 
      });
    }
    return handler(req, res);
  });
}

/**
 * Helper to check if user has specific roles
 */
export function requireRoles(
  roles: string[],
  handler: (req: NextApiRequestWithRLS, res: NextApiResponse) => Promise<void>
) {
  return withRLSMiddleware(async (req: NextApiRequestWithRLS, res: NextApiResponse) => {
    if (!req.rlsContext?.userRole || !roles.includes(req.rlsContext.userRole)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: `One of these roles required: ${roles.join(', ')}` 
      });
    }
    return handler(req, res);
  });
}

/**
 * Batch operation helper with RLS
 */
export async function executeBatchWithRLS<T>(
  userId: string,
  operations: (() => Promise<T>)[]
): Promise<T[]> {
  return await prismaWithRLS.withUserContext(userId, async () => {
    return await Promise.all(operations.map(op => op()));
  });
}

/**
 * Helper for paginated queries with RLS
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export function getPaginationParams(req: NextApiRequest): PaginationParams {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const orderBy = req.query.orderBy as string || 'createdAt';
  const order = (req.query.order as 'asc' | 'desc') || 'desc';

  return {
    page,
    limit,
    orderBy,
    order,
    skip: (page - 1) * limit,
    take: limit
  };
}

/**
 * Error handler for RLS operations
 */
export function handleRLSError(error: any, res: NextApiResponse) {
  console.error('RLS Operation Error:', error);

  if (error.code === 'P2025') {
    return res.status(404).json({ 
      error: 'Not Found',
      message: 'Resource not found or access denied' 
    });
  }

  if (error.message?.includes('RLS')) {
    return res.status(403).json({ 
      error: 'Access Denied',
      message: 'You do not have permission to access this resource' 
    });
  }

  return res.status(500).json({ 
    error: 'Internal Server Error',
    message: 'An unexpected error occurred' 
  });
}