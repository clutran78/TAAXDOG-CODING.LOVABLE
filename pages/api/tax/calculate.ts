import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { z } from 'zod';
import { AuthEvent } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { logger } from '@/lib/logger';
import {
  authMiddleware,
  AuthenticatedRequest,
  buildUserScopedFilters,
} from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { getClientIP } from '../../../lib/auth/auth-utils';
import { getCacheManager, CacheTTL } from '../../../lib/services/cache/cacheManager';
import { apiResponse } from '@/lib/api/response';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import {
  withErrorHandler,
  AuthenticationError,
  ValidationError,
  BadRequestError,
} from '../../../lib/errors/api-error-handler';
import { withCSRFProtection } from '../../../lib/auth/csrf-protection';
import { sessionManager } from '../../../lib/auth/session-manager';
import { addDays, format } from 'date-fns';

// Australian Tax Year (July 1 - June 30)
const TAX_YEAR_START_MONTH = 7; // July
const TAX_YEAR_START_DAY = 1;

// Australian Tax Rates 2023-24 (Residents)
const TAX_BRACKETS_RESIDENT = [
  { min: 0, max: 18200, rate: 0, base: 0 },
  { min: 18201, max: 45000, rate: 0.19, base: 0 },
  { min: 45001, max: 120000, rate: 0.325, base: 5092 },
  { min: 120001, max: 180000, rate: 0.37, base: 29467 },
  { min: 180001, max: Infinity, rate: 0.45, base: 51667 },
];

// Medicare Levy
const MEDICARE_LEVY_RATE = 0.02;
const MEDICARE_LEVY_THRESHOLD_SINGLE = 24276;
const MEDICARE_LEVY_SHADE_IN_RATE = 0.10;

// GST Rate
const GST_RATE = 0.10;

// Super Guarantee Rate
const SUPER_GUARANTEE_RATE = 0.11; // 11% for 2023-24

// Tax Categories (ATO compliant)
const TAX_DEDUCTION_CATEGORIES = {
  D1: { code: 'D1', name: 'Car expenses', limit: null },
  D2: { code: 'D2', name: 'Travel expenses', limit: null },
  D3: { code: 'D3', name: 'Clothing, laundry and dry-cleaning expenses', limit: 150 },
  D4: { code: 'D4', name: 'Education expenses', limit: null },
  D5: { code: 'D5', name: 'Other work-related expenses', limit: 300 },
  D6: { code: 'D6', name: 'Low value pool deduction', limit: null },
  D7: { code: 'D7', name: 'Interest deductions', limit: null },
  D8: { code: 'D8', name: 'Dividend deductions', limit: null },
  D9: { code: 'D9', name: 'Gifts and donations', limit: null },
  D10: { code: 'D10', name: 'Cost of managing tax affairs', limit: null },
  D11: { code: 'D11', name: 'Deductible amount of undeducted purchase price', limit: null },
  D12: { code: 'D12', name: 'Personal superannuation contributions', limit: null },
  D13: { code: 'D13', name: 'Deduction for project pool', limit: null },
  D14: { code: 'D14', name: 'Forestry managed investment', limit: null },
  D15: { code: 'D15', name: 'Other deductions', limit: null },
  P8: { code: 'P8', name: 'Partnership and trust deductions', limit: null },
};

// Validation schemas
const calculateTaxSchema = z.object({
  income: z.object({
    salary: z.number().min(0).optional().default(0),
    businessIncome: z.number().min(0).optional().default(0),
    investmentIncome: z.number().min(0).optional().default(0),
    otherIncome: z.number().min(0).optional().default(0),
    taxWithheld: z.number().min(0).optional().default(0),
  }),
  deductions: z.object({
    workRelated: z.number().min(0).optional().default(0),
    selfEducation: z.number().min(0).optional().default(0),
    donations: z.number().min(0).optional().default(0),
    interestAndDividends: z.number().min(0).optional().default(0),
    otherDeductions: z.number().min(0).optional().default(0),
    categories: z.record(z.enum(Object.keys(TAX_DEDUCTION_CATEGORIES) as [string, ...string[]]), z.number().min(0)).optional(),
  }).optional(),
  offsets: z.object({
    dependentSpouse: z.boolean().optional(),
    dependentChildren: z.number().min(0).max(10).optional(),
    privateHealthInsurance: z.boolean().optional(),
    superContributions: z.number().min(0).optional(),
  }).optional(),
  residencyStatus: z.enum(['RESIDENT', 'NON_RESIDENT', 'WORKING_HOLIDAY']).default('RESIDENT'),
  taxYear: z.string().regex(/^\d{4}$/).optional(),
  includeSuper: z.boolean().optional().default(true),
  includeGST: z.boolean().optional().default(false),
});

const estimateTaxSchema = z.object({
  period: z.enum(['weekly', 'fortnightly', 'monthly', 'quarterly', 'annually']),
  amount: z.number().positive(),
  includeSuper: z.boolean().optional().default(true),
  residencyStatus: z.enum(['RESIDENT', 'NON_RESIDENT', 'WORKING_HOLIDAY']).default('RESIDENT'),
});

// Tax calculation result interface
interface TaxCalculationResult {
  taxableIncome: number;
  totalDeductions: number;
  taxPayable: number;
  medicareLevy: number;
  totalTax: number;
  taxWithheld: number;
  estimatedRefund: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  afterTaxIncome: number;
  breakdown: {
    income: Record<string, number>;
    deductions: Record<string, number>;
    taxByBracket: Array<{
      bracket: string;
      taxableAmount: number;
      rate: number;
      tax: number;
    }>;
  };
  warnings: string[];
  recommendations: string[];
}

/**
 * Tax calculation API endpoint
 * Calculates Australian tax obligations with full compliance
 */
async function taxCalculateHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = crypto.randomUUID();
  const userId = req.userId;
  const userEmail = req.userEmail;
  const clientIp = getClientIP(req);
  const sessionId = req.session?.id;

  // Validate authentication
  if (!userId) {
    logger.error('Missing user ID in authenticated request', { requestId });
    throw new AuthenticationError('User authentication failed');
  }

  // Update session activity
  if (sessionId) {
    await sessionManager.updateSessionActivity(sessionId, req);
  }

  logger.info('Tax calculation API access', {
    userId,
    userEmail,
    method: req.method,
    clientIp,
    requestId,
    sessionId,
  });

  try {
    switch (req.method) {
      case 'POST':
        return await handleCalculateTax(userId, req.body, res, req, requestId);

      case 'GET':
        return await handleGetTaxSummary(userId, req.query, res, req, requestId);

      default:
        res.setHeader('Allow', ['POST', 'GET']);
        throw new ValidationError(`Method ${req.method} is not allowed`);
    }
  } catch (error) {
    logger.error('Tax calculation API error', {
      error,
      userId,
      method: req.method,
      requestId,
    });

    // Log error for monitoring
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.API_ERROR,
        userId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: false,
        metadata: {
          endpoint: '/api/tax/calculate',
          method: req.method,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId,
        },
      },
    }).catch(err => logger.error('Audit log error', { err }));

    throw error;
  }
}

/**
 * Handle tax calculation
 */
async function handleCalculateTax(
  userId: string,
  body: any,
  res: NextApiResponse,
  req: AuthenticatedRequest,
  requestId: string,
) {
  const startTime = Date.now();
  const clientIp = getClientIP(req);
  const cacheManager = await getCacheManager();

  try {
    // Validate request body
    const validatedData = calculateTaxSchema.parse(body);
    const { income, deductions = {}, offsets = {}, residencyStatus, taxYear, includeSuper, includeGST } = validatedData;

    // Determine tax year
    const currentTaxYear = getCurrentTaxYear();
    const selectedTaxYear = taxYear || currentTaxYear;

    // Build cache key
    const cacheKey = `tax:calculate:${userId}:${selectedTaxYear}:${JSON.stringify(validatedData)}`;
    
    // Try cache first
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached tax calculation', { userId, requestId });
      return apiResponse.success(res, cached);
    }

    // Calculate total income
    const totalIncome = 
      income.salary + 
      income.businessIncome + 
      income.investmentIncome + 
      income.otherIncome;

    // Calculate total deductions
    let totalDeductions = 
      deductions.workRelated +
      deductions.selfEducation +
      deductions.donations +
      deductions.interestAndDividends +
      deductions.otherDeductions;

    // Add category-specific deductions with limits
    if (deductions.categories) {
      for (const [category, amount] of Object.entries(deductions.categories)) {
        const categoryInfo = TAX_DEDUCTION_CATEGORIES[category as keyof typeof TAX_DEDUCTION_CATEGORIES];
        if (categoryInfo) {
          if (categoryInfo.limit && amount > categoryInfo.limit) {
            logger.warn('Deduction limit exceeded', {
              userId,
              category,
              amount,
              limit: categoryInfo.limit,
              requestId,
            });
            totalDeductions += categoryInfo.limit;
          } else {
            totalDeductions += amount;
          }
        }
      }
    }

    // Calculate taxable income
    const taxableIncome = Math.max(0, totalIncome - totalDeductions);

    // Calculate tax based on residency status
    const { tax, marginalRate } = calculateIncomeTax(taxableIncome, residencyStatus);
    
    // Calculate Medicare Levy (residents only)
    const medicareLevy = residencyStatus === 'RESIDENT' 
      ? calculateMedicareLevy(taxableIncome)
      : 0;

    // Apply tax offsets
    let totalOffsets = 0;
    if (residencyStatus === 'RESIDENT') {
      // Low income tax offset (automatically applied)
      totalOffsets += calculateLowIncomeTaxOffset(taxableIncome);
      
      // Other offsets based on user input
      if (offsets.dependentSpouse) {
        totalOffsets += 2355; // Dependent spouse tax offset
      }
    }

    // Calculate total tax payable
    const totalTax = Math.max(0, tax + medicareLevy - totalOffsets);
    
    // Calculate refund or amount owing
    const estimatedRefund = income.taxWithheld - totalTax;
    
    // Calculate effective tax rate
    const effectiveTaxRate = totalIncome > 0 ? (totalTax / totalIncome) * 100 : 0;
    
    // Calculate after-tax income
    const afterTaxIncome = totalIncome - totalTax;

    // Generate tax breakdown
    const breakdown = generateTaxBreakdown(taxableIncome, residencyStatus);

    // Generate warnings and recommendations
    const warnings = generateWarnings(validatedData, totalDeductions, taxableIncome);
    const recommendations = generateRecommendations(validatedData, totalIncome, totalDeductions, effectiveTaxRate);

    const result: TaxCalculationResult = {
      taxableIncome,
      totalDeductions,
      taxPayable: tax,
      medicareLevy,
      totalTax,
      taxWithheld: income.taxWithheld,
      estimatedRefund,
      effectiveTaxRate: Math.round(effectiveTaxRate * 100) / 100,
      marginalTaxRate: marginalRate * 100,
      afterTaxIncome,
      breakdown: {
        income: {
          salary: income.salary,
          businessIncome: income.businessIncome,
          investmentIncome: income.investmentIncome,
          otherIncome: income.otherIncome,
          total: totalIncome,
        },
        deductions: {
          workRelated: deductions.workRelated,
          selfEducation: deductions.selfEducation,
          donations: deductions.donations,
          interestAndDividends: deductions.interestAndDividends,
          otherDeductions: deductions.otherDeductions,
          total: totalDeductions,
        },
        taxByBracket: breakdown,
      },
      warnings,
      recommendations,
    };

    // Save calculation to database for history
    await prisma.taxCalculation.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        taxYear: selectedTaxYear,
        totalIncome,
        taxableIncome,
        totalDeductions,
        totalTax,
        estimatedRefund,
        calculationData: validatedData as any,
        result: result as any,
      },
    });

    // Cache the result
    await cacheManager.set(cacheKey, result, CacheTTL.HOUR);

    // Log successful calculation
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.TAX_CALCULATION,
        userId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: {
          taxYear: selectedTaxYear,
          totalIncome,
          taxableIncome,
          totalTax,
          estimatedRefund,
          processingTime: Date.now() - startTime,
          requestId,
        },
      },
    });

    logger.info('Tax calculation completed', {
      userId,
      taxYear: selectedTaxYear,
      processingTime: Date.now() - startTime,
      requestId,
    });

    return apiResponse.success(res, {
      calculation: result,
      metadata: {
        taxYear: selectedTaxYear,
        calculatedAt: new Date().toISOString(),
        disclaimer: 'This is an estimate only. Please consult a tax professional for accurate advice.',
      },
    });

  } catch (error) {
    logger.error('Error calculating tax', {
      error,
      userId,
      duration: Date.now() - startTime,
      requestId,
    });

    throw error;
  }
}

/**
 * Get tax summary for a specific year
 */
async function handleGetTaxSummary(
  userId: string,
  query: any,
  res: NextApiResponse,
  req: AuthenticatedRequest,
  requestId: string,
) {
  const { taxYear } = query;
  const selectedTaxYear = taxYear || getCurrentTaxYear();

  try {
    // Get user's transactions for the tax year
    const { startDate, endDate } = getTaxYearDates(selectedTaxYear);

    const [transactions, calculations] = await Promise.all([
      // Get all transactions for the tax year
      prisma.transaction.findMany({
        where: {
          userId,
          date: {
            gte: startDate,
            lte: endDate,
          },
          deletedAt: null,
        },
        select: {
          id: true,
          amount: true,
          type: true,
          category: true,
          taxCategory: true,
          isBusinessExpense: true,
          date: true,
          description: true,
        },
      }),
      // Get saved calculations
      prisma.taxCalculation.findMany({
        where: {
          userId,
          taxYear: selectedTaxYear,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      }),
    ]);

    // Calculate summary from transactions
    const summary = calculateTaxSummaryFromTransactions(transactions);

    return apiResponse.success(res, {
      taxYear: selectedTaxYear,
      period: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd'),
      },
      summary,
      recentCalculations: calculations.map(calc => ({
        id: calc.id,
        calculatedAt: calc.createdAt,
        totalIncome: calc.totalIncome,
        totalTax: calc.totalTax,
        estimatedRefund: calc.estimatedRefund,
      })),
      transactionCount: transactions.length,
    });

  } catch (error) {
    logger.error('Error getting tax summary', {
      error,
      userId,
      taxYear: selectedTaxYear,
      requestId,
    });

    throw error;
  }
}

// Helper functions

function getCurrentTaxYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  // Tax year starts July 1
  if (month >= TAX_YEAR_START_MONTH) {
    return year.toString();
  } else {
    return (year - 1).toString();
  }
}

function getTaxYearDates(taxYear: string) {
  const year = parseInt(taxYear);
  return {
    startDate: new Date(year, TAX_YEAR_START_MONTH - 1, TAX_YEAR_START_DAY),
    endDate: new Date(year + 1, TAX_YEAR_START_MONTH - 1, 0, 23, 59, 59),
  };
}

function calculateIncomeTax(taxableIncome: number, residencyStatus: string): { tax: number; marginalRate: number } {
  if (residencyStatus === 'NON_RESIDENT') {
    // Non-resident tax rates (no tax-free threshold)
    if (taxableIncome <= 120000) return { tax: taxableIncome * 0.325, marginalRate: 0.325 };
    if (taxableIncome <= 180000) return { tax: 39000 + (taxableIncome - 120000) * 0.37, marginalRate: 0.37 };
    return { tax: 61200 + (taxableIncome - 180000) * 0.45, marginalRate: 0.45 };
  }

  if (residencyStatus === 'WORKING_HOLIDAY') {
    // Working holiday maker tax rates
    if (taxableIncome <= 45000) return { tax: taxableIncome * 0.15, marginalRate: 0.15 };
    if (taxableIncome <= 120000) return { tax: 6750 + (taxableIncome - 45000) * 0.325, marginalRate: 0.325 };
    if (taxableIncome <= 180000) return { tax: 31125 + (taxableIncome - 120000) * 0.37, marginalRate: 0.37 };
    return { tax: 53325 + (taxableIncome - 180000) * 0.45, marginalRate: 0.45 };
  }

  // Resident tax rates
  let tax = 0;
  let marginalRate = 0;

  for (const bracket of TAX_BRACKETS_RESIDENT) {
    if (taxableIncome > bracket.min && taxableIncome <= bracket.max) {
      tax = bracket.base + (taxableIncome - bracket.min) * bracket.rate;
      marginalRate = bracket.rate;
      break;
    }
  }

  return { tax, marginalRate };
}

function calculateMedicareLevy(taxableIncome: number): number {
  if (taxableIncome <= MEDICARE_LEVY_THRESHOLD_SINGLE) {
    return 0;
  }
  
  const shadeInThreshold = MEDICARE_LEVY_THRESHOLD_SINGLE * 1.25;
  if (taxableIncome <= shadeInThreshold) {
    // Shade-in range
    return (taxableIncome - MEDICARE_LEVY_THRESHOLD_SINGLE) * MEDICARE_LEVY_SHADE_IN_RATE;
  }
  
  return taxableIncome * MEDICARE_LEVY_RATE;
}

function calculateLowIncomeTaxOffset(taxableIncome: number): number {
  if (taxableIncome <= 37500) return 700;
  if (taxableIncome <= 45000) return 700 - ((taxableIncome - 37500) * 0.05);
  if (taxableIncome <= 66667) return 325 - ((taxableIncome - 45000) * 0.015);
  return 0;
}

function generateTaxBreakdown(taxableIncome: number, residencyStatus: string): any[] {
  const breakdown = [];
  let remainingIncome = taxableIncome;

  if (residencyStatus === 'RESIDENT') {
    for (const bracket of TAX_BRACKETS_RESIDENT) {
      if (remainingIncome <= 0) break;
      
      const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min);
      if (taxableInBracket > 0) {
        breakdown.push({
          bracket: `$${bracket.min.toLocaleString()} - $${bracket.max === Infinity ? '∞' : bracket.max.toLocaleString()}`,
          taxableAmount: taxableInBracket,
          rate: bracket.rate * 100,
          tax: taxableInBracket * bracket.rate,
        });
        remainingIncome -= taxableInBracket;
      }
    }
  }

  return breakdown;
}

function generateWarnings(data: any, totalDeductions: number, taxableIncome: number): string[] {
  const warnings = [];

  // High deductions warning
  if (data.income.salary > 0 && totalDeductions > data.income.salary * 0.5) {
    warnings.push('Your deductions exceed 50% of your salary income. Ensure you have proper documentation.');
  }

  // No tax withheld warning
  if (taxableIncome > 18200 && data.income.taxWithheld === 0) {
    warnings.push('No tax has been withheld but you have taxable income. You may need to pay tax.');
  }

  // Business income warning
  if (data.income.businessIncome > 75000) {
    warnings.push('Your business income exceeds $75,000. Consider if you need to register for GST.');
  }

  // Super contribution warning
  if (data.income.salary > 0 && !data.offsets?.superContributions) {
    warnings.push('Consider making additional super contributions to reduce your taxable income.');
  }

  return warnings;
}

function generateRecommendations(data: any, totalIncome: number, totalDeductions: number, effectiveTaxRate: number): string[] {
  const recommendations = [];

  // Salary sacrifice recommendation
  if (effectiveTaxRate > 30) {
    recommendations.push('Consider salary sacrificing into super to reduce your taxable income.');
  }

  // Deduction tracking
  if (totalDeductions < totalIncome * 0.05) {
    recommendations.push('You may be missing eligible deductions. Keep better records of work-related expenses.');
  }

  // Private health insurance
  if (totalIncome > 90000 && !data.offsets?.privateHealthInsurance) {
    recommendations.push('Consider private health insurance to avoid the Medicare Levy Surcharge.');
  }

  // Tax planning
  if (data.income.investmentIncome > 10000) {
    recommendations.push('Review your investment structure with a tax professional for potential savings.');
  }

  return recommendations;
}

function calculateTaxSummaryFromTransactions(transactions: any[]): any {
  const income = {
    total: 0,
    byCategory: {} as Record<string, number>,
  };

  const deductions = {
    total: 0,
    byCategory: {} as Record<string, number>,
  };

  for (const transaction of transactions) {
    if (transaction.type === 'CREDIT') {
      income.total += transaction.amount;
      const category = transaction.category || 'Other';
      income.byCategory[category] = (income.byCategory[category] || 0) + transaction.amount;
    } else if (transaction.isBusinessExpense && transaction.taxCategory) {
      deductions.total += Math.abs(transaction.amount);
      const category = transaction.taxCategory;
      deductions.byCategory[category] = (deductions.byCategory[category] || 0) + Math.abs(transaction.amount);
    }
  }

  return {
    income,
    deductions,
    netPosition: income.total - deductions.total,
  };
}

// Export with comprehensive middleware stack
export default composeMiddleware(
  validateMethod(['POST', 'GET']),
  withValidation({
    body: (req: NextApiRequest) => {
      if (req.method === 'POST') {
        const path = req.query.action;
        if (path === 'estimate') return estimateTaxSchema;
        return calculateTaxSchema;
      }
      return z.object({});
    },
    query: (req: NextApiRequest) => {
      if (req.method === 'GET') {
        return z.object({
          taxYear: z.string().regex(/^\d{4}$/).optional(),
        });
      }
      return z.object({});
    },
  }),
  authMiddleware.authenticated,
  withCSRFProtection,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
  }),
)(withErrorHandler(taxCalculateHandler));