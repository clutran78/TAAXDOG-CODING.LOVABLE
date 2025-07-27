import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth/middleware';
import { queryMonitor } from '../../../lib/monitoring/query-monitor';
import { logger } from '../../../lib/utils/logger';
import { apiResponse } from '@/lib/api/response';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    // Get query parameter for type of data
    const { type = 'summary', export: shouldExport } = req.query;

    switch (type) {
      case 'summary':
        const summary = queryMonitor.getMetricsSummary();
        return apiResponse.success(res, {
          status: 'success',
          data: summary,
          timestamp: new Date().toISOString(),
        });

      case 'dashboard':
        const dashboard = queryMonitor.getDashboardData();
        return apiResponse.success(res, {
          status: 'success',
          data: dashboard,
          timestamp: new Date().toISOString(),
        });

      case 'export':
        const exportData = queryMonitor.exportMetrics();

        // Log the export action
        logger.info('Query metrics exported', {
          userId: (req as any).user?.id,
          timestamp: new Date().toISOString(),
        });

        if (shouldExport === 'true') {
          // Return as downloadable JSON
          res.setHeader('Content-Type', 'application/json');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename=query-metrics-${Date.now()}.json`,
          );
        }

        return apiResponse.success(res, {
          status: 'success',
          data: exportData,
          timestamp: new Date().toISOString(),
        });

      default:
        return apiResponse.error(res, {
          error: 'Invalid type parameter',
          validTypes: ['summary', 'dashboard', 'export'],
        });
    }
  } catch (error) {
    logger.error('Failed to retrieve query metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.id,
    });

    return apiResponse.internalError(res, {
      error: 'Failed to retrieve query metrics',
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error instanceof Error
            ? error.message
            : 'Unknown error',
    });
  }
}

// Protect endpoint - only admins can view query metrics
export default withAuth(handler, {
  requireRoles: ['ADMIN'],
});
