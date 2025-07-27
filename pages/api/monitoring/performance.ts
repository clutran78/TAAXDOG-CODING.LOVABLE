import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth/middleware';
import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    const {
      webVitals,
      navigation,
      resources,
      customMetrics,
      interactions,
      timestamp,
      url,
      userAgent,
      viewport,
      screen,
    } = req.body;

    // Extract user ID from session if available
    const userId = (req as any).session?.user?.id;

    // Send Web Vitals to Sentry
    if (webVitals) {
      const transaction = Sentry.startTransaction({
        name: 'web-vitals',
        op: 'web.vitals',
      });

      // Add measurements
      if (webVitals.CLS !== undefined) {
        transaction.setMeasurement('cls', webVitals.CLS, 'none');
      }
      if (webVitals.FCP !== undefined) {
        transaction.setMeasurement('fcp', webVitals.FCP, 'millisecond');
      }
      if (webVitals.FID !== undefined) {
        transaction.setMeasurement('fid', webVitals.FID, 'millisecond');
      }
      if (webVitals.LCP !== undefined) {
        transaction.setMeasurement('lcp', webVitals.LCP, 'millisecond');
      }
      if (webVitals.TTFB !== undefined) {
        transaction.setMeasurement('ttfb', webVitals.TTFB, 'millisecond');
      }

      transaction.setTag('url', url);
      transaction.finish();
    }

    // Log performance data for analytics
    console.log('Performance metrics received:', {
      userId,
      url,
      webVitals,
      customMetrics,
      userAgent,
      viewport,
    });

    // Log significant performance issues
    if (webVitals) {
      const issues = [];

      if (webVitals.CLS > 0.25) {
        issues.push(`High CLS: ${webVitals.CLS}`);
      }
      if (webVitals.FCP > 3000) {
        issues.push(`Slow FCP: ${webVitals.FCP}ms`);
      }
      if (webVitals.LCP > 4000) {
        issues.push(`Slow LCP: ${webVitals.LCP}ms`);
      }
      if (webVitals.FID > 300) {
        issues.push(`High FID: ${webVitals.FID}ms`);
      }
      if (webVitals.TTFB > 1800) {
        issues.push(`Slow TTFB: ${webVitals.TTFB}ms`);
      }

      if (issues.length > 0) {
        Sentry.captureMessage(`Performance issues detected: ${issues.join(', ')}`, 'warning');
      }
    }

    // Process resource timings for insights
    if (resources && resources.length > 0) {
      const slowResources = resources.filter((r: any) => r.duration > 1000);
      if (slowResources.length > 0) {
        logger.warn('Slow resources detected:', slowResources);
      }
    }

    apiResponse.success(res, { success: true });
  } catch (error) {
    logger.error('Error processing performance data:', error);
    Sentry.captureException(error);
    apiResponse.internalError(res, { error: 'Failed to process performance data' });
  }
}

// Don't require auth for performance monitoring
export default handler;
