#!/usr/bin/env node

// Test script to verify DATABASE_URL parsing with newlines

const testUrl = `postgresql://taaxdog-admin:AVNS_sOOnNB63elYEvJLTVuy@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.c
  om:25060/taaxdog-production?sslmode=require`;

console.log('Testing DATABASE_URL with newline...\n');
console.log('Original URL:');
console.log(JSON.stringify(testUrl));
console.log('\nURL contains newline:', testUrl.includes('\n'));

// Test the cleaning regex
const cleanedUrl = testUrl.replace(/[\s\n\r\t]+/g, '');
console.log('\nCleaned URL:');
console.log(cleanedUrl);

// Try to parse the cleaned URL
try {
  const parsed = new URL(cleanedUrl);
  console.log('\n✅ Cleaned URL is valid!');
  console.log('Host:', parsed.hostname);
  console.log('Database:', parsed.pathname.substring(1));
  console.log('SSL mode:', parsed.searchParams.get('sslmode'));
} catch (error) {
  console.log('\n❌ Cleaned URL is still invalid:', error.message);
}

// Test with a correctly formatted URL
const correctUrl = 'postgresql://taaxdog-admin:AVNS_sOOnNB63elYEvJLTVuy@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require';
try {
  const parsed = new URL(correctUrl);
  console.log('\n✅ Correct URL format works!');
} catch (error) {
  console.log('\n❌ Even correct URL fails:', error.message);
}