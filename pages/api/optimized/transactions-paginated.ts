import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/db/optimizedPrisma';
import { getTransactionsWithRelations } from '../../../lib/services/queryOptimizer';
import { getCacheManager, CacheKeys, CacheTTL } from '../../../lib/services/cache/cacheManager';

/**
 * Optimized paginated transactions endpoint
 * Demonstrates efficient pagination with caching
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = session.user.id;
    const cacheManager = await getCacheManager();

    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 items
    const offset = (page - 1) * limit;
    
    // Optional filters
    const category = req.query.category as string | undefined;
    const isDeductible = req.query.isDeductible === 'true' ? true : 
                        req.query.isDeductible === 'false' ? false : undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    // Create cache key based on filters
    const cacheKey = `${CacheKeys.userTransactions(userId, page)}:${JSON.stringify({
      limit, category, isDeductible, startDate, endDate
    })}`;

    // Try to get from cache
    const result = await cacheManager.remember(
      cacheKey,
      CacheTTL.SHORT, // Short TTL for transaction data
      async () => {
        // Get transactions with all related data in a single query
        const data = await getTransactionsWithRelations(prisma, userId, {
          limit,
          offset,
          category,
          isDeductible,
          startDate,
          endDate,
        });

        // Calculate pagination metadata
        const totalPages = Math.ceil(data.totalCount / limit);
        
        return {
          transactions: data.transactions,
          pagination: {
            page,
            limit,
            totalCount: data.totalCount,
            totalPages,
            hasMore: data.hasMore,
            hasPrevious: page > 1,
            hasNext: page < totalPages,
          },
          filters: {
            category,
            isDeductible,
            startDate,
            endDate,
          },
        };
      }
    );

    // Set cache headers
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    
    return res.status(200).json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('Transactions error:', error);
    return res.status(500).json({ 
      error: 'Failed to load transactions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}