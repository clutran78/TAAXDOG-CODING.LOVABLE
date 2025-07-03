import { prisma } from '../prisma';

/**
 * Australian Tax Office (ATO) compliance utilities
 */
export class ATOCompliance {
  // ATO tax categories for individuals
  static readonly INDIVIDUAL_TAX_CATEGORIES = {
    D1: { code: 'D1', name: 'Work-related car expenses', gstApplicable: true },
    D2: { code: 'D2', name: 'Work-related travel expenses', gstApplicable: true },
    D3: { code: 'D3', name: 'Work-related clothing, laundry and dry-cleaning expenses', gstApplicable: true },
    D4: { code: 'D4', name: 'Work-related self-education expenses', gstApplicable: true },
    D5: { code: 'D5', name: 'Other work-related expenses', gstApplicable: true },
    D6: { code: 'D6', name: 'Low-value pool deduction', gstApplicable: true },
    D7: { code: 'D7', name: 'Interest deductions', gstApplicable: false },
    D8: { code: 'D8', name: 'Dividend deductions', gstApplicable: false },
    D9: { code: 'D9', name: 'Gifts or donations', gstApplicable: false },
    D10: { code: 'D10', name: 'Cost of managing tax affairs', gstApplicable: true },
  };

  // Business expense categories
  static readonly BUSINESS_EXPENSE_CATEGORIES = {
    'motor-vehicle': { name: 'Motor vehicle expenses', gstClaimable: true },
    'travel': { name: 'Travel expenses', gstClaimable: true },
    'advertising': { name: 'Advertising and sponsorship', gstClaimable: true },
    'bank-fees': { name: 'Bank fees and charges', gstClaimable: false },
    'insurance': { name: 'Insurance', gstClaimable: true },
    'professional-fees': { name: 'Professional fees', gstClaimable: true },
    'rent': { name: 'Rent on business premises', gstClaimable: true },
    'repairs': { name: 'Repairs and maintenance', gstClaimable: true },
    'phone-internet': { name: 'Phone and internet', gstClaimable: true },
    'utilities': { name: 'Electricity, gas, water', gstClaimable: true },
    'depreciation': { name: 'Depreciation on equipment', gstClaimable: false },
    'super': { name: 'Superannuation contributions', gstClaimable: false },
  };

  /**
   * Validate Australian Business Number (ABN)
   */
  static validateABN(abn: string): boolean {
    // Remove spaces and validate format
    const cleanABN = abn.replace(/\s/g, '');
    
    if (!/^\d{11}$/.test(cleanABN)) {
      return false;
    }

    // ABN checksum validation
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const digits = cleanABN.split('').map(Number);
    
    // Subtract 1 from the first digit
    digits[0] -= 1;
    
    // Calculate weighted sum
    const sum = digits.reduce((acc, digit, index) => acc + digit * weights[index], 0);
    
    // Valid if divisible by 89
    return sum % 89 === 0;
  }

  /**
   * Calculate GST from total amount
   */
  static calculateGST(totalAmount: number, isGSTInclusive: boolean = true): {
    gstAmount: number;
    exGSTAmount: number;
    totalAmount: number;
  } {
    const GST_RATE = 0.10; // 10% GST

    if (isGSTInclusive) {
      // GST is included in the total
      const gstAmount = totalAmount / 11; // totalAmount / (1 + GST_RATE)
      const exGSTAmount = totalAmount - gstAmount;
      
      return {
        gstAmount: Math.round(gstAmount * 100) / 100,
        exGSTAmount: Math.round(exGSTAmount * 100) / 100,
        totalAmount,
      };
    } else {
      // GST needs to be added
      const gstAmount = totalAmount * GST_RATE;
      const totalWithGST = totalAmount + gstAmount;
      
      return {
        gstAmount: Math.round(gstAmount * 100) / 100,
        exGSTAmount: totalAmount,
        totalAmount: Math.round(totalWithGST * 100) / 100,
      };
    }
  }

  /**
   * Validate tax invoice requirements
   */
  static validateTaxInvoice(invoice: {
    supplierABN?: string;
    totalAmount: number;
    gstAmount?: number;
    invoiceNumber?: string;
    date: Date;
    supplierName: string;
  }): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Tax invoices over $82.50 (inc GST) must include ABN
    if (invoice.totalAmount > 82.50) {
      if (!invoice.supplierABN) {
        errors.push('Tax invoices over $82.50 must include supplier ABN');
      } else if (!this.validateABN(invoice.supplierABN)) {
        errors.push('Invalid ABN format');
      }
      
      if (!invoice.invoiceNumber) {
        errors.push('Tax invoices over $82.50 must include an invoice number');
      }
    }

    // All tax invoices must show GST amount
    if (!invoice.gstAmount && invoice.gstAmount !== 0) {
      errors.push('Tax invoice must show GST amount');
    }

    // Must have supplier details
    if (!invoice.supplierName) {
      errors.push('Supplier name is required');
    }

    // Must have date
    if (!invoice.date) {
      errors.push('Invoice date is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get tax year for a given date (July 1 - June 30)
   */
  static getTaxYear(date: Date = new Date()): {
    year: number;
    startDate: Date;
    endDate: Date;
  } {
    const month = date.getMonth();
    const year = date.getFullYear();
    
    // Tax year runs from July 1 to June 30
    const taxYear = month >= 6 ? year : year - 1; // Month is 0-indexed, so July = 6
    
    return {
      year: taxYear,
      startDate: new Date(taxYear, 6, 1), // July 1
      endDate: new Date(taxYear + 1, 5, 30, 23, 59, 59, 999), // June 30
    };
  }

  /**
   * Calculate PAYG withholding
   */
  static calculatePAYGWithholding(
    grossPay: number,
    payFrequency: 'weekly' | 'fortnightly' | 'monthly',
    taxFreeThreshold: boolean = true,
    medicareLevyExemption: boolean = false
  ): number {
    // Simplified PAYG calculation - in production, use ATO tax tables
    const annualizedIncome = this.annualizeIncome(grossPay, payFrequency);
    
    // 2023-24 tax rates
    let tax = 0;
    
    if (!taxFreeThreshold || annualizedIncome <= 18200) {
      // No tax on first $18,200 if claiming threshold
      tax = 0;
    } else if (annualizedIncome <= 45000) {
      tax = (annualizedIncome - 18200) * 0.19;
    } else if (annualizedIncome <= 120000) {
      tax = 5092 + (annualizedIncome - 45000) * 0.325;
    } else if (annualizedIncome <= 180000) {
      tax = 29467 + (annualizedIncome - 120000) * 0.37;
    } else {
      tax = 51667 + (annualizedIncome - 180000) * 0.45;
    }

    // Add Medicare Levy (2%) if not exempt
    if (!medicareLevyExemption && annualizedIncome > 23365) {
      tax += annualizedIncome * 0.02;
    }

    // Convert back to pay period
    return Math.round(this.deannualizeAmount(tax, payFrequency));
  }

  /**
   * Convert amount to annual equivalent
   */
  private static annualizeIncome(
    amount: number,
    frequency: 'weekly' | 'fortnightly' | 'monthly'
  ): number {
    const multipliers = {
      weekly: 52,
      fortnightly: 26,
      monthly: 12,
    };
    
    return amount * multipliers[frequency];
  }

  /**
   * Convert annual amount to pay period
   */
  private static deannualizeAmount(
    annualAmount: number,
    frequency: 'weekly' | 'fortnightly' | 'monthly'
  ): number {
    const divisors = {
      weekly: 52,
      fortnightly: 26,
      monthly: 12,
    };
    
    return annualAmount / divisors[frequency];
  }

  /**
   * Validate BAS (Business Activity Statement) requirements
   */
  static validateBASRequirements(
    businessData: {
      gstRegistered: boolean;
      annualTurnover: number;
      reportingPeriod: 'monthly' | 'quarterly';
    }
  ): {
    basRequired: boolean;
    frequency: 'monthly' | 'quarterly' | 'annual';
    gstRequired: boolean;
  } {
    const { gstRegistered, annualTurnover, reportingPeriod } = businessData;
    
    // GST registration required if turnover >= $75,000
    const gstRequired = annualTurnover >= 75000;
    
    // BAS frequency based on turnover
    let frequency: 'monthly' | 'quarterly' | 'annual';
    if (annualTurnover >= 20000000) {
      frequency = 'monthly'; // Mandatory monthly for large businesses
    } else if (reportingPeriod === 'monthly') {
      frequency = 'monthly'; // Voluntary monthly
    } else {
      frequency = 'quarterly'; // Default quarterly
    }
    
    return {
      basRequired: gstRegistered,
      frequency,
      gstRequired,
    };
  }

  /**
   * Calculate superannuation guarantee
   */
  static calculateSuperannuation(
    ordinaryTimeEarnings: number,
    superRate: number = 11.0 // Current rate as of 2023-24
  ): {
    superAmount: number;
    totalCost: number;
  } {
    const superAmount = Math.round((ordinaryTimeEarnings * superRate / 100) * 100) / 100;
    const totalCost = ordinaryTimeEarnings + superAmount;
    
    return {
      superAmount,
      totalCost,
    };
  }

  /**
   * Categorize expense for ATO compliance
   */
  static categorizeExpense(
    description: string,
    amount: number,
    isBusinessExpense: boolean
  ): {
    category: string;
    code?: string;
    gstClaimable: boolean;
    deductible: boolean;
    notes?: string;
  } {
    const lowerDesc = description.toLowerCase();
    
    if (isBusinessExpense) {
      // Business expense categorization
      for (const [key, category] of Object.entries(this.BUSINESS_EXPENSE_CATEGORIES)) {
        if (lowerDesc.includes(key.replace('-', ' '))) {
          return {
            category: category.name,
            code: key,
            gstClaimable: category.gstClaimable,
            deductible: true,
          };
        }
      }
    } else {
      // Individual expense categorization
      if (lowerDesc.includes('car') || lowerDesc.includes('vehicle') || lowerDesc.includes('fuel')) {
        return {
          category: this.INDIVIDUAL_TAX_CATEGORIES.D1.name,
          code: 'D1',
          gstClaimable: true,
          deductible: true,
          notes: 'Keep logbook or use cents per km method',
        };
      }
      
      if (lowerDesc.includes('flight') || lowerDesc.includes('hotel') || lowerDesc.includes('accommodation')) {
        return {
          category: this.INDIVIDUAL_TAX_CATEGORIES.D2.name,
          code: 'D2',
          gstClaimable: true,
          deductible: true,
          notes: 'Must be for work purposes, not regular commute',
        };
      }
      
      if (lowerDesc.includes('course') || lowerDesc.includes('training') || lowerDesc.includes('education')) {
        return {
          category: this.INDIVIDUAL_TAX_CATEGORIES.D4.name,
          code: 'D4',
          gstClaimable: true,
          deductible: true,
          notes: 'Must maintain or improve skills for current work',
        };
      }
    }
    
    // Default to other expenses
    return {
      category: isBusinessExpense ? 'Other business expenses' : this.INDIVIDUAL_TAX_CATEGORIES.D5.name,
      code: isBusinessExpense ? 'other' : 'D5',
      gstClaimable: true,
      deductible: true,
    };
  }

  /**
   * Generate ATO-compliant tax summary
   */
  static async generateTaxSummary(
    userId: string,
    taxYear: number
  ): Promise<{
    income: Record<string, number>;
    deductions: Record<string, number>;
    taxableIncome: number;
    estimatedTax: number;
    gstCollected: number;
    gstPaid: number;
  }> {
    const { startDate, endDate } = this.getTaxYear(new Date(`${taxYear}-07-01`));
    
    // Fetch transactions for tax year
    const transactions = await prisma.bank_transactions.findMany({
      where: {
        bank_account: {
          basiq_user: {
            user_id: userId
          }
        },
        transaction_date: { gte: startDate, lte: endDate },
      },
      include: { 
        bank_account: {
          include: {
            basiq_user: true
          }
        }
      },
    });
    
    // Calculate income (credit transactions)
    const income = transactions
      .filter(t => t.direction === 'credit')
      .reduce((acc, t) => {
        const category = t.category || 'Other Income';
        acc[category] = (acc[category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);
    
    // Calculate deductions (debit transactions that are business expenses)
    const deductions = transactions
      .filter(t => t.direction === 'debit' && t.is_business_expense)
      .reduce((acc, t) => {
        const category = t.tax_category || 'Other Deductions';
        acc[category] = (acc[category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);
    
    // Calculate GST
    const gstCollected = transactions
      .filter(t => t.direction === 'credit' && t.gst_amount)
      .reduce((sum, t) => sum + Number(t.gst_amount || 0), 0);
    
    const gstPaid = transactions
      .filter(t => t.direction === 'debit' && t.gst_amount)
      .reduce((sum, t) => sum + Number(t.gst_amount || 0), 0);
    
    // Calculate totals
    const totalIncome = Object.values(income).reduce((sum, amount) => sum + amount, 0);
    const totalDeductions = Object.values(deductions).reduce((sum, amount) => sum + amount, 0);
    const taxableIncome = Math.max(0, totalIncome - totalDeductions);
    
    // Estimate tax (simplified)
    const estimatedTax = this.calculatePAYGWithholding(
      taxableIncome,
      'monthly',
      true,
      false
    ) * 12;
    
    return {
      income,
      deductions,
      taxableIncome,
      estimatedTax,
      gstCollected,
      gstPaid,
    };
  }
}

// Export for use in other modules
export const atoCompliance = new ATOCompliance();