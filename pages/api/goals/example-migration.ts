import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import prismaWithRLS from '@/lib/prisma-rls';

/**
 * Example of migrating an existing API route to use RLS
 * 
 * BEFORE (without RLS):
 * 
 * import prisma from '@/lib/prisma';
 * import { getServerSession } from 'next-auth';
 * 
 * export default async function handler(req, res) {
 *   const session = await getServerSession(req, res, authOptions);
 *   if (!session) return res.status(401).json({ error: 'Unauthorized' });
 *   
 *   // Manual filtering by userId
 *   const goals = await prisma.goal.findMany({
 *     where: { userId: session.user.id }
 *   });
 *   
 *   return res.json(goals);
 * }
 */

/**
 * AFTER (with RLS):
 */
async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  try {
    // No need to check session - middleware handles it
    // No need to filter by userId - RLS handles it automatically
    
    const goals = await req.rlsContext!.execute(async () => {
      // RLS automatically filters to only show current user's goals
      return await prismaWithRLS.goal.findMany({
        orderBy: { createdAt: 'desc' }
      });
    });
    
    return res.status(200).json({
      success: true,
      data: goals
    });
  } catch (error) {
    return handleRLSError(error, res);
  }
}

// Apply RLS middleware
export default withRLSMiddleware(handler);