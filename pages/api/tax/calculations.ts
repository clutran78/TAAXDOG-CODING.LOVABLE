import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { authMiddleware, AuthenticatedRequest } from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { getClientIp } from 'request-ip';
import { TaxCalculationService, TaxCategory } from '../../../lib/services/tax-calculations';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import { taxSchemas } from '../../../lib/validation/api-schemas';
import { logger } from '../../../lib/utils/logger';
import { AuthEvent } from '@prisma/client';
import { apiResponse } from '@/lib/api/response';

// Map action to appropriate schema validation
function getValidationSchemas(action?: string, method?: string) {
  if (method === 'GET') {
    switch (action) {
      case 'summary':
        return { query: taxSchemas.summary.query, response: taxSchemas.summary.response };
      case 'deductions':
        return { query: taxSchemas.deductions.query, response: taxSchemas.deductions.response };
      default:
        return {};
    }
  } else if (method === 'POST') {
    switch (action) {
      case 'payg':
        return { body: taxSchemas.payg.body, response: taxSchemas.payg.response };
      case 'validate-abn':
        return { body: taxSchemas.validateABN.body, response: taxSchemas.validateABN.response };
      case 'validate-tfn':
        return { body: taxSchemas.validateTFN.body, response: taxSchemas.validateTFN.response };
      default:
        return {};
    }
  }
  return {};
}

/**
 * Tax Calculations API endpoint with comprehensive validation
 * Handles various tax calculation operations
 * Uses authentication middleware to ensure data isolation
 */
async function taxCalculationsHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const userId = req.userId!;
  const clientIp = getClientIp(req) || 'unknown';
  const { action } = req.query;

  try {
    // Validate userId exists
    if (!userId) {
      logger.error('Missing userId in authenticated request', { requestId });
      return apiResponse.unauthorized(res, {
        error: 'Authentication Error',
        message: 'User ID not found in authenticated request',
        requestId,
      });
    }

    // Log tax calculation access
    await prisma.auditLog
      .create({
        data: {
          event: 'TAX_CALCULATION_ACCESS' as AuthEvent,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            action: action || 'default',
            method: req.method,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    logger.info('Tax calculation API access', {
      userId,
      action: action || 'default',
      method: req.method,
      clientIp,
      requestId,
    });

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, userId, action as string, requestId);
      case 'POST':
        return handlePost(req, res, userId, action as string, requestId);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return apiResponse.methodNotAllowed(res, {
          error: 'Method not allowed',
          message: `Method ${req.method} is not allowed`,
          requestId,
        });
    }
  } catch (error) {
    logger.error('Tax calculations API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      action,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Internal server error',
      message: 'An error occurred while processing your request',
      requestId,
    });
  }
}

async function handleGet(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  userId: string,
  action?: string,
  requestId?: string,
) {
  try {
    switch (action) {
      case 'summary':
        return getTaxYearSummary(req, res, userId, requestId);
      case 'deductions':
        return getDeductions(req, res, userId, requestId);
      default:
        return apiResponse.error(res, {
          error: 'Invalid action',
          message: 'Supported GET actions: summary, deductions',
          requestId,
        });
    }
  } catch (error) {
    logger.error('Tax calculation GET error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      action,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Failed to retrieve tax data',
      message: 'Unable to retrieve tax information. Please try again.',
      requestId,
    });
  }
}

async function handlePost(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  userId: string,
  action?: string,
  requestId?: string,
) {
  try {
    switch (action) {
      case 'payg':
        return calculatePAYG(req, res, userId, requestId);
      case 'validate-abn':
        return validateABN(req, res, userId, requestId);
      case 'validate-tfn':
        return validateTFN(req, res, userId, requestId);
      default:
        return apiResponse.error(res, {
          error: 'Invalid action',
          message: 'Supported POST actions: payg, validate-abn, validate-tfn',
          requestId,
        });
    }
  } catch (error) {
    logger.error('Tax calculation POST error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      action,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Failed to process tax calculation',
      message: 'Unable to process tax calculation. Please try again.',
      requestId,
    });
  }
}

// Get tax year summary
async function getTaxYearSummary(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  userId: string,
  requestId?: string,
) {
  // Query is already validated by middleware
  const { financialYear } = req.query as { financialYear: string };

  try {
    // Generate comprehensive tax year summary
    const summary = await TaxCalculationService.generateTaxYearSummary(userId, financialYear);

    // Log successful retrieval
    await prisma.auditLog
      .create({
        data: {
          event: 'TAX_SUMMARY_RETRIEVED' as AuthEvent,
          userId,
          ipAddress: getClientIp(req) || 'unknown',
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            financialYear,
            hasRefund: summary.estimatedTax.estimatedRefund > 0,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    logger.info('Tax summary retrieved', {
      userId,
      financialYear,
      requestId,
    });

    return apiResponse.success(res, {
      success: true,
      data: {
        financialYear,
        summary,
        generated: new Date().toISOString(),
        disclaimer:
          'This is an estimate only. Please consult a registered tax agent for accurate tax advice.',
      },
    });
  } catch (error) {
    logger.error('Tax summary error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      financialYear,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Failed to generate tax summary',
      message: 'Unable to generate tax year summary. Please try again.',
      requestId,
    });
  }
}

// Get deductions breakdown
async function getDeductions(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  userId: string,
  requestId?: string,
) {
  // Query is already validated by middleware
  const { financialYear, category } = req.query as {
    financialYear: string;
    category?: TaxCategory;
  };

  try {
    // Get deductions summary
    const deductions = await TaxCalculationService.getUserDeductions({
      userId,
      financialYear,
      category,
    });

    logger.info('Deductions retrieved', {
      userId,
      financialYear,
      category,
      count: deductions.items.length,
      requestId,
    });

    return apiResponse.success(res, {
      success: true,
      data: {
        financialYear,
        deductions,
        taxCategories: Object.values(TaxCategory),
      },
    });
  } catch (error) {
    logger.error('Deductions query error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      financialYear,
      category,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Failed to retrieve deductions',
      message: 'Unable to retrieve deduction information. Please try again.',
      requestId,
    });
  }
}

// Calculate PAYG withholding
async function calculatePAYG(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  userId: string,
  requestId?: string,
) {
  // Body is already validated by middleware
  const { grossIncome, frequency, taxFreeThreshold, medicareLevyExemption } = req.body;

  try {
    // Calculate PAYG withholding
    const calculation = TaxCalculationService.calculatePAYGWithholding(
      grossIncome,
      frequency,
      taxFreeThreshold,
      medicareLevyExemption,
    );

    // Log calculation
    await prisma.auditLog
      .create({
        data: {
          event: 'PAYG_CALCULATION' as AuthEvent,
          userId,
          ipAddress: getClientIp(req) || 'unknown',
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            frequency,
            grossIncome,
            taxWithheld: calculation.taxWithheld,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    logger.info('PAYG calculation completed', {
      userId,
      frequency,
      grossIncome,
      taxWithheld: calculation.taxWithheld,
      requestId,
    });

    return apiResponse.success(res, {
      success: true,
      data: {
        calculation,
        frequency,
        settings: {
          taxFreeThreshold,
          medicareLevyExemption,
        },
      },
    });
  } catch (error) {
    logger.error('PAYG calculation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Failed to calculate PAYG',
      message: 'Unable to calculate PAYG withholding. Please try again.',
      requestId,
    });
  }
}

// Validate ABN
async function validateABN(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  userId: string,
  requestId?: string,
) {
  // Body is already validated by middleware
  const { abn, saveToProfile } = req.body;

  try {
    // Validate ABN
    const validation = TaxCalculationService.validateABN(abn);

    // If valid, optionally save to user profile
    if (validation.valid && saveToProfile) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          abn: validation.formatted,
          updatedAt: new Date(),
        },
      });

      logger.info('ABN saved to user profile', {
        userId,
        requestId,
      });
    }

    logger.info('ABN validation completed', {
      userId,
      valid: validation.valid,
      requestId,
    });

    return apiResponse.success(res, {
      success: true,
      data: {
        valid: validation.valid,
        formatted: validation.formatted,
        error: validation.error,
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

// Validate TFN
async function validateTFN(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  userId: string,
  requestId?: string,
) {
  // Body is already validated by middleware
  const { tfn } = req.body;

  try {
    // Validate TFN
    const validation = TaxCalculationService.validateTFN(tfn);

    // Never save TFN - just return validation result
    logger.info('TFN validation completed', {
      userId,
      valid: validation.valid,
      requestId,
    });

    return apiResponse.success(res, {
      success: true,
      data: {
        valid: validation.valid,
        error: validation.error,
        message: validation.valid ? 'TFN format is valid' : 'TFN format is invalid',
      },
    });
  } catch (error) {
    logger.error('TFN validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Failed to validate TFN',
      message: 'Unable to validate TFN. Please try again.',
      requestId,
    });
  }
}

// Export with validation, authentication and rate limiting middleware
export default composeMiddleware(
  validateMethod(['GET', 'POST']),
  withValidation({
    query: (req: NextApiRequest) => {
      const schemas = getValidationSchemas(req.query.action as string, req.method);
      return schemas.query;
    },
    body: (req: NextApiRequest) => {
      const schemas = getValidationSchemas(req.query.action as string, req.method);
      return schemas.body;
    },
    response: (req: NextApiRequest) => {
      const schemas = getValidationSchemas(req.query.action as string, req.method);
      return schemas.response;
    },
  }),
  authMiddleware.authenticated,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
  }),
)(taxCalculationsHandler);
