#!/usr/bin/env ts-node

import { encrypt, decrypt, hash, verifyHash, maskSensitiveData } from '../lib/encryption';
import { isEncrypted } from '../lib/prisma-encryption-middleware';
import prisma from '../lib/prisma';
import { randomBytes } from 'crypto';

// Ensure encryption key is set for testing
if (!process.env.FIELD_ENCRYPTION_KEY) {
  process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  console.log('⚠️  Generated temporary encryption key for testing\n');
}

async function testBasicEncryption() {
  console.log('🔐 Testing Field-Level Encryption\n');

  // Test basic encryption/decryption
  console.log('1️⃣ Testing basic encryption/decryption:');
  const testData = 'This is sensitive data!';
  const encrypted = encrypt(testData);
  const decrypted = decrypt(encrypted);

  console.log(`Original: ${testData}`);
  console.log(`Encrypted: ${encrypted.substring(0, 30)}...`);
  console.log(`Decrypted: ${decrypted}`);
  console.log(`Match: ${testData === decrypted ? '✅' : '❌'}`);
  console.log(`Is Encrypted: ${isEncrypted(encrypted) ? '✅' : '❌'}\n`);

  // Test hashing
  console.log('2️⃣ Testing hashing:');
  const password = 'MySecurePassword123';
  const hashed = hash(password);
  const isValid = verifyHash(password, hashed);
  const isInvalid = verifyHash('WrongPassword', hashed);

  console.log(`Password: ${password}`);
  console.log(`Hashed: ${hashed.substring(0, 30)}...`);
  console.log(`Verify correct: ${isValid ? '✅' : '❌'}`);
  console.log(`Verify wrong: ${!isInvalid ? '✅' : '❌'}\n`);

  // Test data masking
  console.log('3️⃣ Testing data masking:');
  const tfn = '123456789';
  const accountNumber = '1234567890';
  const masked1 = maskSensitiveData(tfn, 3);
  const masked2 = maskSensitiveData(accountNumber, 4);

  console.log(`TFN: ${tfn} → ${masked1}`);
  console.log(`Account: ${accountNumber} → ${masked2}\n`);

  // Test empty values
  console.log('4️⃣ Testing edge cases:');
  const emptyEncrypt = encrypt('');
  const nullEncrypt = encrypt(null as any);
  console.log(`Empty string: ${emptyEncrypt === '' ? '✅' : '❌'}`);
  console.log(`Null value: ${nullEncrypt === null ? '✅' : '❌'}\n`);
}

async function testPrismaMiddleware() {
  console.log('5️⃣ Testing Prisma Middleware Encryption:\n');

  try {
    // Create test user
    const testEmail = `test-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'Test User',
        tfn: '123456789',
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
        password: 'hashed_password', // This should be hashed, not encrypted
      },
    });

    console.log('Created user:');
    console.log(`  Email: ${user.email}`);
    console.log(`  TFN (decrypted): ${user.tfn}`);
    console.log(`  2FA Secret (decrypted): ${user.twoFactorSecret?.substring(0, 10)}...\n`);

    // Read raw from database to verify encryption
    const rawUser = (await prisma.$queryRaw`
      SELECT tfn, "twoFactorSecret" 
      FROM users 
      WHERE email = ${testEmail}
    `) as any[];

    if (rawUser.length > 0) {
      console.log('Raw database values:');
      console.log(`  TFN (encrypted): ${rawUser[0].tfn?.substring(0, 30)}...`);
      console.log(`  2FA (encrypted): ${rawUser[0].twoFactorSecret?.substring(0, 30)}...`);
      console.log(`  TFN is encrypted: ${isEncrypted(rawUser[0].tfn) ? '✅' : '❌'}`);
      console.log(`  2FA is encrypted: ${isEncrypted(rawUser[0].twoFactorSecret) ? '✅' : '❌'}\n`);
    }

    // Clean up
    await prisma.user.delete({ where: { id: user.id } });
    console.log('✅ Prisma middleware test completed!\n');
  } catch (error) {
    console.error('❌ Prisma middleware test failed:', error);
  }
}

async function main() {
  try {
    await testBasicEncryption();
    await testPrismaMiddleware();
    console.log('✅ All encryption tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
