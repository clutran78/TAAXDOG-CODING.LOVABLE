import { v4 as uuidv4 } from 'uuid';

export const mockData = {
  users: {
    regular: {
      id: uuidv4(),
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      abn: null,
      businessName: null,
      gstRegistered: false,
    },
    admin: {
      id: uuidv4(),
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
      abn: null,
      businessName: null,
      gstRegistered: false,
    },
    business: {
      id: uuidv4(),
      email: 'business@example.com',
      name: 'Business User',
      role: 'USER',
      abn: '12345678901',
      businessName: 'Test Business Pty Ltd',
      gstRegistered: true,
    },
    suspended: {
      id: uuidv4(),
      email: 'suspended@example.com',
      name: 'Suspended User',
      role: 'USER',
      suspended: true,
    },
  },

  bankAccounts: {
    checking: {
      id: uuidv4(),
      accountName: 'Everyday Account',
      accountNumber: '123456789',
      bsb: '062-000',
      institution: 'Commonwealth Bank',
      accountType: 'transaction',
      balance: 5000.0,
      status: 'CONNECTED',
    },
    savings: {
      id: uuidv4(),
      accountName: 'Savings Account',
      accountNumber: '987654321',
      bsb: '062-001',
      institution: 'Commonwealth Bank',
      accountType: 'savings',
      balance: 15000.0,
      status: 'CONNECTED',
    },
    business: {
      id: uuidv4(),
      accountName: 'Business Account',
      accountNumber: '555555555',
      bsb: '033-000',
      institution: 'Westpac',
      accountType: 'business',
      balance: 25000.0,
      status: 'CONNECTED',
    },
  },

  transactions: {
    incomeDescriptions: [
      'Salary Payment',
      'Freelance Invoice #1234',
      'Tax Refund',
      'Investment Dividend',
      'Rental Income',
    ],
    expenseDescriptions: [
      'Woolworths Grocery',
      'Fuel - BP Service Station',
      'Netflix Subscription',
      'Office Supplies - Officeworks',
      'Restaurant - The Local Cafe',
      'Electricity Bill - Origin Energy',
      'Mobile Phone - Telstra',
      'Insurance Premium',
      'Medical Consultation',
      'Public Transport - Opal',
    ],
    incomeCategories: ['Salary', 'Freelance', 'Government', 'Investment', 'Rental'],
    expenseCategories: [
      'Groceries',
      'Transport',
      'Entertainment',
      'Office',
      'Dining',
      'Utilities',
      'Communication',
      'Insurance',
      'Healthcare',
      'Transport',
    ],
  },

  goals: {
    vacation: {
      id: uuidv4(),
      name: 'Europe Vacation',
      description: 'Summer trip to Europe',
      targetAmount: 10000,
      currentAmount: 2500,
      category: 'Travel',
      priority: 'MEDIUM',
      status: 'ACTIVE',
    },
    emergency: {
      id: uuidv4(),
      name: 'Emergency Fund',
      description: '6 months of expenses',
      targetAmount: 30000,
      currentAmount: 15000,
      category: 'Savings',
      priority: 'HIGH',
      status: 'ACTIVE',
    },
    business: {
      id: uuidv4(),
      name: 'Business Equipment',
      description: 'New computers and software',
      targetAmount: 5000,
      currentAmount: 1000,
      category: 'Business',
      priority: 'HIGH',
      status: 'ACTIVE',
    },
  },

  receipts: {
    grocery: {
      id: uuidv4(),
      merchant: 'Woolworths',
      totalAmount: 156.78,
      gstAmount: 14.25,
      processingStatus: 'PROCESSED',
      extractedData: {
        abn: '88000014675',
        taxInvoiceNumber: 'INV-12345',
        paymentMethod: 'Card',
        lineItems: [
          { description: 'Fresh Produce', totalPrice: 45.5, gstIncluded: true },
          { description: 'Dairy Products', totalPrice: 32.8, gstIncluded: true },
          { description: 'Household Items', totalPrice: 78.48, gstIncluded: true },
        ],
      },
    },
    business: {
      id: uuidv4(),
      merchant: 'Officeworks',
      totalAmount: 329.9,
      gstAmount: 29.99,
      processingStatus: 'PROCESSED',
      extractedData: {
        abn: '48004042937',
        taxInvoiceNumber: 'TAX-98765',
        paymentMethod: 'Business Card',
        lineItems: [
          {
            description: 'Printer Paper',
            quantity: 5,
            unitPrice: 15.99,
            totalPrice: 79.95,
            gstIncluded: true,
          },
          {
            description: 'Toner Cartridge',
            quantity: 2,
            unitPrice: 124.975,
            totalPrice: 249.95,
            gstIncluded: true,
          },
        ],
      },
    },
  },

  budgets: {
    monthly: {
      id: uuidv4(),
      name: 'Monthly Budget',
      period: 'MONTHLY',
      amount: 5000,
      categories: {
        Groceries: 800,
        Transport: 400,
        Utilities: 300,
        Entertainment: 200,
        Healthcare: 150,
        Other: 3150,
      },
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      isActive: true,
    },
  },

  insights: {
    spending: {
      id: uuidv4(),
      type: 'SPENDING_PATTERN',
      title: 'High grocery spending detected',
      description: 'Your grocery spending is 25% higher than last month',
      severity: 'MEDIUM',
      actionable: true,
      metadata: {
        category: 'Groceries',
        currentSpending: 1000,
        previousSpending: 800,
        percentageIncrease: 25,
      },
    },
    saving: {
      id: uuidv4(),
      type: 'SAVINGS_OPPORTUNITY',
      title: 'Subscription optimization opportunity',
      description: 'You could save $50/month by consolidating streaming services',
      severity: 'LOW',
      actionable: true,
      metadata: {
        potentialSavings: 50,
        affectedServices: ['Netflix', 'Stan', 'Disney+'],
      },
    },
  },

  // Test data for various scenarios
  testCases: {
    validABN: '51824753556', // Valid ABN with correct checksum
    invalidABN: '12345678900', // Invalid checksum
    validTFN: '123456782', // Valid TFN format
    invalidTFN: '123456789', // Invalid checksum

    gstCalculations: [
      { amount: 110, gstInclusive: true, expectedGST: 10, expectedBase: 100 },
      { amount: 100, gstInclusive: false, expectedGST: 10, expectedTotal: 110 },
      { amount: 55, gstInclusive: true, expectedGST: 5, expectedBase: 50 },
    ],

    taxCategories: {
      'Motor Vehicle': 'D1',
      'Travel Expenses': 'D2',
      'Education Course': 'D4',
      'Office Supplies': 'D5',
      'Donation to Charity': 'D8',
      'Rental Property': 'P8',
      'Personal Shopping': 'PERSONAL',
    },
  },

  // Authentication tokens
  auth: {
    validToken:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    expiredToken:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZXhwIjoxNTE2MjM5MDIyfQ.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ',
  },
};

// Helper to generate random Australian phone number
export function generateAustralianPhone(): string {
  const areaCodes = ['02', '03', '04', '07', '08'];
  const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
  const number = Math.floor(Math.random() * 90000000) + 10000000;
  return `${areaCode}${number}`;
}

// Helper to generate random ABN
export function generateRandomABN(): string {
  // This generates a random 11-digit number, not necessarily valid
  return Math.floor(Math.random() * 90000000000 + 10000000000).toString();
}

// Helper to generate date range
export function generateDateRange(daysBack: number = 30): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  return { start, end };
}

// Helper to generate financial year
export function getCurrentFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // Australian financial year starts July 1
  return month >= 6 ? year.toString() : (year - 1).toString();
}
