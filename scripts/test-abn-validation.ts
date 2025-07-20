#!/usr/bin/env npx tsx

/**
 * Test script for ABN checksum validation
 */

// ABN checksum validation function (same as in validation.ts)
function validateABNChecksum(abn: string): boolean {
  // ABN must be exactly 11 digits
  if (!/^\d{11}$/.test(abn)) {
    return false;
  }

  // Convert string to array of numbers
  const digits = abn.split('').map(Number);
  
  // Subtract 1 from the first digit
  digits[0] -= 1;
  
  // Apply weighting factors
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  
  // Calculate the sum of (digit * weight) for each position
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }
  
  // Check if sum is divisible by 89
  return sum % 89 === 0;
}

// Test cases
const testCases = [
  // Valid ABNs (real examples)
  { abn: '51824753556', expected: true, description: 'Valid ABN - ASIC' },
  { abn: '53004085616', expected: true, description: 'Valid ABN - Example company' },
  { abn: '11000000000', expected: false, description: 'Invalid ABN - all zeros pattern' },
  { abn: '12345678901', expected: false, description: 'Invalid ABN - sequential numbers' },
  { abn: '51824753557', expected: false, description: 'Invalid ABN - wrong checksum (last digit changed)' },
  { abn: '1234567890', expected: false, description: 'Invalid ABN - too short' },
  { abn: '123456789012', expected: false, description: 'Invalid ABN - too long' },
  { abn: 'abcdefghijk', expected: false, description: 'Invalid ABN - non-numeric' },
];

console.log('Testing ABN Checksum Validation\n');
console.log('================================\n');

let passed = 0;
let failed = 0;

testCases.forEach(({ abn, expected, description }) => {
  const result = validateABNChecksum(abn);
  const status = result === expected ? '✅ PASS' : '❌ FAIL';
  
  if (result === expected) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`${status} | ABN: ${abn}`);
  console.log(`     | ${description}`);
  console.log(`     | Expected: ${expected}, Got: ${result}\n`);
});

console.log('================================');
console.log(`Total Tests: ${testCases.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.error('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}