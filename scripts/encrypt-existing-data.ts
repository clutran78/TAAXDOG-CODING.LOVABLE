#!/usr/bin/env ts-node

import { PrismaClient } from '../generated/prisma';
import { encrypt, isEncrypted, generateEncryptionKey } from '../lib/encryption';
import { encryptionConfig } from '../lib/prisma-encryption-middleware';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

interface MigrationStats {
  model: string;
  total: number;
  encrypted: number;
  skipped: number;
  failed: number;
}

async function encryptUserData(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    model: 'User',
    total: 0,
    encrypted: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        tfn: true,
        twoFactorSecret: true,
      },
    });

    stats.total = users.length;
    console.log(`Found ${users.length} users to process`);

    for (const user of users) {
      try {
        const updates: any = {};
        let needsUpdate = false;

        // Encrypt TFN if not already encrypted
        if (user.tfn && !isEncrypted(user.tfn)) {
          updates.tfn = encrypt(user.tfn);
          needsUpdate = true;
        }

        // Encrypt 2FA secret if not already encrypted
        if (user.twoFactorSecret && !isEncrypted(user.twoFactorSecret)) {
          updates.twoFactorSecret = encrypt(user.twoFactorSecret);
          needsUpdate = true;
        }

        if (needsUpdate) {
          await prisma.user.update({
            where: { id: user.id },
            data: updates,
          });
          stats.encrypted++;
          console.log(`✅ Encrypted user ${user.id}`);
        } else {
          stats.skipped++;
          console.log(`⏭️  Skipped user ${user.id} (already encrypted or no sensitive data)`);
        }
      } catch (error) {
        stats.failed++;
        console.error(`❌ Failed to encrypt user ${user.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error processing users:', error);
  }

  return stats;
}

async function encryptBankAccountData(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    model: 'BankAccounts',
    total: 0,
    encrypted: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    const accounts = await prisma.bank_accounts.findMany({
      select: {
        id: true,
        account_number: true,
        bsb: true,
      },
    });

    stats.total = accounts.length;
    console.log(`Found ${accounts.length} bank accounts to process`);

    for (const account of accounts) {
      try {
        const updates: any = {};
        let needsUpdate = false;

        // Encrypt account number if not already encrypted
        if (account.account_number && !isEncrypted(account.account_number)) {
          updates.account_number = encrypt(account.account_number);
          needsUpdate = true;
        }

        // Encrypt BSB if not already encrypted
        if (account.bsb && !isEncrypted(account.bsb)) {
          updates.bsb = encrypt(account.bsb);
          needsUpdate = true;
        }

        if (needsUpdate) {
          await prisma.bank_accounts.update({
            where: { id: account.id },
            data: updates,
          });
          stats.encrypted++;
          console.log(`✅ Encrypted bank account ${account.id}`);
        } else {
          stats.skipped++;
          console.log(`⏭️  Skipped bank account ${account.id} (already encrypted or no sensitive data)`);
        }
      } catch (error) {
        stats.failed++;
        console.error(`❌ Failed to encrypt bank account ${account.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error processing bank accounts:', error);
  }

  return stats;
}

async function encryptReceiptData(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    model: 'Receipts',
    total: 0,
    encrypted: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    const receipts = await prisma.receipt.findMany({
      select: {
        id: true,
        taxInvoiceNumber: true,
        abn: true,
      },
    });

    stats.total = receipts.length;
    console.log(`Found ${receipts.length} receipts to process`);

    for (const receipt of receipts) {
      try {
        const updates: any = {};
        let needsUpdate = false;

        // Encrypt tax invoice number if not already encrypted
        if (receipt.taxInvoiceNumber && !isEncrypted(receipt.taxInvoiceNumber)) {
          updates.taxInvoiceNumber = encrypt(receipt.taxInvoiceNumber);
          needsUpdate = true;
        }

        // Encrypt ABN if not already encrypted
        if (receipt.abn && !isEncrypted(receipt.abn)) {
          updates.abn = encrypt(receipt.abn);
          needsUpdate = true;
        }

        if (needsUpdate) {
          await prisma.receipt.update({
            where: { id: receipt.id },
            data: updates,
          });
          stats.encrypted++;
          console.log(`✅ Encrypted receipt ${receipt.id}`);
        } else {
          stats.skipped++;
          console.log(`⏭️  Skipped receipt ${receipt.id} (already encrypted or no sensitive data)`);
        }
      } catch (error) {
        stats.failed++;
        console.error(`❌ Failed to encrypt receipt ${receipt.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error processing receipts:', error);
  }

  return stats;
}

async function main() {
  console.log('🔐 Starting Field-Level Encryption Migration\n');

  // Check if encryption key is set
  if (!process.env.FIELD_ENCRYPTION_KEY) {
    console.log('⚠️  Warning: FIELD_ENCRYPTION_KEY not found in environment variables.');
    console.log('📝 Generated new encryption key:', generateEncryptionKey());
    console.log('   Please add this to your .env file as FIELD_ENCRYPTION_KEY\n');
    
    const proceed = process.argv.includes('--force');
    if (!proceed) {
      console.log('❌ Aborting migration. Set FIELD_ENCRYPTION_KEY and run again.');
      console.log('   Or run with --force to use a temporary key (not recommended for production)');
      process.exit(1);
    }
  }

  console.log('📊 Encryption Configuration:');
  console.log(JSON.stringify(encryptionConfig, null, 2));
  console.log('\n');

  const allStats: MigrationStats[] = [];

  // Process each model
  console.log('🔄 Processing Users...\n');
  allStats.push(await encryptUserData());

  console.log('\n🔄 Processing Bank Accounts...\n');
  allStats.push(await encryptBankAccountData());

  console.log('\n🔄 Processing Receipts...\n');
  allStats.push(await encryptReceiptData());

  // Summary
  console.log('\n📊 Migration Summary:');
  console.log('═'.repeat(60));
  console.table(allStats);

  const totalEncrypted = allStats.reduce((sum, stat) => sum + stat.encrypted, 0);
  const totalFailed = allStats.reduce((sum, stat) => sum + stat.failed, 0);

  console.log(`\n✅ Total records encrypted: ${totalEncrypted}`);
  if (totalFailed > 0) {
    console.log(`❌ Total failures: ${totalFailed}`);
  }

  console.log('\n🎯 Next Steps:');
  console.log('1. Ensure FIELD_ENCRYPTION_KEY is securely stored');
  console.log('2. Back up the encryption key in a secure location');
  console.log('3. Test decryption on a few records');
  console.log('4. Update your application to use the encrypted Prisma client');
  
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('💥 Migration failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});