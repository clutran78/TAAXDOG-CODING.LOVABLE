#!/usr/bin/env ts-node

import { PrismaClient } from "@prisma/client";
import { config } from 'dotenv';
import { resolve } from 'path';
import { encrypt, decrypt } from '../lib/encryption';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient({
  log: ['error'],
});

async function testSecurity() {
  console.log('🔐 Comprehensive Security Test\n');
  
  const results = {
    rls: { passed: 0, failed: 0 },
    encryption: { passed: 0, failed: 0 }
  };

  try {
    // Test 1: RLS is enabled
    console.log('1️⃣ Testing RLS is enabled on critical tables...');
    const rlsCheck = await prisma.$queryRawUnsafe(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('users', 'goals', 'receipts', 'bank_transactions')
      ORDER BY tablename;
    `) as any[];
    
    console.table(rlsCheck);
    const allEnabled = rlsCheck.every(t => t.rowsecurity === true);
    if (allEnabled) {
      console.log('✅ RLS is enabled on all critical tables\n');
      results.rls.passed++;
    } else {
      console.log('❌ Some tables don\'t have RLS enabled\n');
      results.rls.failed++;
    }

    // Test 2: RLS policies exist
    console.log('2️⃣ Testing RLS policies exist...');
    const policiesCheck = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as policy_count
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename IN ('users', 'goals', 'receipts', 'bank_transactions');
    `) as any[];
    
    const policyCount = parseInt(policiesCheck[0].policy_count);
    if (policyCount > 0) {
      console.log(`✅ Found ${policyCount} RLS policies\n`);
      results.rls.passed++;
    } else {
      console.log('❌ No RLS policies found\n');
      results.rls.failed++;
    }

    // Test 3: Encryption key is set
    console.log('3️⃣ Testing encryption configuration...');
    if (process.env.FIELD_ENCRYPTION_KEY) {
      console.log('✅ Encryption key is configured');
      console.log(`   Key length: ${process.env.FIELD_ENCRYPTION_KEY.length} characters\n`);
      results.encryption.passed++;
    } else {
      console.log('❌ Encryption key not found in environment\n');
      results.encryption.failed++;
    }

    // Test 4: Encryption/decryption works
    console.log('4️⃣ Testing encryption functionality...');
    const testTFN = '123456789';
    const encrypted = encrypt(testTFN);
    const decrypted = decrypt(encrypted);
    
    if (decrypted === testTFN && encrypted !== testTFN) {
      console.log('✅ Encryption/decryption working correctly');
      console.log(`   Original: ${testTFN}`);
      console.log(`   Encrypted: ${encrypted.substring(0, 20)}...`);
      console.log(`   Decrypted: ${decrypted}\n`);
      results.encryption.passed++;
    } else {
      console.log('❌ Encryption/decryption failed\n');
      results.encryption.failed++;
    }

    // Test 5: User context function
    console.log('5️⃣ Testing RLS user context functions...');
    const contextTest = await prisma.$queryRawUnsafe(`
      SELECT 
        current_user_id() as user_id,
        is_admin() as is_admin;
    `) as any[];
    
    console.log('Context without user:', contextTest[0]);
    if (contextTest[0].user_id === null) {
      console.log('✅ User context function working\n');
      results.rls.passed++;
    } else {
      console.log('❌ User context function not working correctly\n');
      results.rls.failed++;
    }

    // Test 6: Indexes for performance
    console.log('6️⃣ Testing performance indexes...');
    const indexCheck = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as index_count
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%userid%';
    `) as any[];
    
    const indexCount = parseInt(indexCheck[0].index_count);
    if (indexCount > 0) {
      console.log(`✅ Found ${indexCount} performance indexes for RLS\n`);
      results.rls.passed++;
    } else {
      console.log('❌ No performance indexes found\n');
      results.rls.failed++;
    }

    // Summary
    console.log('\n📊 Security Test Summary:');
    console.log('═'.repeat(50));
    console.log(`RLS Tests: ${results.rls.passed} passed, ${results.rls.failed} failed`);
    console.log(`Encryption Tests: ${results.encryption.passed} passed, ${results.encryption.failed} failed`);
    
    const totalPassed = results.rls.passed + results.encryption.passed;
    const totalTests = totalPassed + results.rls.failed + results.encryption.failed;
    
    console.log(`\nOverall: ${totalPassed}/${totalTests} tests passed`);
    
    if (results.rls.failed === 0 && results.encryption.failed === 0) {
      console.log('\n✅ All security features are properly configured!');
    } else {
      console.log('\n⚠️  Some security features need attention.');
    }

    // Recommendations
    console.log('\n📝 Recommendations:');
    console.log('1. Regularly test RLS policies with different user scenarios');
    console.log('2. Monitor query performance with EXPLAIN ANALYZE');
    console.log('3. Rotate encryption keys quarterly');
    console.log('4. Audit admin access logs regularly');
    console.log('5. Test disaster recovery procedures');

  } catch (error) {
    console.error('❌ Security test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSecurity().catch(console.error);