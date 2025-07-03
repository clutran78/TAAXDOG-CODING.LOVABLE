// Australian Banking Validation Utilities

// BSB (Bank State Branch) validation
// Format: XXX-XXX or XXXXXX where X is a digit
export function validateBSB(bsb: string): { valid: boolean; formatted?: string; error?: string } {
  if (!bsb) {
    return { valid: false, error: 'BSB is required' };
  }

  // Remove any spaces or special characters except hyphen
  const cleaned = bsb.replace(/[^0-9-]/g, '');

  // Check if it matches the pattern
  const bsbRegex = /^[0-9]{3}-?[0-9]{3}$/;
  if (!bsbRegex.test(cleaned)) {
    return { valid: false, error: 'BSB must be 6 digits in format XXX-XXX or XXXXXX' };
  }

  // Format with hyphen
  const formatted = cleaned.length === 6 ? `${cleaned.slice(0, 3)}-${cleaned.slice(3)}` : cleaned;

  // Validate bank and state codes (first 2 digits)
  const bankCode = parseInt(cleaned.substring(0, 2));
  
  // Australian bank codes (first 2 digits of BSB)
  const validBankCodes = [
    '01', // ANZ
    '03', '73', // Westpac
    '06', '76', // CBA
    '08', '48', // NAB
    '11', '12', '13', '14', // St George
    '15', // BankSA
    '30', // Bankwest
    '31', '32', '33', '34', '35', // Bank of Queensland
    '40', // Suncorp
    '51', '52', '53', '54', '55', // Adelaide Bank/Bendigo
    '61', '62', '63', '64', '65', // Heritage Bank
    '68', // ING
    '80', '81', '82', '83', // Citibank
    '92', '93', '94', // AMP
  ];

  const bankCodeStr = cleaned.substring(0, 2);
  if (!validBankCodes.includes(bankCodeStr)) {
    // Still valid BSB, just not a major bank
    console.warn(`BSB ${formatted} uses uncommon bank code ${bankCodeStr}`);
  }

  return { valid: true, formatted };
}

// Australian Account Number validation
// Usually 5-9 digits, but can be up to 10 for some banks
export function validateAccountNumber(
  accountNumber: string,
  bsb?: string
): { valid: boolean; formatted?: string; error?: string } {
  if (!accountNumber) {
    return { valid: false, error: 'Account number is required' };
  }

  // Remove spaces and hyphens
  const cleaned = accountNumber.replace(/[^0-9]/g, '');

  // Check length (5-10 digits)
  if (cleaned.length < 5 || cleaned.length > 10) {
    return { valid: false, error: 'Account number must be between 5 and 10 digits' };
  }

  // Check if all characters are digits
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: 'Account number must contain only digits' };
  }

  // Bank-specific validation if BSB is provided
  if (bsb) {
    const bsbCleaned = bsb.replace(/[^0-9]/g, '');
    const bankCode = bsbCleaned.substring(0, 2);

    // CBA accounts are typically 9 digits
    if (['06', '76'].includes(bankCode) && cleaned.length !== 9) {
      console.warn(`CBA account numbers are typically 9 digits, got ${cleaned.length}`);
    }

    // Westpac accounts are typically 9-10 digits
    if (['03', '73'].includes(bankCode) && (cleaned.length < 9 || cleaned.length > 10)) {
      console.warn(`Westpac account numbers are typically 9-10 digits, got ${cleaned.length}`);
    }

    // ANZ accounts are typically 9 digits
    if (bankCode === '01' && cleaned.length !== 9) {
      console.warn(`ANZ account numbers are typically 9 digits, got ${cleaned.length}`);
    }

    // NAB accounts are typically 9 digits
    if (['08', '48'].includes(bankCode) && cleaned.length !== 9) {
      console.warn(`NAB account numbers are typically 9 digits, got ${cleaned.length}`);
    }
  }

  return { valid: true, formatted: cleaned };
}

// Validate complete bank account details
export function validateBankAccount(details: {
  bsb: string;
  accountNumber: string;
  accountName?: string;
}): { valid: boolean; errors: string[]; formatted?: { bsb: string; accountNumber: string } } {
  const errors: string[] = [];

  // Validate BSB
  const bsbValidation = validateBSB(details.bsb);
  if (!bsbValidation.valid) {
    errors.push(bsbValidation.error!);
  }

  // Validate account number
  const accountValidation = validateAccountNumber(details.accountNumber, details.bsb);
  if (!accountValidation.valid) {
    errors.push(accountValidation.error!);
  }

  // Validate account name if provided
  if (details.accountName) {
    if (details.accountName.length < 2) {
      errors.push('Account name must be at least 2 characters');
    }
    if (details.accountName.length > 100) {
      errors.push('Account name must not exceed 100 characters');
    }
    // Check for suspicious patterns
    if (/[<>{}[\]\\]/.test(details.accountName)) {
      errors.push('Account name contains invalid characters');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    formatted: {
      bsb: bsbValidation.formatted!,
      accountNumber: accountValidation.formatted!,
    },
  };
}

// Get bank name from BSB
export function getBankFromBSB(bsb: string): string | null {
  const cleaned = bsb.replace(/[^0-9]/g, '');
  if (cleaned.length < 2) return null;

  const bankCode = cleaned.substring(0, 2);

  const bankMap: { [key: string]: string } = {
    '01': 'ANZ',
    '03': 'Westpac',
    '06': 'Commonwealth Bank',
    '08': 'NAB',
    '11': 'St George Bank',
    '12': 'St George Bank',
    '13': 'St George Bank',
    '14': 'St George Bank',
    '15': 'BankSA',
    '30': 'Bankwest',
    '31': 'Bank of Queensland',
    '32': 'Bank of Queensland',
    '33': 'Bank of Queensland',
    '34': 'Bank of Queensland',
    '35': 'Bank of Queensland',
    '40': 'Suncorp',
    '48': 'NAB',
    '51': 'Adelaide Bank',
    '52': 'Bendigo Bank',
    '53': 'Bendigo Bank',
    '54': 'Adelaide Bank',
    '55': 'Adelaide Bank',
    '61': 'Heritage Bank',
    '62': 'Heritage Bank',
    '63': 'Heritage Bank',
    '64': 'Heritage Bank',
    '65': 'Heritage Bank',
    '68': 'ING',
    '73': 'Westpac',
    '76': 'Commonwealth Bank',
    '80': 'Citibank',
    '81': 'Citibank',
    '82': 'Citibank',
    '83': 'Citibank',
    '92': 'AMP Bank',
    '93': 'AMP Bank',
    '94': 'AMP Bank',
  };

  return bankMap[bankCode] || 'Unknown Bank';
}

// Validate Australian mobile number
export function validateAustralianMobile(mobile: string): { valid: boolean; formatted?: string; error?: string } {
  if (!mobile) {
    return { valid: false, error: 'Mobile number is required' };
  }

  // Remove all non-digit characters
  let cleaned = mobile.replace(/\D/g, '');

  // Remove country code if present
  if (cleaned.startsWith('61')) {
    cleaned = '0' + cleaned.substring(2);
  }

  // Check if it's a valid Australian mobile format
  const mobileRegex = /^04\d{8}$/;
  if (!mobileRegex.test(cleaned)) {
    return { valid: false, error: 'Invalid Australian mobile number format' };
  }

  // Format as 04XX XXX XXX
  const formatted = `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;

  return { valid: true, formatted };
}

// ABN (Australian Business Number) validation
export function validateABN(abn: string): { valid: boolean; formatted?: string; error?: string } {
  if (!abn) {
    return { valid: false, error: 'ABN is required' };
  }

  // Remove spaces and check length
  const cleaned = abn.replace(/\s/g, '');
  
  if (cleaned.length !== 11) {
    return { valid: false, error: 'ABN must be 11 digits' };
  }

  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: 'ABN must contain only digits' };
  }

  // ABN checksum validation
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = cleaned.split('').map(d => parseInt(d));
  
  // Subtract 1 from first digit
  digits[0] -= 1;
  
  // Calculate checksum
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }
  
  if (sum % 89 !== 0) {
    return { valid: false, error: 'Invalid ABN checksum' };
  }

  // Format as XX XXX XXX XXX
  const formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;

  return { valid: true, formatted };
}

// TFN (Tax File Number) validation
// Note: TFNs are sensitive and should be encrypted
export function validateTFN(tfn: string): { valid: boolean; error?: string } {
  if (!tfn) {
    return { valid: false, error: 'TFN is required' };
  }

  // Remove spaces
  const cleaned = tfn.replace(/\s/g, '');
  
  // Check length (8 or 9 digits)
  if (cleaned.length < 8 || cleaned.length > 9) {
    return { valid: false, error: 'TFN must be 8 or 9 digits' };
  }

  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: 'TFN must contain only digits' };
  }

  // TFN checksum validation
  const weights = [1, 4, 3, 7, 5, 8, 6, 9, 10];
  const digits = cleaned.split('').map(d => parseInt(d));
  
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * weights[i];
  }
  
  if (sum % 11 !== 0) {
    return { valid: false, error: 'Invalid TFN checksum' };
  }

  return { valid: true };
}

// Export all validators
export const bankingValidators = {
  validateBSB,
  validateAccountNumber,
  validateBankAccount,
  getBankFromBSB,
  validateAustralianMobile,
  validateABN,
  validateTFN,
};