import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/db/optimizedPrisma';
import { getUserWithFullProfile, preloadUserData } from '../../../lib/services/queryOptimizer';
import { getCacheManager, CacheKeys, CacheTTL } from '../../../lib/services/cache/cacheManager';
import { ViewQueries } from '../../../lib/services/viewQueries';

/**
 * Optimized user dashboard endpoint
 * Demonstrates query batching, caching, and view usage
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
    const viewQueries = new ViewQueries(prisma);

    // Try to get cached dashboard data
    const cachedData = await cacheManager.remember(
      CacheKeys.userProfile(userId),
      CacheTTL.MEDIUM,
      async () => {
        // Preload all user data to warm up caches
        await preloadUserData(prisma, userId);

        // Execute all queries in parallel for optimal performance
        const [
          userProfile,
          financialSummary,
          monthlySpending,
          goalProgress,
          topCategories
        ] = await Promise.all([
          // Get full user profile with relations (prevents N+1)
          getUserWithFullProfile(prisma, userId),
          
          // Get pre-aggregated financial summary from view
          viewQueries.getUserFinancialSummary(userId),
          
          // Get last 3 months spending from view
          viewQueries.getMonthlySpending(
            userId,
            new Date(new Date().setMonth(new Date().getMonth() - 3)),
            new Date()
          ),
          
          // Get goal progress from view
          viewQueries.getGoalProgressAnalytics(userId, true),
          
          // Get top spending categories
          viewQueries.getTopCategories(userId, 5, false),
        ]);

        // Calculate additional insights
        const insights = {
          averageMonthlySpending: monthlySpending.reduce((sum, m) => sum + m.totalAmount, 0) / (monthlySpending.length || 1),
          goalsOnTrack: goalProgress.filter(g => g.progressPercentage >= (100 / g.daysRemaining) * (Date.now() - g.createdAt.getTime()) / (1000 * 60 * 60 * 24)).length,
          totalActiveGoals: goalProgress.length,
        };

        return {
          user: {
            id: userProfile?.id,
            email: userProfile?.email,
            name: userProfile?.name,
            counts: userProfile?._count,
          },
          financialSummary,
          recentSpending: monthlySpending,
          goals: goalProgress,
          topCategories,
          insights,
          lastUpdated: new Date(),
        };
      }
    );

    // Set cache headers for browser caching
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    
    return res.status(200).json({
      success: true,
      data: cachedData,
      cached: true, // Indicate if data was served from cache
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ 
      error: 'Failed to load dashboard',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}