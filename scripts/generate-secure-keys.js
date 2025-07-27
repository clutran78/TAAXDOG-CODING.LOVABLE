#!/usr/bin/env node

const crypto = require('crypto');

console.log('🔐 Generating Secure Keys for Production\n');

// Check if we're in a secure environment
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERROR: Do not run this script in production!');
  console.error('Keys should be generated offline and stored securely.');
  process.exit(1);
}

// Generate NEXTAUTH_SECRET
const nextAuthSecret = crypto.randomBytes(32).toString('base64');
console.log('NEXTAUTH_SECRET=<hidden>');
console.log(`# Length: ${nextAuthSecret.length} characters`);
console.log('');

// Generate JWT_SECRET
const jwtSecret = crypto.randomBytes(32).toString('base64');
console.log('JWT_SECRET=<hidden>');
console.log(`# Length: ${jwtSecret.length} characters`);
console.log('');

// Generate ENCRYPTION_KEY (32 bytes hex)
const encryptionKey = crypto.randomBytes(32).toString('hex');
console.log('ENCRYPTION_KEY=<hidden>');
console.log(`# Length: ${encryptionKey.length} characters (hex)`);
console.log('');

// Generate BACKUP_ENCRYPTION_KEY (32 bytes hex)
const backupEncryptionKey = crypto.randomBytes(32).toString('hex');
console.log('BACKUP_ENCRYPTION_KEY=<hidden>');
console.log(`# Length: ${backupEncryptionKey.length} characters (hex)`);
console.log('');

// Only show actual values if explicitly requested
if (process.argv.includes('--show-values')) {
  console.log('\n📋 Actual values (copy these to your .env file):');
  console.log('═'.repeat(50));
  console.log(`NEXTAUTH_SECRET="${nextAuthSecret}"`);
  console.log(`JWT_SECRET="${jwtSecret}"`);
  console.log(`ENCRYPTION_KEY="${encryptionKey}"`);
  console.log(`BACKUP_ENCRYPTION_KEY="${backupEncryptionKey}"`);
  console.log('═'.repeat(50));
} else {
  console.log('\n💡 To see the actual values, run: node generate-secure-keys.js --show-values');
}

console.log('⚠️  IMPORTANT: Store these keys securely!');
console.log('Never commit them to version control.');
console.log('Use a secure key management service in production.\n');
