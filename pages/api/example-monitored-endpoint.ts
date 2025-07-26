import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiMonitoring } from '@/lib/monitoring';
import { createPrismaWithMonitoring } from '@/lib/monitoring';
import { withPerformanceMonitoring } from '@/lib/monitoring';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import { apiResponse } from '@/lib/api/response';

// Example of a monitored API endpoint
async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Block this example endpoint in production
  if (process.env.NODE_ENV === 'production') {
    return apiResponse.notFound(res, { message: 'Not found' });
  }

  // Check authentication in non-production environments
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }
  // Initialize Prisma with monitoring
  const prisma = createPrismaWithMonitoring();

  try {
    // Example of monitoring a specific operation
    const users = await withPerformanceMonitoring('fetch-users', async () => {
      return await prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    // Example of a complex query that might be slow
    const stats = await withPerformanceMonitoring('calculate-stats', async () => {
      const [userCount, transactionCount] = await Promise.all([
        prisma.user.count(),
        prisma.transaction.count(),
      ]);

      return { userCount, transactionCount };
    });

    return apiResponse.success(res, {
      users,
      stats,
      message: 'Data fetched successfully',
    });
  } catch (error) {
    // Log detailed error internally for debugging
    console.error('[example-monitored-endpoint] API error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      requestMethod: req.method,
      requestUrl: req.url,
    });

    // Determine if we're in production
    const isProduction = process.env.NODE_ENV === 'production';

    // Return sanitized error response
    const errorResponse: any = {
      error: 'Internal server error',
      requestId: res.getHeader('x-request-id') || 'unknown',
    };

    // Only include detailed error information in non-production environments
    if (!isProduction && error instanceof Error) {
      errorResponse.message = error.message;
      errorResponse.stack = error.stack;
    } else {
      // Generic message for production
      errorResponse.message =
        'An error occurred while processing your request. Please try again later.';
    }

    return apiResponse.internalError(res, errorResponse);
  }
}

// Wrap the handler with API monitoring
export default withApiMonitoring(handler);
