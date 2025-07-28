#!/usr/bin/env node
import { getDatabaseUrl, sanitizeDatabaseUrl, validateProductionDatabaseUrl } from '../lib/utils/database-url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

console.log('🔍 Testing Database URL Configuration\n');

// Test with example URLs that have special characters
const testUrls = [
  'postgresql://user:pass@host:5432/db',
  'postgresql://user:p@ss!word@host:5432/db',
  'postgresql://user:p#ss&word@host:5432/db?sslmode=require',
  'postgresql://taaxdog-admin:AVNS_sOOnNB63elYEvJLTVuy@host:5432/db?sslmode=require',
];

console.log('Testing URL encoding:');
testUrls.forEach((url, index) => {
  console.log(`\nTest ${index + 1}:`);
  console.log(`Original: ${url}`);
  try {
    const sanitized = sanitizeDatabaseUrl(url);
    console.log(`Sanitized: ${sanitized}`);
    console.log('✅ Success');
  } catch (error) {
    console.log(`❌ Error: ${error}`);
  }
});

console.log('\n\n🔍 Testing actual environment DATABASE_URL:\n');

try {
  const dbUrl = getDatabaseUrl();
  console.log('✅ Successfully retrieved database URL');
  
  // Don't log the actual URL with password
  const maskedUrl = dbUrl.replace(/:([^@]+)@/, ':****@');
  console.log(`Masked URL: ${maskedUrl}`);
  
  // Validate for production
  process.env.NODE_ENV = 'production';
  const validation = validateProductionDatabaseUrl(dbUrl);
  
  if (validation.valid) {
    console.log('✅ URL is valid for production');
  } else {
    console.log('❌ URL validation failed:');
    validation.errors.forEach(error => console.log(`  - ${error}`));
  }
  
} catch (error) {
  console.error('❌ Failed to get database URL:', error);
}

console.log('\n✨ Test complete');