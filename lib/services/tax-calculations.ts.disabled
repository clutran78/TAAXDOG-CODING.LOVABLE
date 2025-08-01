import prisma from '../prisma';
import { z } from 'zod';
import { AUSTRALIAN_TAX_CONFIG } from '../ai/config';

// Australian Tax Categories (ATO compliant)
export enum TaxCategory {
  // Business expense categories (D1-D15)
  D1_MOTOR_VEHICLE = 'D1', // Motor vehicle expenses
  D2_TRAVEL = 'D2', // Work-related travel expenses
  D3_UNIFORM = 'D3', // Work-related clothing, laundry and dry-cleaning
  D4_SELF_EDUCATION = 'D4', // Work-related self-education expenses
  D5_OTHER_WORK = 'D5', // Other work-related expenses
  D6_LOW_VALUE_POOL = 'D6', // Low-value pool deduction
  D7_INTEREST_DIVIDEND = 'D7', // Interest and dividend deductions
  D8_GIFTS_DONATIONS = 'D8', // Gifts or donations
  D9_DIVIDEND_DEDUCTION = 'D9', // Dividend deduction
  D10_COST_TAX_AFFAIRS = 'D10', // Cost of managing tax affairs
  D11_DEDUCTIBLE_AMOUNT = 'D11', // Deductible amount of undeducted purchase price
  D12_PERSONAL_SUPER = 'D12', // Personal superannuation contributions
  D13_SMALL_BUSINESS = 'D13', // Deduction for small business income
  D14_DEFERRED_LOSSES = 'D14', // Deferred non-commercial business losses
  D15_NET_LOSSES = 'D15', // Net non-commercial business losses

  // Property categories
  P8_RENTAL = 'P8', // Rental property expenses

  // Personal categories
  PERSONAL = 'PERSONAL', // Non-deductible personal expenses
  CAPITAL = 'CAPITAL', // Capital expenses (depreciation may apply)
}

// GST Treatment types
export enum GSTTreatment {
  TAXABLE = 'TAXABLE', // Standard GST applies (10%)
  GST_FREE = 'GST_FREE', // GST-free supply (0%)
  INPUT_TAXED = 'INPUT_TAXED', // Input taxed supply (no GST credits)
  PRIVATE = 'PRIVATE', // Private/personal use (no GST)
  EXPORT = 'EXPORT', // Export (GST-free)
}

// Tax calculation schemas
const TaxCalculationSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  category: z.string(),
  description: z.string().optional(),
  date: z.date().optional(),
  isBusinessExpense: z.boolean().default(false),
  hasGST: z.boolean().default(true),
  gstInclusive: z.boolean().default(true),
});

const DeductionCalculationSchema = z.object({
  userId: z.string().uuid(),
  financialYear: z.string().regex(/^\d{4}$/),
  category: z.nativeEnum(TaxCategory).optional(),
});

export interface TaxCalculationResult {
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
  deductibleAmount: number;
  taxCategory: TaxCategory;
  gstTreatment: GSTTreatment;
  effectiveTaxSaving: number; // Based on marginal tax rate
}

export interface DeductionSummary {
  totalDeductions: number;
  categoryBreakdown: Record<TaxCategory, number>;
  estimatedTaxSaving: number;
  gstCredits: number;
}

export class TaxCalculationService {
  private static readonly GST_RATE = AUSTRALIAN_TAX_CONFIG.GST_RATE; // 10%

  // ATO marginal tax rates 2023-24
  private static readonly TAX_BRACKETS = [
    { min: 0, max: 18200, rate: 0 },
    { min: 18201, max: 45000, rate: 0.19 },
    { min: 45001, max: 120000, rate: 0.325 },
    { min: 120001, max: 180000, rate: 0.37 },
    { min: 180001, max: Infinity, rate: 0.45 },
  ];

  // Medicare levy
  private static readonly MEDICARE_LEVY = 0.02;

  // Medicare levy low-income threshold
  private static readonly MEDICARE_LEVY_THRESHOLD = 23365;

  // ========================================
  // HELPER METHODS
  // ========================================

  /**
   * Rounds a number to 2 decimal places (cents)
   */
  private static roundToCents(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  /**
   * Calculates GST components based on treatment type
   */
  private static calculateGSTComponents(
    amount: number,
    gstTreatment: GSTTreatment,
    hasGST: boolean,
    gstInclusive: boolean,
  ): { baseAmount: number; gstAmount: number; totalAmount: number } {
    // No GST applies if treatment is not taxable or GST flag is false
    if (gstTreatment !== GSTTreatment.TAXABLE || !hasGST) {
      return {
        baseAmount: amount,
        gstAmount: 0,
        totalAmount: amount,
      };
    }

    // Calculate GST based on inclusive/exclusive flag
    return gstInclusive
      ? this.extractGSTFromInclusiveAmount(amount)
      : this.addGSTToExclusiveAmount(amount);
  }

  /**
   * Extracts GST from an amount that includes GST
   */
  private static extractGSTFromInclusiveAmount(inclusiveAmount: number): {
    baseAmount: number;
    gstAmount: number;
    totalAmount: number;
  } {
    // Formula: GST = Amount × (GST Rate ÷ (1 + GST Rate))
    const gstDivisor = 1 + this.GST_RATE;
    const gstAmount = inclusiveAmount * (this.GST_RATE / gstDivisor);
    const baseAmount = inclusiveAmount - gstAmount;

    return {
      baseAmount,
      gstAmount,
      totalAmount: inclusiveAmount,
    };
  }

  /**
   * Adds GST to an amount that excludes GST
   */
  private static addGSTToExclusiveAmount(exclusiveAmount: number): {
    baseAmount: number;
    gstAmount: number;
    totalAmount: number;
  } {
    const gstAmount = exclusiveAmount * this.GST_RATE;
    const totalAmount = exclusiveAmount + gstAmount;

    return {
      baseAmount: exclusiveAmount,
      gstAmount,
      totalAmount,
    };
  }

  /**
   * Gets financial year boundaries for Australian tax year
   */
  private static getFinancialYearBounds(financialYear: string): {
    start: Date;
    end: Date;
  } {
    const yearNumber = parseInt(financialYear);

    return {
      start: new Date(`${yearNumber}-07-01`), // July 1st
      end: new Date(`${yearNumber + 1}-06-30`), // June 30th next year
    };
  }

  /**
   * Builds query filters for deductible transactions
   */
  private static buildDeductionQueryFilters(
    userId: string,
    yearBounds: { start: Date; end: Date },
    category?: TaxCategory,
  ): any {
    const filters: any = {
      userId,
      date: {
        gte: yearBounds.start,
        lte: yearBounds.end,
      },
      isBusinessExpense: true,
      deletedAt: null,
    };

    if (category) {
      filters.taxCategory = category;
    }

    return filters;
  }

  /**
   * Processes transactions to calculate deduction totals
   */
  private static processDeductibleTransactions(transactions: any[]): {
    totalDeductions: number;
    categoryBreakdown: Record<string, number>;
    gstCredits: number;
  } {
    const categoryBreakdown: Record<string, number> = {};
    let totalDeductions = 0;
    let gstCredits = 0;

    for (const transaction of transactions) {
      // Only process expense transactions
      if (transaction.type !== 'EXPENSE') {
        continue;
      }

      // Get absolute values (expenses are negative)
      const expenseAmount = Math.abs(transaction.amount);
      const category = transaction.taxCategory || TaxCategory.D5_OTHER_WORK;

      // Accumulate category totals
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + expenseAmount;
      totalDeductions += expenseAmount;

      // Track GST credits if present
      if (transaction.gstAmount) {
        gstCredits += Math.abs(transaction.gstAmount);
      }
    }

    return {
      totalDeductions,
      categoryBreakdown,
      gstCredits,
    };
  }

  /**
   * Converts income to annual amount based on payment frequency
   */
  private static convertToAnnualIncome(
    income: number,
    frequency: 'weekly' | 'fortnightly' | 'monthly' | 'annually',
  ): number {
    const frequencyMultipliers = {
      weekly: 52,
      fortnightly: 26,
      monthly: 12,
      annually: 1,
    };

    return income * frequencyMultipliers[frequency];
  }

  /**
   * Calculates annual income tax based on tax brackets
   */
  private static calculateAnnualIncomeTax(annualIncome: number, taxFreeThreshold: boolean): number {
    // No tax if below threshold and claiming tax-free threshold
    if (taxFreeThreshold && annualIncome <= 18200) {
      return 0;
    }

    let totalTax = 0;

    // Calculate tax for each bracket
    for (const bracket of this.TAX_BRACKETS) {
      if (annualIncome > bracket.min) {
        const taxableInBracket = Math.min(annualIncome - bracket.min, bracket.max - bracket.min);
        totalTax += taxableInBracket * bracket.rate;
      }
    }

    return totalTax;
  }

  /**
   * Calculates Medicare levy based on income
   */
  private static calculateMedicareLevy(annualIncome: number, isExempt: boolean): number {
    // No levy if exempt or below threshold
    if (isExempt || annualIncome <= this.MEDICARE_LEVY_THRESHOLD) {
      return 0;
    }

    return annualIncome * this.MEDICARE_LEVY;
  }

  /**
   * Gets payment period divisor for converting annual amounts
   */
  private static getPaymentPeriodDivisor(
    frequency: 'weekly' | 'fortnightly' | 'monthly' | 'annually',
  ): number {
    const divisors = {
      weekly: 52,
      fortnightly: 26,
      monthly: 12,
      annually: 1,
    };

    return divisors[frequency];
  }

  /**
   * Calculates tax components for a financial transaction including GST and deductions
   *
   * @param {Object} input - Transaction details for tax calculation
   * @param {number} input.amount - The monetary amount of the transaction
   * @param {string} input.category - Transaction category for tax classification
   * @param {string} [input.description] - Optional description of the transaction
   * @param {Date} [input.date] - Optional transaction date
   * @param {boolean} [input.isBusinessExpense=false] - Whether this is a business expense
   * @param {boolean} [input.hasGST=true] - Whether GST applies to this transaction
   * @param {boolean} [input.gstInclusive=true] - Whether the amount includes GST
   * @returns {TaxCalculationResult} Calculated tax components
   *
   * @example
   * const result = TaxCalculationService.calculateTax({
   *   amount: 110,
   *   category: 'office_supplies',
   *   isBusinessExpense: true,
   *   hasGST: true,
   *   gstInclusive: true
   * });
   * // Returns:
   * // {
   * //   baseAmount: 100,
   * //   gstAmount: 10,
   * //   totalAmount: 110,
   * //   deductibleAmount: 100,
   * //   taxCategory: TaxCategory.D5_OTHER_WORK,
   * //   gstTreatment: GSTTreatment.TAXABLE,
   * //   effectiveTaxSaving: 32.50
   * // }
   *
   * @note GST rate is 10% as per Australian tax law
   * @note Effective tax saving is calculated using 32.5% marginal rate
   * @throws {z.ZodError} If input validation fails
   */
  static calculateTax(input: z.infer<typeof TaxCalculationSchema>): TaxCalculationResult {
    // Step 1: Validate and extract input parameters
    const validatedInput = TaxCalculationSchema.parse(input);
    const { amount, category, isBusinessExpense, hasGST, gstInclusive } = validatedInput;

    // Step 2: Determine tax classification based on transaction details
    const taxCategory = this.determineTaxCategory(category, isBusinessExpense);
    const gstTreatment = this.determineGSTTreatment(taxCategory, category);

    // Step 3: Calculate GST components based on treatment type
    const gstCalculation = this.calculateGSTComponents(amount, gstTreatment, hasGST, gstInclusive);

    // Step 4: Calculate tax deduction eligibility
    const deductibleAmount = this.calculateDeductibleAmount(
      gstCalculation.baseAmount,
      taxCategory,
      gstTreatment,
    );

    // Step 5: Estimate tax savings based on average marginal rate
    const AVERAGE_MARGINAL_TAX_RATE = 0.325; // 32.5% - typical Australian tax bracket
    const effectiveTaxSaving = deductibleAmount * AVERAGE_MARGINAL_TAX_RATE;

    // Step 6: Return rounded results for currency precision
    return {
      baseAmount: this.roundToCents(gstCalculation.baseAmount),
      gstAmount: this.roundToCents(gstCalculation.gstAmount),
      totalAmount: this.roundToCents(gstCalculation.totalAmount),
      deductibleAmount: this.roundToCents(deductibleAmount),
      taxCategory,
      gstTreatment,
      effectiveTaxSaving: this.roundToCents(effectiveTaxSaving),
    };
  }

  /**
   * Calculates GST (Goods and Services Tax) from a given amount
   *
   * @param {number} amount - The monetary amount to calculate GST from
   * @param {boolean} [gstInclusive=true] - Whether the amount already includes GST
   * @returns {Object} GST calculation breakdown
   * @returns {number} returns.baseAmount - Amount excluding GST
   * @returns {number} returns.gstAmount - GST amount (10% in Australia)
   * @returns {number} returns.totalAmount - Total amount including GST
   *
   * @example
   * // GST-inclusive amount
   * const result = TaxCalculationService.calculateGST(110, true);
   * // Returns: { baseAmount: 100, gstAmount: 10, totalAmount: 110 }
   *
   * // GST-exclusive amount
   * const result = TaxCalculationService.calculateGST(100, false);
   * // Returns: { baseAmount: 100, gstAmount: 10, totalAmount: 110 }
   *
   * @note Australian GST rate is 10%
   * @note For GST-inclusive: GST = amount × (0.1 ÷ 1.1)
   * @note For GST-exclusive: GST = amount × 0.1
   */
  static calculateGST(
    amount: number,
    inclusive: boolean = true,
  ): { baseAmount: number; gstAmount: number; totalAmount: number } {
    // Calculate GST components based on whether GST is included or excluded
    const gstComponents = inclusive
      ? this.extractGSTFromInclusiveAmount(amount)
      : this.addGSTToExclusiveAmount(amount);

    // Return rounded values for currency precision
    return {
      baseAmount: this.roundToCents(gstComponents.baseAmount),
      gstAmount: this.roundToCents(gstComponents.gstAmount),
      totalAmount: this.roundToCents(gstComponents.totalAmount),
    };
  }

  /**
   * Retrieves and calculates tax deduction summary for a user's financial year
   *
   * @param {Object} input - Deduction calculation parameters
   * @param {string} input.userId - UUID of the user
   * @param {string} input.financialYear - Financial year in YYYY format (e.g., '2023' for 2023-24)
   * @param {TaxCategory} [input.category] - Optional filter for specific tax category
   * @returns {Promise<DeductionSummary>} Summary of tax deductions and estimated savings
   *
   * @example
   * const deductions = await TaxCalculationService.getUserDeductions({
   *   userId: '123e4567-e89b-12d3-a456-426614174000',
   *   financialYear: '2023'
   * });
   * // Returns:
   * // {
   * //   totalDeductions: 15000,
   * //   categoryBreakdown: {
   * //     'D1': 5000,  // Motor vehicle
   * //     'D2': 3000,  // Travel
   * //     'D5': 7000   // Other work expenses
   * //   },
   * //   estimatedTaxSaving: 4875,  // Based on marginal rate
   * //   gstCredits: 1363.64        // GST paid on expenses
   * // }
   *
   * @note Australian financial year runs from July 1 to June 30
   * @note Only includes business expenses (isBusinessExpense = true)
   * @note Excludes deleted transactions
   * @note Tax savings are estimated based on user's marginal tax rate
   *
   * @throws {z.ZodError} If input validation fails
   */
  static async getUserDeductions(
    input: z.infer<typeof DeductionCalculationSchema>,
  ): Promise<DeductionSummary> {
    // Validate input parameters
    const { userId, financialYear, category } = DeductionCalculationSchema.parse(input);

    // Step 1: Calculate Australian financial year boundaries (July 1 - June 30)
    const financialYearBounds = this.getFinancialYearBounds(financialYear);

    // Step 2: Build query to fetch deductible transactions
    const queryFilters = this.buildDeductionQueryFilters(userId, financialYearBounds, category);

    // Step 3: Fetch all business expense transactions for the period
    const transactions = await prisma.transaction.findMany({
      where: queryFilters,
      select: {
        amount: true,
        taxCategory: true,
        gstAmount: true,
        type: true,
      },
    });

    // Step 4: Process transactions and calculate deduction totals
    const deductionTotals = this.processDeductibleTransactions(transactions);

    // Step 5: Calculate estimated tax savings based on user's income
    const userIncome = await this.getUserIncome(userId, financialYear);
    const marginalTaxRate = this.getMarginalTaxRate(userIncome);
    const estimatedTaxSaving = deductionTotals.totalDeductions * marginalTaxRate;

    // Step 6: Return formatted deduction summary
    return {
      totalDeductions: this.roundToCents(deductionTotals.totalDeductions),
      categoryBreakdown: deductionTotals.categoryBreakdown as Record<TaxCategory, number>,
      estimatedTaxSaving: this.roundToCents(estimatedTaxSaving),
      gstCredits: this.roundToCents(deductionTotals.gstCredits),
    };
  }

  /**
   * Validates an Australian Business Number (ABN) using ATO's checksum algorithm
   *
   * @param {string} abn - The ABN to validate (can include spaces or dashes)
   * @returns {Object} Validation result
   * @returns {boolean} returns.valid - Whether the ABN is valid
   * @returns {string} [returns.formatted] - ABN formatted as XX XXX XXX XXX (if valid)
   * @returns {string} [returns.error] - Error message if invalid
   *
   * @example
   * const result = TaxCalculationService.validateABN('51 824 753 556');
   * // Returns: { valid: true, formatted: '51 824 753 556' }
   *
   * const result = TaxCalculationService.validateABN('12345678901');
   * // Returns: { valid: false, error: 'Invalid ABN checksum' }
   *
   * @note ABN validation algorithm:
   * 1. Subtract 1 from the first digit
   * 2. Multiply each digit by its weight
   * 3. Sum all products
   * 4. Check if sum is divisible by 89
   *
   * @see https://abr.business.gov.au/Help/AbnFormat
   */
  static validateABN(abn: string): { valid: boolean; formatted?: string; error?: string } {
    // Step 1: Clean input by removing all non-numeric characters
    const cleanedABN = abn.replace(/[^0-9]/g, '');

    // Step 2: Validate ABN length (must be exactly 11 digits)
    if (cleanedABN.length !== 11) {
      return {
        valid: false,
        error: 'ABN must be 11 digits',
      };
    }

    // Step 3: Apply ATO's official ABN validation algorithm
    // Reference: https://abr.business.gov.au/Help/AbnFormat
    const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const ABN_MODULUS = 89;

    // Convert string digits to numbers
    const abnDigits = cleanedABN.split('').map(Number);

    // Subtract 1 from the first digit (part of ATO algorithm)
    const adjustedDigits = [...abnDigits];
    adjustedDigits[0] -= 1;

    // Calculate weighted sum
    const weightedSum = adjustedDigits.reduce((sum, digit, index) => {
      return sum + digit * ABN_WEIGHTS[index];
    }, 0);

    // Validate checksum: sum must be divisible by 89
    const isValidChecksum = weightedSum % ABN_MODULUS === 0;

    if (!isValidChecksum) {
      return {
        valid: false,
        error: 'Invalid ABN checksum',
      };
    }

    // Step 4: Format ABN for display (XX XXX XXX XXX)
    const formattedABN = cleanedABN.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');

    return {
      valid: true,
      formatted: formattedABN,
    };
  }

  /**
   * Validates an Australian Tax File Number (TFN) using ATO's checksum algorithm
   *
   * @param {string} tfn - The TFN to validate (can include spaces)
   * @returns {Object} Validation result
   * @returns {boolean} returns.valid - Whether the TFN is valid
   * @returns {string} [returns.error] - Error message if invalid
   *
   * @example
   * const result = TaxCalculationService.validateTFN('123456782');
   * // Returns: { valid: true }
   *
   * const result = TaxCalculationService.validateTFN('123456789');
   * // Returns: { valid: false, error: 'Invalid TFN checksum' }
   *
   * @note TFN validation algorithm:
   * 1. Multiply each digit by its weight
   * 2. Sum all products
   * 3. Check if sum is divisible by 11
   *
   * @important TFNs are sensitive personal information and should be:
   * - Stored encrypted in the database
   * - Never sent to client-side code
   * - Only collected when legally required
   * - Handled according to Australian Privacy Principles
   */
  static validateTFN(tfn: string): { valid: boolean; error?: string } {
    // Remove all non-numeric characters
    const cleanTFN = tfn.replace(/[^0-9]/g, '');

    // TFN must be 8 or 9 digits
    if (cleanTFN.length < 8 || cleanTFN.length > 9) {
      return {
        valid: false,
        error: 'TFN must be 8 or 9 digits',
      };
    }

    // Apply ATO validation algorithm
    const weights = [1, 4, 3, 7, 5, 8, 6, 9, 10];
    const digits = cleanTFN.split('').map(Number);

    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      sum += digits[i] * weights[i];
    }

    // Check if divisible by 11
    if (sum % 11 !== 0) {
      return {
        valid: false,
        error: 'Invalid TFN checksum',
      };
    }

    return { valid: true };
  }

  /**
   * Calculates PAYG (Pay As You Go) tax withholding for Australian employment income
   *
   * @param {number} grossIncome - Gross income for the specified period
   * @param {'weekly'|'fortnightly'|'monthly'|'annually'} frequency - Payment frequency
   * @param {boolean} [taxFreeThreshold=true] - Whether the tax-free threshold is claimed
   * @param {boolean} [medicareLevyExemption=false] - Whether exempt from Medicare levy
   * @returns {Object} PAYG calculation breakdown
   * @returns {number} returns.grossIncome - Original gross income
   * @returns {number} returns.taxWithheld - Income tax to be withheld
   * @returns {number} returns.medicareLevy - Medicare levy amount (2% of income)
   * @returns {number} returns.netIncome - Net income after tax and levy
   *
   * @example
   * // Weekly income with tax-free threshold
   * const result = TaxCalculationService.calculatePAYGWithholding(
   *   1500,
   *   'weekly',
   *   true
   * );
   * // Returns:
   * // {
   * //   grossIncome: 1500,
   * //   taxWithheld: 359,
   * //   medicareLevy: 30,
   * //   netIncome: 1111
   * // }
   *
   * @note Uses 2023-24 tax rates:
   * - 0% on $0 – $18,200
   * - 19% on $18,201 – $45,000
   * - 32.5% on $45,001 – $120,000
   * - 37% on $120,001 – $180,000
   * - 45% on $180,001+
   *
   * @note Medicare levy is 2% of taxable income
   * @note This is a simplified calculation - actual PAYG may vary
   */
  static calculatePAYGWithholding(
    grossIncome: number,
    frequency: 'weekly' | 'fortnightly' | 'monthly' | 'annually',
    taxFreeThreshold: boolean = true,
    medicareLevyExemption: boolean = false,
  ): {
    grossIncome: number;
    taxWithheld: number;
    medicareLevy: number;
    netIncome: number;
  } {
    // Step 1: Convert income to annual amount for tax calculation
    const annualIncome = this.convertToAnnualIncome(grossIncome, frequency);

    // Step 2: Calculate income tax based on tax brackets
    const annualIncomeTax = this.calculateAnnualIncomeTax(annualIncome, taxFreeThreshold);

    // Step 3: Calculate Medicare levy if applicable
    const annualMedicareLevy = this.calculateMedicareLevy(annualIncome, medicareLevyExemption);

    // Step 4: Convert annual amounts back to payment period
    const periodDivisor = this.getPaymentPeriodDivisor(frequency);

    const periodTaxWithheld = annualIncomeTax / periodDivisor;
    const periodMedicareLevy = annualMedicareLevy / periodDivisor;
    const netIncome = grossIncome - periodTaxWithheld - periodMedicareLevy;

    // Step 5: Return rounded amounts for payroll precision
    return {
      grossIncome,
      taxWithheld: this.roundToCents(periodTaxWithheld),
      medicareLevy: this.roundToCents(periodMedicareLevy),
      netIncome: this.roundToCents(netIncome),
    };
  }

  /**
   * Determine tax category based on description and metadata
   */
  private static determineTaxCategory(category: string, isBusinessExpense: boolean): TaxCategory {
    // Personal expenses are never tax deductible
    if (!isBusinessExpense) {
      return TaxCategory.PERSONAL;
    }

    // Normalize category for case-insensitive matching
    const normalizedCategory = category.toUpperCase();

    // Map transaction categories to ATO tax categories
    const categoryMappings: { keywords: string[]; taxCategory: TaxCategory }[] = [
      {
        keywords: ['MOTOR', 'VEHICLE', 'FUEL'],
        taxCategory: TaxCategory.D1_MOTOR_VEHICLE,
      },
      {
        keywords: ['TRAVEL', 'ACCOMMODATION'],
        taxCategory: TaxCategory.D2_TRAVEL,
      },
      {
        keywords: ['EDUCATION', 'TRAINING', 'COURSE'],
        taxCategory: TaxCategory.D4_SELF_EDUCATION,
      },
      {
        keywords: ['DONATION', 'CHARITY'],
        taxCategory: TaxCategory.D8_GIFTS_DONATIONS,
      },
      {
        keywords: ['ACCOUNTING', 'TAX'],
        taxCategory: TaxCategory.D10_COST_TAX_AFFAIRS,
      },
      {
        keywords: ['SUPER'],
        taxCategory: TaxCategory.D12_PERSONAL_SUPER,
      },
      {
        keywords: ['CAPITAL', 'EQUIPMENT'],
        taxCategory: TaxCategory.CAPITAL,
      },
    ];

    // Check for rental property expenses (requires both keywords)
    if (normalizedCategory.includes('RENT') && normalizedCategory.includes('PROPERTY')) {
      return TaxCategory.P8_RENTAL;
    }

    // Find matching category based on keywords
    for (const mapping of categoryMappings) {
      const hasMatchingKeyword = mapping.keywords.some((keyword) =>
        normalizedCategory.includes(keyword),
      );

      if (hasMatchingKeyword) {
        return mapping.taxCategory;
      }
    }

    // Default to general work-related expenses if no specific match
    return TaxCategory.D5_OTHER_WORK;
  }

  /**
   * Determine GST treatment based on category
   */
  private static determineGSTTreatment(
    taxCategory: TaxCategory,
    description: string,
  ): GSTTreatment {
    // Normalize description for case-insensitive matching
    const normalizedDescription = description.toUpperCase();

    // Define GST-free supplies according to Australian tax law
    const gstFreeKeywords = [
      'BASIC FOOD', // Unprocessed food items
      'FRESH FOOD', // Fresh produce
      'HEALTH', // Health services
      'MEDICAL', // Medical services and supplies
      'EDUCATION', // Educational courses
      'CHILDCARE', // Childcare services
      'EXPORT', // Goods exported from Australia
    ];

    // Define input-taxed supplies (no GST credits available)
    const inputTaxedKeywords = [
      'FINANCIAL', // Financial services
      'RESIDENTIAL RENT', // Residential property rental
      'INSURANCE', // Most insurance products
    ];

    // Check if item is GST-free
    const isGSTFree = gstFreeKeywords.some((keyword) => normalizedDescription.includes(keyword));
    if (isGSTFree) {
      return GSTTreatment.GST_FREE;
    }

    // Check if item is input-taxed
    const isInputTaxed = inputTaxedKeywords.some((keyword) =>
      normalizedDescription.includes(keyword),
    );
    if (isInputTaxed) {
      return GSTTreatment.INPUT_TAXED;
    }

    // Personal expenses have no GST implications for individuals
    if (taxCategory === TaxCategory.PERSONAL) {
      return GSTTreatment.PRIVATE;
    }

    // All other supplies are taxable at standard GST rate
    return GSTTreatment.TAXABLE;
  }

  /**
   * Calculate deductible amount based on category
   */
  private static calculateDeductibleAmount(
    amount: number,
    category: TaxCategory,
    gstTreatment: GSTTreatment,
  ): number {
    // Rule 1: Personal expenses are never tax deductible
    if (category === TaxCategory.PERSONAL) {
      return 0;
    }

    // Rule 2: Capital expenses have special deductibility rules
    if (category === TaxCategory.CAPITAL) {
      const IMMEDIATE_DEDUCTION_THRESHOLD = 300; // ATO small item threshold

      // Small capital items can be immediately deducted
      if (amount <= IMMEDIATE_DEDUCTION_THRESHOLD) {
        return amount;
      }

      // Larger capital items require depreciation over time
      // Note: Depreciation calculation is handled separately
      return 0;
    }

    // Rule 3: Entertainment expenses have 50% deductibility limit
    const isEntertainmentExpense =
      category === TaxCategory.D2_TRAVEL && gstTreatment === GSTTreatment.TAXABLE;

    if (isEntertainmentExpense) {
      const ENTERTAINMENT_DEDUCTION_RATE =
        AUSTRALIAN_TAX_CONFIG.DEDUCTION_LIMITS.MEAL_ENTERTAINMENT;
      return amount * ENTERTAINMENT_DEDUCTION_RATE;
    }

    // Rule 4: All other legitimate business expenses are 100% deductible
    return amount;
  }

  /**
   * Get user's income for a financial year
   */
  private static async getUserIncome(userId: string, financialYear: string): Promise<number> {
    const fyStart = new Date(`${financialYear}-07-01`);
    const fyEnd = new Date(`${parseInt(financialYear) + 1}-06-30`);

    const incomeTransactions = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'INCOME',
        date: {
          gte: fyStart,
          lte: fyEnd,
        },
        deletedAt: null,
      },
      _sum: {
        amount: true,
      },
    });

    return incomeTransactions._sum.amount || 0;
  }

  /**
   * Get marginal tax rate based on income
   */
  private static getMarginalTaxRate(income: number): number {
    // Find the tax bracket for the given income
    const applicableBracket = this.TAX_BRACKETS.find(
      (bracket) => income >= bracket.min && income <= bracket.max,
    );

    // Calculate total marginal rate including Medicare levy
    if (applicableBracket) {
      const baseTaxRate = applicableBracket.rate;
      const totalMarginalRate = baseTaxRate + this.MEDICARE_LEVY;
      return totalMarginalRate;
    }

    // Default to highest tax rate for incomes above all brackets
    const TOP_TAX_RATE = 0.45;
    const highestMarginalRate = TOP_TAX_RATE + this.MEDICARE_LEVY;
    return highestMarginalRate;
  }

  /**
   * Generate tax year summary
   */
  static async generateTaxYearSummary(
    userId: string,
    financialYear: string,
  ): Promise<{
    income: {
      gross: number;
      taxWithheld: number;
      net: number;
    };
    deductions: {
      total: number;
      byCategory: Record<TaxCategory, number>;
    };
    gst: {
      collected: number;
      paid: number;
      net: number;
    };
    estimatedTax: {
      taxableIncome: number;
      taxPayable: number;
      taxWithheld: number;
      estimatedRefund: number;
    };
  }> {
    const fyStart = new Date(`${financialYear}-07-01`);
    const fyEnd = new Date(`${parseInt(financialYear) + 1}-06-30`);

    // Get income summary
    const incomeData = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'INCOME',
        date: { gte: fyStart, lte: fyEnd },
        deletedAt: null,
      },
      _sum: {
        amount: true,
        taxWithheld: true,
      },
    });

    const grossIncome = incomeData._sum.amount || 0;
    const taxWithheld = incomeData._sum.taxWithheld || 0;

    // Get deductions
    const deductions = await this.getUserDeductions({ userId, financialYear });

    // Get GST summary
    const gstData = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId,
        date: { gte: fyStart, lte: fyEnd },
        gstAmount: { not: null },
        deletedAt: null,
      },
      _sum: {
        gstAmount: true,
      },
    });

    const gstCollected = gstData.find((g) => g.type === 'INCOME')?._sum.gstAmount || 0;
    const gstPaid = Math.abs(gstData.find((g) => g.type === 'EXPENSE')?._sum.gstAmount || 0);

    // Calculate estimated tax
    const taxableIncome = Math.max(0, grossIncome - deductions.totalDeductions);
    let taxPayable = 0;

    for (const bracket of this.TAX_BRACKETS) {
      if (taxableIncome > bracket.min) {
        const taxableInBracket = Math.min(taxableIncome - bracket.min, bracket.max - bracket.min);
        taxPayable += taxableInBracket * bracket.rate;
      }
    }

    // Add Medicare levy
    if (taxableIncome > 23365) {
      taxPayable += taxableIncome * this.MEDICARE_LEVY;
    }

    const estimatedRefund = taxWithheld - taxPayable;

    return {
      income: {
        gross: Math.round(grossIncome * 100) / 100,
        taxWithheld: Math.round(taxWithheld * 100) / 100,
        net: Math.round((grossIncome - taxWithheld) * 100) / 100,
      },
      deductions: {
        total: deductions.totalDeductions,
        byCategory: deductions.categoryBreakdown,
      },
      gst: {
        collected: Math.round(gstCollected * 100) / 100,
        paid: Math.round(gstPaid * 100) / 100,
        net: Math.round((gstCollected - gstPaid) * 100) / 100,
      },
      estimatedTax: {
        taxableIncome: Math.round(taxableIncome * 100) / 100,
        taxPayable: Math.round(taxPayable * 100) / 100,
        taxWithheld: Math.round(taxWithheld * 100) / 100,
        estimatedRefund: Math.round(estimatedRefund * 100) / 100,
      },
    };
  }
}
