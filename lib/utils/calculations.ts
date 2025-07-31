/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    return newValue === 0 ? 0 : 100;
  }
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}

/**
 * Format percentage change for display
 */
export function formatPercentageChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

/**
 * Validate Australian Tax File Number (TFN)
 * TFN is a 9-digit number
 */
export function validateTFN(tfn: string): boolean {
  // Remove spaces and hyphens
  const cleanedTFN = tfn.replace(/[\s-]/g, '');

  // Check if it's 9 digits
  if (!/^\d{9}$/.test(cleanedTFN)) {
    return false;
  }

  // TFN checksum validation (using ATO algorithm)
  const weights = [1, 4, 3, 7, 5, 8, 6, 9, 10];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanedTFN[i]) * weights[i];
  }

  return sum % 11 === 0;
}

/**
 * Validate Australian Business Number (ABN)
 * ABN is an 11-digit number
 */
export function validateABN(abn: string): boolean {
  // Remove spaces and hyphens
  const cleanedABN = abn.replace(/[\s-]/g, '');

  // Check if it's 11 digits
  if (!/^\d{11}$/.test(cleanedABN)) {
    return false;
  }

  // ABN checksum validation
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

  // Subtract 1 from the first digit
  const digits = cleanedABN.split('').map((d, i) => {
    const digit = parseInt(d);
    return i === 0 ? digit - 1 : digit;
  });

  // Calculate weighted sum
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }

  // Check if sum is divisible by 89
  return sum % 89 === 0;
}
