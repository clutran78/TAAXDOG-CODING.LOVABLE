import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';
import { authMiddleware, AuthenticatedRequest } from '../../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../../lib/security/sanitizer';
import { getClientIp } from 'request-ip';
import { GSTComplianceService } from '../../../../lib/services/compliance/gstCompliance';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../../lib/middleware/validation';
import { complianceSchemas } from '../../../../lib/validation/api-schemas';
import { logger } from '../../../../lib/utils/logger';
import { AuthEvent } from '@prisma/client';
import { apiResponse } from '@/lib/api/response';

/**
 * ABN Validation API endpoint with comprehensive validation
 * Validates Australian Business Numbers and checks GST registration
 * Uses authentication middleware to ensure data isolation
 */
async function validateABNHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const userId = req.userId!;
  const clientIp = getClientIp(req) || 'unknown';

  // Validate userId exists
  if (!userId) {
    logger.error('Missing userId in authenticated request', { requestId });
    return apiResponse.unauthorized(res, {
      error: 'Authentication Error',
      message: 'User ID not found in authenticated request',
      requestId,
    });
  }

  try {
    // Body is already validated by middleware
    const { abn } = req.body;

    logger.info('ABN validation request', {
      userId,
      abn: abn.substring(0, 3) + '***', // Log partial ABN for privacy
      clientIp,
      requestId,
    });

    const abnValidation = GSTComplianceService.validateABN(abn);

    if (abnValidation.valid) {
      // Also check GST registration status
      const gstRegistration = await GSTComplianceService.validateGSTRegistration(abn);

      // Log successful validation
      await prisma.auditLog
        .create({
          data: {
            event: 'ABN_VALIDATION' as AuthEvent,
            userId,
            ipAddress: clientIp,
            userAgent: req.headers['user-agent'] || '',
            success: true,
            metadata: {
              formatted: abnValidation.formatted,
              gstRegistered: gstRegistration.registered,
              timestamp: new Date().toISOString(),
            },
          },
        })
        .catch((err) => logger.error('Audit log error:', err));

      logger.info('ABN validation successful', {
        userId,
        valid: true,
        gstRegistered: gstRegistration.registered,
        requestId,
      });

      return apiResponse.success(res, {
        success: true,
        data: {
          valid: true,
          formatted: abnValidation.formatted,
          gstRegistered: gstRegistration.registered,
          gstRegistrationDate: gstRegistration.registrationDate,
        },
      });
    }

    logger.info('ABN validation failed', {
      userId,
      valid: false,
      requestId,
    });

    return apiResponse.success(res, {
      success: true,
      data: {
        valid: false,
        message: 'Invalid ABN format',
      },
    });
  } catch (error) {
    logger.error('ABN validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Failed to validate ABN',
      message: 'Unable to validate ABN. Please try again.',
      requestId,
    });
  }
}

// Export with validation, authentication and rate limiting middleware
export default composeMiddleware(
  validateMethod(['POST']),
  withValidation({
    body: complianceSchemas.abnValidation.body,
    response: complianceSchemas.abnValidation.response,
  }),
  authMiddleware.authenticated,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 30, // 30 validations per minute
  }),
)(validateABNHandler);
