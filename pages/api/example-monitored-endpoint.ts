import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiMonitoring } from '@/lib/monitoring';
import { createPrismaWithMonitoring } from '@/lib/monitoring';
import { withPerformanceMonitoring } from '@/lib/monitoring';

// Example of a monitored API endpoint
async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Initialize Prisma with monitoring
  const prisma = createPrismaWithMonitoring();

  try {
    // Example of monitoring a specific operation
    const users = await withPerformanceMonitoring('fetch-users', async () => {
      return await prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
      });
    });

    // Example of a complex query that might be slow
    const stats = await withPerformanceMonitoring('calculate-stats', async () => {
      const [userCount, transactionCount] = await Promise.all([
        prisma.user.count(),
        prisma.transaction.count()
      ]);

      return { userCount, transactionCount };
    });

    return res.status(200).json({
      users,
      stats,
      message: 'Data fetched successfully'
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

// Wrap the handler with API monitoring
export default withApiMonitoring(handler);