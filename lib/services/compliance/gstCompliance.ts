import prisma from '../../prisma';
// import { z } from 'zod';
// import { AUSTRALIAN_TAX_CONFIG } from '../../ai/config';
import { logger } from '@/lib/logger';

// GST Treatment enum (matching Prisma schema)
export enum GSTTreatment {
  TAXABLE_SUPPLY = 'TAXABLE_SUPPLY',
  GST_FREE = 'GST_FREE',
  INPUT_TAXED = 'INPUT_TAXED',
  OUT_OF_SCOPE = 'OUT_OF_SCOPE',
}

export interface GSTCalculation {
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
  gstRate: number;
  treatment: GSTTreatment;
}

export interface BASReportData {
  taxPeriod: string;
  totalSales: number;
  gstOnSales: number;
  totalPurchases: number;
  gstOnPurchases: number;
  netGST: number;
  exportSales: number;
  capitalPurchases: number;
}

export class GSTComplianceService {
  private static readonly DEFAULT_GST_RATE = 10; // 10% GST
  private static readonly GST_FREE_CATEGORIES = [
    'BASIC_FOOD',
    'HEALTH',
    'EDUCATION',
    'CHILDCARE',
    'MEDICAL',
    'EXPORTS',
  ];
  private static readonly INPUT_TAXED_CATEGORIES = [
    'FINANCIAL_SUPPLIES',
    'RESIDENTIAL_RENT',
    'RESIDENTIAL_PREMISES',
  ];

  /**
   * Calculate GST for a transaction with validation
   */
  static calculateGST(
    amount: number,
    category: string,
    isGSTRegistered: boolean = true,
  ): GSTCalculation {
    // Validate input
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (!category || typeof category !== 'string') {
      throw new Error('Category is required');
    }
    // Determine GST treatment based on category
    const treatment = this.determineGSTTreatment(category);

    let gstAmount = 0;
    let totalAmount = amount;
    let gstRate = 0;

    switch (treatment) {
      case GSTTreatment.TAXABLE_SUPPLY:
        if (isGSTRegistered) {
          gstRate = this.DEFAULT_GST_RATE;
          // GST is included in the amount (tax inclusive)
          gstAmount = amount * (gstRate / (100 + gstRate));
          // Base amount is total minus GST
          const baseAmount = amount - gstAmount;
          return {
            baseAmount,
            gstAmount,
            totalAmount: amount,
            gstRate,
            treatment,
          };
        }
        break;

      case GSTTreatment.GST_FREE:
      case GSTTreatment.INPUT_TAXED:
      case GSTTreatment.OUT_OF_SCOPE:
        // No GST applicable
        return {
          baseAmount: amount,
          gstAmount: 0,
          totalAmount: amount,
          gstRate: 0,
          treatment,
        };
    }

    return {
      baseAmount: amount,
      gstAmount,
      totalAmount,
      gstRate,
      treatment,
    };
  }

  /**
   * Determine GST treatment based on category
   */
  private static determineGSTTreatment(category: string): GSTTreatment {
    const upperCategory = category.toUpperCase();

    if (this.GST_FREE_CATEGORIES.some((cat) => upperCategory.includes(cat))) {
      return GSTTreatment.GST_FREE;
    }

    if (this.INPUT_TAXED_CATEGORIES.some((cat) => upperCategory.includes(cat))) {
      return GSTTreatment.INPUT_TAXED;
    }

    // Check for international/export transactions
    if (upperCategory.includes('EXPORT') || upperCategory.includes('INTERNATIONAL')) {
      return GSTTreatment.GST_FREE;
    }

    // Default to taxable supply
    return GSTTreatment.TAXABLE_SUPPLY;
  }

  /**
   * Create GST transaction details with user isolation
   */
  static async createGSTDetails(
    userId: string,
    transactionId: string,
    amount: number,
    category: string,
    supplierABN?: string,
    supplierName?: string,
    invoiceId?: string,
  ): Promise<string> {
    // Verify transaction belongs to user
    const transaction = await prisma.bank_transactions.findFirst({
      where: {
        id: transactionId,
        bank_account: {
          basiq_user: {
            user_id: userId,
          },
        },
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found or access denied');
    }

    const gstCalc = this.calculateGST(amount, category);
    const taxPeriod = this.getCurrentTaxPeriod();

    const gstDetails = await prisma.gSTTransactionDetail.create({
      data: {
        transactionId,
        invoiceId,
        baseAmount: gstCalc.baseAmount,
        gstRate: gstCalc.gstRate,
        gstAmount: gstCalc.gstAmount,
        totalAmount: gstCalc.totalAmount,
        taxCategory: category,
        gstTreatment: gstCalc.treatment,
        inputTaxCredit: gstCalc.treatment === GSTTreatment.TAXABLE_SUPPLY,
        supplierABN,
        supplierName,
        isGSTRegistered: true,
        taxPeriod,
        basReportingCode: this.mapToBASCode(category),
      },
    });

    return gstDetails.id;
  }

  /**
   * Validate ABN format
   */
  static validateABN(abn: string): { valid: boolean; formatted?: string } {
    // Remove spaces and non-numeric characters
    const cleanABN = abn.replace(/\s/g, '').replace(/[^0-9]/g, '');

    // ABN must be 11 digits
    if (cleanABN.length !== 11) {
      return { valid: false };
    }

    // Validate using ATO algorithm
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    let sum = 0;

    // Subtract 1 from first digit
    const digits = cleanABN.split('').map(Number);
    digits[0] -= 1;

    // Calculate weighted sum
    for (let i = 0; i < 11; i++) {
      sum += digits[i] * weights[i];
    }

    // Check if divisible by 89
    const isValid = sum % 89 === 0;

    if (isValid) {
      // Format ABN: XX XXX XXX XXX
      const formatted = cleanABN.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
      return { valid: true, formatted };
    }

    return { valid: false };
  }

  /**
   * Generate BAS report for a tax period with proper user isolation
   */
  static async generateBASReport(userId: string, taxPeriod: string): Promise<BASReportData> {
    // Validate tax period format
    if (!taxPeriod.match(/^\d{4}-(\d{2}|Q[1-4])$/)) {
      throw new Error('Invalid tax period format. Use YYYY-MM or YYYY-Q[1-4]');
    }

    // Get all transactions for the period with user isolation
    const transactions = await prisma.bank_transactions.findMany({
      where: {
        bank_account: {
          basiq_user: {
            user_id: userId,
          },
        },
        transaction_date: {
          gte: this.getTaxPeriodStart(taxPeriod),
          lte: this.getTaxPeriodEnd(taxPeriod),
        },
      },
      select: {
        id: true,
        amount: true,
        direction: true,
        category: true,
        gst_amount: true,
        tax_category: true,
        is_business_expense: true,
      },
    });

    // Calculate totals directly from transactions
    let totalSales = 0;
    let gstOnSales = 0;
    let totalPurchases = 0;
    let gstOnPurchases = 0;
    let exportSales = 0;
    let capitalPurchases = 0;

    for (const transaction of transactions) {
      const amount = Math.abs(Number(transaction.amount));
      const gstAmount = Math.abs(Number(transaction.gst_amount || 0));
      const category = transaction.category || '';

      // Determine GST treatment
      const gstTreatment = this.determineGSTTreatment(category);

      if (transaction.direction === 'credit') {
        // Income/Sales
        totalSales += amount;
        if (gstTreatment === GSTTreatment.TAXABLE_SUPPLY) {
          gstOnSales += gstAmount;
        } else if (
          gstTreatment === GSTTreatment.GST_FREE &&
          category.toUpperCase().includes('EXPORT')
        ) {
          exportSales += amount;
        }
      } else if (transaction.direction === 'debit') {
        // Expenses/Purchases
        totalPurchases += amount;
        if (transaction.is_business_expense && gstTreatment === GSTTreatment.TAXABLE_SUPPLY) {
          gstOnPurchases += gstAmount;
        }
        if (
          category.toUpperCase().includes('CAPITAL') ||
          category.toUpperCase().includes('EQUIPMENT')
        ) {
          capitalPurchases += amount;
        }
      }
    }

    const netGST = gstOnSales - gstOnPurchases;

    const report: BASReportData = {
      taxPeriod,
      totalSales,
      gstOnSales,
      totalPurchases,
      gstOnPurchases,
      netGST,
      exportSales,
      capitalPurchases,
    };

    // TODO: Implement proper audit logging for GST/BAS reports
    // For now, log to standard logger
    logger.info('BAS report generated', {
      userId,
      taxPeriod,
      reportSummary: {
        netGST: report.netGST,
        totalSales: report.totalSales,
        totalPurchases: report.totalPurchases,
      },
      timestamp: new Date().toISOString(),
    });

    return report;
  }

  /**
   * Generate tax invoice with validation
   */
  static async generateTaxInvoice(
    userId: string,
    invoiceId: string,
    customerName: string,
    customerEmail: string,
    customerABN: string | null,
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      gstTreatment: GSTTreatment;
    }>,
  ): Promise<{
    invoiceNumber: string;
    subtotal: number;
    gstAmount: number;
    total: number;
  }> {
    // Validate inputs
    if (!customerName || !customerEmail) {
      throw new Error('Customer name and email are required');
    }
    if (lineItems.length === 0) {
      throw new Error('At least one line item is required');
    }

    // Validate ABN if provided
    if (customerABN) {
      const abnValidation = this.validateABN(customerABN);
      if (!abnValidation.valid) {
        throw new Error(`Invalid customer ABN: ${abnValidation.formatted || customerABN}`);
      }
    }
    const invoiceNumber = this.generateInvoiceNumber();
    let subtotal = 0;
    let gstAmount = 0;

    // Calculate totals
    for (const item of lineItems) {
      const itemTotal = item.quantity * item.unitPrice;
      subtotal += itemTotal;

      if (item.gstTreatment === GSTTreatment.TAXABLE_SUPPLY) {
        const itemGST = itemTotal * (this.DEFAULT_GST_RATE / (100 + this.DEFAULT_GST_RATE));
        gstAmount += itemGST;
      }
    }

    const total = subtotal + gstAmount;

    // Create invoice record
    await prisma.invoice.create({
      data: {
        invoiceNumber,
        stripeInvoiceId: invoiceId,
        customerName,
        customerEmail,
        customerABN,
        subtotal: Math.round(subtotal * 100), // Store in cents
        gstAmount: Math.round(gstAmount * 100),
        total: Math.round(total * 100),
        status: 'draft',
        invoiceDate: new Date(),
        lineItems: {
          create: lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: Math.round(item.unitPrice * 100),
            totalPrice: Math.round(item.quantity * item.unitPrice * 100),
            gstAmount:
              item.gstTreatment === GSTTreatment.TAXABLE_SUPPLY
                ? Math.round(
                    item.quantity *
                      item.unitPrice *
                      (this.DEFAULT_GST_RATE / (100 + this.DEFAULT_GST_RATE)) *
                      100,
                  )
                : 0,
          })),
        },
      },
    });

    return {
      invoiceNumber,
      subtotal,
      gstAmount,
      total,
    };
  }

  /**
   * Validate GST registration status
   */
  static async validateGSTRegistration(abn: string): Promise<{
    registered: boolean;
    registrationDate?: Date;
  }> {
    // In production, this would check with ATO's ABN Lookup API
    // For now, we'll do a basic validation
    const abnValidation = this.validateABN(abn);

    if (!abnValidation.valid) {
      return { registered: false };
    }

    // Simulate API response
    return {
      registered: true,
      registrationDate: new Date('2020-07-01'), // Placeholder
    };
  }

  /**
   * Get current tax period (monthly or quarterly)
   */
  private static getCurrentTaxPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Quarterly BAS periods: Mar, Jun, Sep, Dec
    const quarter = Math.ceil(month / 3);
    // const quarterEndMonth = quarter * 3;

    // For monthly, return YYYY-MM
    // For quarterly, return YYYY-Q[1-4]
    // Default to monthly for this implementation
    return `${year}-${month.toString().padStart(2, '0')}`;
  }

  /**
   * Get tax period start date
   */
  private static getTaxPeriodStart(taxPeriod: string): Date {
    const [year, period] = taxPeriod.split('-');

    if (period.startsWith('Q')) {
      // Quarterly period
      const quarter = parseInt(period.substring(1));
      const startMonth = (quarter - 1) * 3 + 1;
      return new Date(parseInt(year), startMonth - 1, 1);
    } else {
      // Monthly period
      return new Date(parseInt(year), parseInt(period) - 1, 1);
    }
  }

  /**
   * Get tax period end date
   */
  private static getTaxPeriodEnd(taxPeriod: string): Date {
    const [year, period] = taxPeriod.split('-');

    if (period.startsWith('Q')) {
      // Quarterly period
      const quarter = parseInt(period.substring(1));
      const endMonth = quarter * 3;
      const date = new Date(parseInt(year), endMonth, 0); // Last day of month
      return date;
    } else {
      // Monthly period
      const date = new Date(parseInt(year), parseInt(period), 0); // Last day of month
      return date;
    }
  }

  /**
   * Map category to BAS reporting code
   */
  private static mapToBASCode(category: string): string {
    const categoryUpper = category.toUpperCase();

    if (categoryUpper.includes('CAPITAL')) return 'G10';
    if (categoryUpper.includes('EXPORT')) return 'G2';
    if (categoryUpper.includes('GST_FREE')) return 'G3';
    if (categoryUpper.includes('INPUT_TAXED')) return 'G4';

    return 'G1'; // Default: Total sales
  }

  /**
   * Generate invoice number
   */
  private static generateInvoiceNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `INV-${timestamp}-${random}`;
  }

  /**
   * Check for GST compliance issues with enhanced validation
   */
  static async checkCompliance(userId: string): Promise<{
    compliant: boolean;
    issues: string[];
    recommendations: string[];
    gstRegistrationRequired: boolean;
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if user has ABN
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        abn: true,
        businessName: true,
      },
    });

    if (!user?.abn) {
      issues.push('No ABN registered');
      recommendations.push('Register for an ABN if conducting business');
    } else {
      // Validate ABN
      const abnValidation = this.validateABN(user.abn);
      if (!abnValidation.valid) {
        issues.push('Invalid ABN format');
        recommendations.push('Update ABN with correct format');
      }
    }

    // Check for missing GST details in recent business transactions
    const recentTransactions = await prisma.bank_transactions.findMany({
      where: {
        bank_account: {
          basiq_user: {
            user_id: userId,
          },
        },
        is_business_expense: true,
        transaction_date: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      select: {
        id: true,
        amount: true,
        gst_amount: true,
        category: true,
      },
    });

    // Count transactions missing GST information
    const missingGSTDetails = recentTransactions.filter(
      (t) => t.gst_amount === null || Number(t.gst_amount) === 0,
    ).length;

    if (missingGSTDetails > 0) {
      issues.push(`${missingGSTDetails} business transactions missing GST details`);
      recommendations.push('Review and update GST information for all business transactions');
    }

    // Check GST registration threshold (AUD $75,000 turnover)
    const annualTurnover = await this.calculateAnnualTurnover(userId);
    const gstRegistrationRequired = annualTurnover >= 75000;

    if (gstRegistrationRequired && !user?.abn) {
      issues.push('GST registration required - annual turnover exceeds $75,000');
      recommendations.push('Register for GST immediately to comply with ATO requirements');
    }

    // Check for tax invoice compliance
    if (user?.abn && gstRegistrationRequired) {
      const highValueTransactions = recentTransactions.filter(
        (t) => Math.abs(Number(t.amount)) > 82.5,
      );

      if (highValueTransactions.length > 0) {
        recommendations.push('Ensure tax invoices are obtained for all purchases over $82.50');
      }
    }

    return {
      compliant: issues.length === 0,
      issues,
      recommendations,
      gstRegistrationRequired,
    };
  }

  /**
   * Calculate annual turnover for GST registration threshold
   */
  private static async calculateAnnualTurnover(userId: string): Promise<number> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const turnover = await prisma.bank_transactions.aggregate({
      where: {
        bank_account: {
          basiq_user: {
            user_id: userId,
          },
        },
        direction: 'credit',
        is_business_expense: false, // Business income
        transaction_date: {
          gte: oneYearAgo,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return Number(turnover._sum.amount || 0);
  }
}
