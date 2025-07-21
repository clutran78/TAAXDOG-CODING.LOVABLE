#!/usr/bin/env ts-node

import { PrismaClient } from "@prisma/client";
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function applyComplianceMigration() {
  console.log('🚀 Applying Compliance Migration to Production Database');
  console.log('=====================================================\n');

  try {
    // Check if tables already exist
    console.log('Checking existing tables...');
    const existingTables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'aml_transaction_monitoring',
        'privacy_consents',
        'data_access_requests',
        'apra_incident_reports',
        'gst_transaction_details',
        'compliance_configuration'
      )
    ` as any[];

    if (existingTables.length > 0) {
      console.log(`⚠️  Found ${existingTables.length} compliance tables already exist:`);
      existingTables.forEach((t: any) => console.log(`   - ${t.table_name}`));
      console.log('\nMigration may have been partially applied.');
      
      const answer = await askQuestion('Continue anyway? (y/N): ');
      if (answer.toLowerCase() !== 'y') {
        console.log('Migration cancelled.');
        return;
      }
    }

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'prisma/migrations/20250118_add_compliance_features/migration.sql');
    console.log(`\nReading migration file: ${migrationPath}`);
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');

    // Parse and execute migration statements
    console.log('\nApplying migration...');
    
    // Split by semicolons but handle complex statements
    const statements = migrationSQL
      .split(/;\s*$/gm)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments
      if (statement.trim().startsWith('--')) continue;
      
      // Extract operation type for logging
      const operation = statement.match(/^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s/i)?.[1] || 'EXECUTE';
      
      try {
        await prisma.$executeRawUnsafe(statement);
        console.log(`✅ ${operation} statement ${i + 1}/${statements.length}`);
        successCount++;
      } catch (error: any) {
        errorCount++;
        
        // Check if it's a "already exists" error
        if (error.message.includes('already exists')) {
          console.log(`⏭️  ${operation} statement ${i + 1}/${statements.length} - already exists`);
        } else {
          console.log(`❌ ${operation} statement ${i + 1}/${statements.length} - ${error.message}`);
        }
      }
    }

    console.log(`\nMigration Summary:`);
    console.log(`  Successful: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);

    // Verify all tables were created
    console.log('\nVerifying compliance tables...');
    const finalTables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'aml_transaction_monitoring',
        'privacy_consents',
        'data_access_requests',
        'apra_incident_reports',
        'gst_transaction_details',
        'compliance_configuration'
      )
      ORDER BY table_name
    ` as any[];

    console.log(`\nCompliance tables found: ${finalTables.length}/6`);
    finalTables.forEach((t: any) => console.log(`  ✅ ${t.table_name}`));

    if (finalTables.length === 6) {
      console.log('\n🎉 All compliance tables created successfully!');
      
      // Mark migration as applied in Prisma
      console.log('\nMarking migration as applied in Prisma...');
      try {
        await prisma.$executeRaw`
          INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
          VALUES (
            gen_random_uuid(),
            md5(${migrationSQL}),
            now(),
            '20250118_add_compliance_features',
            NULL,
            NULL,
            now(),
            ${successCount}
          )
        `;
        console.log('✅ Migration marked as applied');
      } catch (error) {
        console.log('⚠️  Could not mark migration as applied:', error);
        console.log('   Run manually: npx prisma migrate resolve --applied 20250118_add_compliance_features');
      }
    } else {
      console.log('\n⚠️  Some tables are missing. Please check the errors above.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function askQuestion(question: string): Promise<string> {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    readline.question(question, (answer: string) => {
      readline.close();
      resolve(answer);
    });
  });
}

// Run migration
applyComplianceMigration().catch(console.error);