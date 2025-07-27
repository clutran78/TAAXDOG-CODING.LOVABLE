import { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    const { errors, userAgent, timestamp, url, batchSize } = req.body;

    // Extract user ID from session if available
    const userId = (req as any).session?.user?.id;

    // Process each error in the batch
    for (const error of errors) {
      // Send to Sentry
      Sentry.withScope((scope) => {
        scope.setLevel('error');
        scope.setContext('browser', {
          userAgent,
          url: url || error.url,
          timestamp: error.timestamp,
        });

        if (userId) {
          scope.setUser({ id: userId });
        }

        if (error.stack) {
          scope.setContext('stacktrace', {
            stack: error.stack,
          });
        }

        Sentry.captureMessage(error.message, 'error');
      });
    }

    // Log batch statistics
    if (batchSize > 10) {
      logger.warn(`Large error batch received: ${batchSize} errors from ${url}`);
    }

    apiResponse.success(res, {
      success: true,
      processed: errors.length,
    });
  } catch (error) {
    logger.error('Error processing client errors:', error);
    Sentry.captureException(error);
    apiResponse.internalError(res, { error: 'Failed to process errors' });
  }
}
