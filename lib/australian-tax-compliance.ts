export interface TaxCategory {
  code: string;
  name: string;
  description: string;
  gstDeductible: boolean;
  businessUseOnly: boolean;
}

export const ATO_TAX_CATEGORIES: TaxCategory[] = [
  {
    code: 'D1',
    name: 'Car expenses',
    description: 'Business use of motor vehicle',
    gstDeductible: true,
    businessUseOnly: false,
  },
  {
    code: 'D2',
    name: 'Travel expenses',
    description: 'Accommodation, meals, transport for business travel',
    gstDeductible: true,
    businessUseOnly: false,
  },
  {
    code: 'D3',
    name: 'Clothing expenses',
    description: 'Protective clothing, uniforms with logo',
    gstDeductible: true,
    businessUseOnly: false,
  },
  {
    code: 'D4',
    name: 'Self-education',
    description: 'Courses, conferences, seminars related to work',
    gstDeductible: true,
    businessUseOnly: false,
  },
  {
    code: 'D5',
    name: 'Other work expenses',
    description: 'Tools, equipment, home office, phone, internet',
    gstDeductible: true,
    businessUseOnly: false,
  },
  {
    code: 'B1',
    name: 'Cost of sales',
    description: 'Direct costs of goods sold',
    gstDeductible: true,
    businessUseOnly: true,
  },
  {
    code: 'B2',
    name: 'Operating expenses',
    description: 'Rent, utilities, insurance, advertising',
    gstDeductible: true,
    businessUseOnly: true,
  },
  {
    code: 'B3',
    name: 'Capital purchases',
    description: 'Equipment, machinery over $300',
    gstDeductible: true,
    businessUseOnly: true,
  },
  {
    code: 'B4',
    name: 'Professional fees',
    description: 'Accounting, legal, consulting fees',
    gstDeductible: true,
    businessUseOnly: true,
  },
  {
    code: 'N1',
    name: 'Private expenses',
    description: 'Non-deductible personal expenses',
    gstDeductible: false,
    businessUseOnly: false,
  },
];

export function validateABN(abn: string): boolean {
  // Remove spaces and validate format
  const cleanABN = abn.replace(/\s/g, '');

  if (!/^\d{11}$/.test(cleanABN)) {
    return false;
  }

  // ABN check digit validation
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = cleanABN.split('').map(Number);

  // Subtract 1 from first digit
  digits[0] -= 1;

  // Calculate weighted sum
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }

  return sum % 89 === 0;
}

export function formatABN(abn: string): string {
  const clean = abn.replace(/\s/g, '');
  if (clean.length !== 11) return abn;

  return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
}

export function calculateGST(
  amount: number,
  isInclusive: boolean = true,
): {
  gstAmount: number;
  netAmount: number;
  totalAmount: number;
} {
  const GST_RATE = 0.1; // 10% GST in Australia

  if (isInclusive) {
    // Price includes GST
    const gstAmount = amount / 11; // amount / (1 + GST_RATE) * GST_RATE
    const netAmount = amount - gstAmount;

    return {
      gstAmount: Math.round(gstAmount * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
      totalAmount: amount,
    };
  } else {
    // Price excludes GST
    const gstAmount = amount * GST_RATE;
    const totalAmount = amount + gstAmount;

    return {
      gstAmount: Math.round(gstAmount * 100) / 100,
      netAmount: amount,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }
}

export function detectTaxCategory(merchant: string, items: any[]): string {
  const merchantLower = merchant.toLowerCase();

  // Common merchant patterns
  if (
    merchantLower.includes('uber') ||
    merchantLower.includes('taxi') ||
    merchantLower.includes('cabcharge')
  ) {
    return 'D1'; // Car expenses
  }

  if (
    merchantLower.includes('hotel') ||
    merchantLower.includes('motel') ||
    merchantLower.includes('airbnb')
  ) {
    return 'D2'; // Travel expenses
  }

  if (merchantLower.includes('officeworks') || merchantLower.includes('staples')) {
    return 'D5'; // Other work expenses
  }

  if (
    merchantLower.includes('telstra') ||
    merchantLower.includes('optus') ||
    merchantLower.includes('vodafone')
  ) {
    return 'D5'; // Phone/internet
  }

  // Check items for patterns
  if (items && items.length > 0) {
    const itemDescriptions = items.map((item) => item.description?.toLowerCase() || '').join(' ');

    if (itemDescriptions.includes('fuel') || itemDescriptions.includes('petrol')) {
      return 'D1'; // Car expenses
    }

    if (itemDescriptions.includes('stationery') || itemDescriptions.includes('office supplies')) {
      return 'D5'; // Office supplies
    }
  }

  // Default to other work expenses for business receipts
  return 'D5';
}

export function validateTaxInvoice(receipt: any): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  // ATO requirements for tax invoice
  if (!receipt.merchant) missingFields.push('Supplier name');
  if (!receipt.abn) missingFields.push('Supplier ABN');
  if (!receipt.date) missingFields.push('Invoice date');
  if (!receipt.totalAmount) missingFields.push('Total amount');
  if (!receipt.gstAmount && receipt.totalAmount > 82.5) {
    missingFields.push('GST amount (required for invoices over $82.50)');
  }
  if (!receipt.items || receipt.items.length === 0) {
    missingFields.push('Item descriptions');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

export function detectDuplicateReceipt(
  newReceipt: any,
  existingReceipts: any[],
): { isDuplicate: boolean; matchedReceiptId?: string } {
  for (const existing of existingReceipts) {
    // Check for exact match on amount, date, and merchant
    if (
      existing.totalAmount === newReceipt.totalAmount &&
      existing.date === newReceipt.date &&
      existing.merchant === newReceipt.merchant
    ) {
      return { isDuplicate: true, matchedReceiptId: existing.id };
    }

    // Check for invoice number match
    if (
      newReceipt.taxInvoiceNumber &&
      existing.taxInvoiceNumber === newReceipt.taxInvoiceNumber &&
      existing.merchant === newReceipt.merchant
    ) {
      return { isDuplicate: true, matchedReceiptId: existing.id };
    }
  }

  return { isDuplicate: false };
}
