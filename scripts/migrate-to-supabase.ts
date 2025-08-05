#!/usr/bin/env tsx

/**
 * Complete script to migrate from DigitalOcean to Supabase
 * This script guides you through the entire migration process
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { downloadDatabaseExport } from './download-database-export';

interface SupabaseConfig {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

function parseSupabaseUrl(url: string): SupabaseConfig {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname.slice(1) || 'postgres',
      username: parsed.username,
      password: parsed.password
    };
  } catch (error) {
    throw new Error(`Invalid Supabase URL format: ${error.message}`);
  }
}

async function checkPostgreSQLTools(): Promise<boolean> {
  return new Promise((resolve) => {
    const check = spawn('pg_restore', ['--version']);
    check.on('close', (code) => {
      resolve(code === 0);
    });
    check.on('error', () => {
      resolve(false);
    });
  });
}

async function restoreToSupabase(dumpFile: string, supabaseConfig: SupabaseConfig): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('🔄 Starting restore to Supabase...');
    console.log(`📍 Host: ${supabaseConfig.host}`);
    console.log(`🗄️ Database: ${supabaseConfig.database}`);
    
    const pgRestore = spawn('pg_restore', [
      '-h', supabaseConfig.host,
      '-p', supabaseConfig.port,
      '-U', supabaseConfig.username,
      '-d', supabaseConfig.database,
      '-v', // Verbose
      '--no-owner', // Prevent ownership issues
      '--no-privileges', // Prevent privilege issues
      '--clean', // Clean before restore
      '--if-exists', // Use IF EXISTS for clean
      dumpFile
    ], {
      env: {
        ...process.env,
        PGPASSWORD: supabaseConfig.password
      }
    });

    let stderr = '';
    let stdout = '';

    pgRestore.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('📤', data.toString().trim());
    });

    pgRestore.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('📥', data.toString().trim());
    });

    pgRestore.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Database restore completed successfully!');
        resolve(true);
      } else {
        console.error(`❌ pg_restore failed with exit code: ${code}`);
        console.error('STDERR:', stderr);
        resolve(false);
      }
    });

    pgRestore.on('error', (error) => {
      console.error('❌ pg_restore process error:', error);
      resolve(false);
    });
  });
}

async function updateEnvironmentFile(supabaseUrl: string) {
  const envPath = path.join(process.cwd(), '.env.local');
  
  try {
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or add DATABASE_URL
    const lines = envContent.split('\n');
    const updatedLines = lines.map(line => {
      if (line.startsWith('DATABASE_URL=')) {
        return `DATABASE_URL="${supabaseUrl}"`;
      }
      return line;
    });

    // Add DATABASE_URL if it doesn't exist
    if (!updatedLines.some(line => line.startsWith('DATABASE_URL='))) {
      updatedLines.push(`DATABASE_URL="${supabaseUrl}"`);
    }

    // Add backup of old URL
    const timestamp = new Date().toISOString();
    updatedLines.push(`# Backup of old DATABASE_URL (${timestamp})`);
    updatedLines.push(`# OLD_DATABASE_URL="postgresql://taaxdog-admin:AVNS_sOOnNB63elYEvJLTVuy@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require"`);

    fs.writeFileSync(envPath, updatedLines.join('\n'));
    console.log('✅ Updated .env.local with new Supabase DATABASE_URL');
  } catch (error) {
    console.error('❌ Failed to update .env.local:', error.message);
  }
}

async function main() {
  console.log('🚀 DigitalOcean to Supabase Migration Tool');
  console.log('==========================================\n');

  // Check prerequisites
  console.log('🔍 Checking prerequisites...');
  
  const hasPostgreSQL = await checkPostgreSQLTools();
  if (!hasPostgreSQL) {
    console.error('❌ PostgreSQL client tools not found!');
    console.log('📦 Install with: brew install postgresql');
    process.exit(1);
  }
  console.log('✅ PostgreSQL client tools found');

  // Get Supabase URL from environment or prompt
  const supabaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.NEW_DATABASE_URL;
  
  if (!supabaseUrl) {
    console.log('\n🔑 Supabase Database URL Required');
    console.log('Please set the SUPABASE_DATABASE_URL environment variable with your Supabase connection string.');
    console.log('\nExample:');
    console.log('export SUPABASE_DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"');
    console.log('\nYou can find this in your Supabase project settings under Database → Connection string.');
    process.exit(1);
  }

  console.log('✅ Supabase URL configured');

  try {
    // Parse Supabase configuration
    const supabaseConfig = parseSupabaseUrl(supabaseUrl);
    console.log(`📍 Target: ${supabaseConfig.host}:${supabaseConfig.port}/${supabaseConfig.database}`);

    // Step 1: Download database export
    console.log('\n📥 Step 1: Downloading database from DigitalOcean...');
    const dumpFile = await downloadDatabaseExport();

    if (!fs.existsSync(dumpFile)) {
      throw new Error('Database export file not found');
    }

    // Step 2: Restore to Supabase
    console.log('\n📤 Step 2: Restoring to Supabase...');
    const restoreSuccess = await restoreToSupabase(dumpFile, supabaseConfig);

    if (!restoreSuccess) {
      throw new Error('Database restore failed');
    }

    // Step 3: Update environment configuration
    console.log('\n⚙️ Step 3: Updating environment configuration...');
    await updateEnvironmentFile(supabaseUrl);

    // Success!
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Test your application locally with: npm run dev');
    console.log('2. Update your DigitalOcean app environment variables:');
    console.log(`   DATABASE_URL="${supabaseUrl}"`);
    console.log('3. Deploy your application');
    console.log('4. Test all functionality');
    
    console.log('\n🧹 Cleanup:');
    console.log(`You can safely delete the dump file: ${dumpFile}`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as migrateToSupabase };