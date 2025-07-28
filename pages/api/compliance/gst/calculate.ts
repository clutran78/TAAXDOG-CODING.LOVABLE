import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';
import { authMiddleware, AuthenticatedRequest } from '../../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../../lib/security/sanitizer';
import { getClientIp } from 'request-ip';
import { GSTComplianceService } from '../../../../lib/services/compliance/gstCompliance';
import { TaxCalculationService } from '../../../../lib/services/tax-calculations';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../../lib/middleware/validation';
import { complianceSchemas } from '../../../../lib/validation/api-schemas';
import { logger } from '../../../../lib/utils/logger';
import { AuthEvent } from '@prisma/client';
import { apiResponse } from '@/lib/api/response';

// Map request type to appropriate schema validation
function getValidationSchemas(req: NextApiRequest) {
  if (req.body?.transactions) {
    return {
      body: complianceSchemas.gstBulkCalculate.body,
      response: complianceSchemas.gstBulkCalculate.response,
    };
  }
  return {
    body: complianceSchemas.gstCalculate.body,
    response: complianceSchemas.gstCalculate.response,
  };
}

/**
 * GST Calculation API endpoint with comprehensive validation
 * Handles POST operations for GST calculations
 * Uses authentication middleware to ensure data isolation
 */
async function gstCalculateHandler(req: AuthenticatedRequest, res: NextApiResponse) {
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
    logger.info('GST calculation request', {
      userId,
      isBulk: !!req.body.transactions,
      clientIp,
      requestId,
    });

    // Check if bulk calculation
    if (req.body.transactions) {
      return handleBulkCalculation(req, res, userId, requestId);
    }

    // Single calculation - body is already validated by middleware
    const { amount, category, isGSTRegistered, gstInclusive, isBusinessExpense } = req.body;

    // Calculate using enhanced tax service
    const taxCalc = TaxCalculationService.calculateTax({
      amount,
      category,
      isBusinessExpense,
      hasGST: isGSTRegistered,
      gstInclusive,
    });

    // Also get simple GST calculation
    const gstCalc = GSTComplianceService.calculateGST(amount, category, isGSTRegistered);

    // Log calculation for audit
    await prisma.auditLog
      .create({
        data: {
          event: 'GST_CALCULATION' as AuthEvent,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            amount,
            category,
            gstAmount: taxCalc.gstAmount,
            taxCategory: taxCalc.taxCategory,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    logger.info('GST calculation completed', {
      userId,
      amount,
      gstAmount: taxCalc.gstAmount,
      requestId,
    });

    return apiResponse.success(res, {
      success: true,
      data: {
        calculation: taxCalc,
        gst: {
          baseAmount: gstCalc.baseAmount,
          gstAmount: gstCalc.gstAmount,
          totalAmount: gstCalc.totalAmount,
          gstRate: gstCalc.gstRate,
          treatment: gstCalc.treatment,
        },
        compliance: {
          isGSTCompliant: isGSTRegistered && taxCalc.gstTreatment === 'TAXABLE',
          requiresTaxInvoice: amount > 82.5 && isBusinessExpense,
          deductible: taxCalc.deductibleAmount > 0,
        },
      },
    });
  } catch (error) {
    logger.error('GST calculation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      requestId,
    });

    // Log error
    await prisma.auditLog
      .create({
        data: {
          event: 'GST_CALCULATION_ERROR' as AuthEvent,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    return apiResponse.internalError(res, {
      error: 'GST calculation failed',
      message: 'Unable to calculate GST. Please try again.',
      requestId,
    });
  }
}

async function handleBulkCalculation(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  userId: string,
  requestId?: string,
) {
  try {
    // Body is already validated by middleware
    const { transactions } = req.body;
    const results = [];

    // Process each transaction
    for (const tx of transactions) {
      try {
        const taxCalc = TaxCalculationService.calculateTax({
          amount: tx.amount,
          category: tx.category,
          description: tx.description,
          date: tx.date ? new Date(tx.date) : undefined,
          isBusinessExpense: tx.isBusinessExpense,
          hasGST: true,
          gstInclusive: true,
        });

        results.push({
          id: tx.id,
          success: true,
          calculation: taxCalc,
        });
      } catch (error) {
        results.push({
          id: tx.id,
          success: false,
          error: error instanceof Error ? error.message : 'Calculation failed',
        });
      }
    }

    // Calculate summary
    const summary = {
      totalTransactions: transactions.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      totalGST: results
        .filter((r) => r.success)
        .reduce((sum, r) => sum + (r.calculation?.gstAmount || 0), 0),
      totalDeductible: results
        .filter((r) => r.success)
        .reduce((sum, r) => sum + (r.calculation?.deductibleAmount || 0), 0),
    };

    logger.info('Bulk GST calculation completed', {
      userId,
      totalTransactions: transactions.length,
      successful: summary.successful,
      failed: summary.failed,
      requestId,
    });

    return apiResponse.success(res, {
      success: true,
      data: {
        results,
        summary,
      },
    });
  } catch (error) {
    logger.error('Bulk GST calculation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Bulk calculation failed',
      message: 'Unable to process bulk GST calculations. Please try again.',
      requestId,
    });
  }
}

// Export with validation, authentication and rate limiting middleware
export default composeMiddleware(
  validateMethod(['POST']),
  withValidation((req: NextApiRequest) => getValidationSchemas(req)),
  authMiddleware.authenticated,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute (calculations are lightweight)
  }),
)(gstCalculateHandler);
