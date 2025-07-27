import { NextApiRequest, NextApiResponse } from 'next';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import { z } from 'zod';
import { apiResponse } from '@/lib/api/response';

// Test schema
const testSchema = z.object({
  delay: z.number().min(0).max(5000).optional().default(0),
  shouldFail: z.boolean().optional().default(false),
  statusCode: z.number().min(200).max(599).optional().default(200),
});

/**
 * Test endpoint for monitoring system
 * Used to verify monitoring is working correctly
 */
async function testHandler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { delay, shouldFail, statusCode } = req.query as z.infer<typeof testSchema>;

    // Simulate processing delay
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Simulate error if requested
    if (shouldFail) {
      return res.status(statusCode).json({
        error: 'Test error',
        message: 'This is a simulated error for testing monitoring',
        requestId: (req as any).requestId,
      });
    }

    // Success response
    return apiResponse.success(res, {
      success: true,
      message: 'Test endpoint working correctly',
      monitoring: {
        delay,
        shouldFail,
        statusCode,
      },
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return apiResponse.internalError(res, {
      error: 'Unexpected error',
      message: error instanceof Error ? error.message : 'Unknown error',
      requestId: (req as any).requestId,
    });
  }
}

// Export with validation only (no auth needed for test endpoint)
export default composeMiddleware(
  validateMethod(['GET']),
  withValidation({
    query: testSchema,
  }),
)(testHandler);
