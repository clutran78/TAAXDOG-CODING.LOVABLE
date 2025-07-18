#!/usr/bin/env node

const crypto = require('crypto');

console.log('🔐 Generating Secure Keys for Production\n');

// Generate NEXTAUTH_SECRET
const nextAuthSecret = crypto.randomBytes(32).toString('base64');
console.log('NEXTAUTH_SECRET:');
console.log(nextAuthSecret);
console.log('');

// Generate JWT_SECRET
const jwtSecret = crypto.randomBytes(32).toString('base64');
console.log('JWT_SECRET:');
console.log(jwtSecret);
console.log('');

// Generate ENCRYPTION_KEY (32 bytes hex)
const encryptionKey = crypto.randomBytes(32).toString('hex');
console.log('ENCRYPTION_KEY:');
console.log(encryptionKey);
console.log('');

// Generate BACKUP_ENCRYPTION_KEY (32 bytes hex)
const backupEncryptionKey = crypto.randomBytes(32).toString('hex');
console.log('BACKUP_ENCRYPTION_KEY:');
console.log(backupEncryptionKey);
console.log('');

console.log('⚠️  IMPORTANT: Store these keys securely!');
console.log('Never commit them to version control.');
console.log('Use a secure key management service in production.\n');