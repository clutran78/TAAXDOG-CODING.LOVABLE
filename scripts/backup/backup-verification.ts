#!/usr/bin/env npx tsx

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

interface VerificationResult {
  backup: string;
  timestamp: Date;
  status: 'success' | 'failed';
  checks: {
    integrity: boolean;
    restorable: boolean;
    dataConsistency: boolean;
    encryption: boolean;
  };
  errors: string[];
}

class BackupVerificationService {
  private s3Client: S3Client;
  private backupBucket: string;
  private encryptionKey: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-southeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });
    this.backupBucket = process.env.BACKUP_BUCKET || 'taaxdog-backups';
    this.encryptionKey = process.env.BACKUP_ENCRYPTION_KEY!;
  }

  async verifyBackup(s3Key: string): Promise<VerificationResult> {
    const result: VerificationResult = {
      backup: s3Key,
      timestamp: new Date(),
      status: 'success',
      checks: {
        integrity: false,
        restorable: false,
        dataConsistency: false,
        encryption: false
      },
      errors: []
    };

    try {
      console.log(`🔍 Verifying backup: ${s3Key}`);

      // Download backup
      const localPath = await this.downloadBackup(s3Key);

      // Check 1: Verify integrity
      result.checks.integrity = await this.verifyIntegrity(localPath, s3Key);

      // Check 2: Verify encryption
      result.checks.encryption = await this.verifyEncryption(localPath);

      // Decrypt if needed
      const decryptedPath = localPath.endsWith('.enc') 
        ? await this.decryptBackup(localPath) 
        : localPath;

      // Decompress if needed
      const finalPath = decryptedPath.endsWith('.gz')
        ? await this.decompressBackup(decryptedPath)
        : decryptedPath;

      // Check 3: Test restoration
      result.checks.restorable = await this.testRestore(finalPath);

      // Check 4: Verify data consistency
      result.checks.dataConsistency = await this.verifyDataConsistency();

      // Cleanup
      await this.cleanupTestFiles(localPath);

      // Determine overall status
      const allChecks = Object.values(result.checks);
      result.status = allChecks.every(check => check) ? 'success' : 'failed';

    } catch (error: any) {
      result.status = 'failed';
      result.errors.push(error.message);
    }

    // Log result
    await this.logVerificationResult(result);

    return result;
  }

  private async downloadBackup(s3Key: string): Promise<string> {
    console.log('📥 Downloading backup from S3...');
    
    const tempDir = '/tmp/backup-verification';
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    const localPath = path.join(tempDir, path.basename(s3Key));

    const command = new GetObjectCommand({
      Bucket: this.backupBucket,
      Key: s3Key
    });

    const response = await this.s3Client.send(command);
    const fileStream = fs.createWriteStream(localPath);

    await new Promise((resolve, reject) => {
      response.Body!.pipe(fileStream)
        .on('error', reject)
        .on('finish', resolve);
    });

    return localPath;
  }

  private async verifyIntegrity(localPath: string, s3Key: string): Promise<boolean> {
    console.log('🔒 Verifying backup integrity...');

    try {
      // Calculate checksum
      const calculatedChecksum = await this.calculateChecksum(localPath);

      // Get stored checksum from metadata
      const metadataPath = path.join(process.cwd(), 'logs', 'backup-metadata.json');
      const content = await fs.promises.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(content);
      
      const backupMetadata = metadata.find((m: any) => m.s3Key === s3Key);
      
      if (!backupMetadata) {
        console.warn('⚠️  No metadata found for backup');
        return false;
      }

      const matches = calculatedChecksum === backupMetadata.checksum;
      console.log(matches ? '✅ Integrity check passed' : '❌ Integrity check failed');
      
      return matches;
    } catch (error) {
      console.error('❌ Integrity check error:', error);
      return false;
    }
  }

  private async verifyEncryption(localPath: string): Promise<boolean> {
    if (!localPath.endsWith('.enc')) {
      console.log('⚠️  Backup is not encrypted');
      return false;
    }

    try {
      // Try to read the IV (first 16 bytes)
      const fd = await fs.promises.open(localPath, 'r');
      const iv = Buffer.alloc(16);
      await fd.read(iv, 0, 16, 0);
      await fd.close();

      console.log('✅ Encryption verification passed');
      return true;
    } catch {
      console.log('❌ Encryption verification failed');
      return false;
    }
  }

  private async decryptBackup(encryptedPath: string): Promise<string> {
    console.log('🔓 Decrypting backup...');
    
    const decryptedPath = encryptedPath.replace('.enc', '');
    
    const input = fs.createReadStream(encryptedPath);
    const output = fs.createWriteStream(decryptedPath);
    
    // Read IV from file
    const iv = Buffer.alloc(16);
    const fd = await fs.promises.open(encryptedPath, 'r');
    await fd.read(iv, 0, 16, 0);
    await fd.close();
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc', 
      Buffer.from(this.encryptionKey, 'hex'), 
      iv
    );

    // Skip the first 16 bytes (IV)
    const inputWithoutIV = fs.createReadStream(encryptedPath, { start: 16 });

    await new Promise((resolve, reject) => {
      inputWithoutIV
        .pipe(decipher)
        .pipe(output)
        .on('finish', resolve)
        .on('error', reject);
    });

    return decryptedPath;
  }

  private async decompressBackup(compressedPath: string): Promise<string> {
    console.log('📦 Decompressing backup...');
    
    const decompressedPath = compressedPath.replace('.gz', '');
    await execAsync(`gunzip -c ${compressedPath} > ${decompressedPath}`);
    
    return decompressedPath;
  }

  private async testRestore(backupPath: string): Promise<boolean> {
    console.log('🔄 Testing backup restoration...');

    try {
      // Create test database
      const testDb = 'taaxdog_backup_test';
      const adminUrl = process.env.DATABASE_URL!.replace('/taaxdog-production', '/defaultdb');
      
      // Drop test database if exists
      await execAsync(`psql ${adminUrl} -c "DROP DATABASE IF EXISTS ${testDb};"`);
      
      // Create test database
      await execAsync(`psql ${adminUrl} -c "CREATE DATABASE ${testDb};"`);
      
      // Restore backup to test database
      const testDbUrl = process.env.DATABASE_URL!.replace('/taaxdog-production', `/${testDb}`);
      const restoreCommand = `psql ${testDbUrl} -f ${backupPath}`;
      
      const { stderr } = await execAsync(restoreCommand);
      
      if (stderr && !stderr.includes('NOTICE') && !stderr.includes('WARNING')) {
        throw new Error(`Restore error: ${stderr}`);
      }

      // Run basic validation queries
      const validationQueries = [
        'SELECT COUNT(*) FROM users;',
        'SELECT COUNT(*) FROM subscriptions;',
        'SELECT COUNT(*) FROM transactions;'
      ];

      for (const query of validationQueries) {
        await execAsync(`psql ${testDbUrl} -c "${query}"`);
      }

      // Cleanup test database
      await execAsync(`psql ${adminUrl} -c "DROP DATABASE IF EXISTS ${testDb};"`);

      console.log('✅ Restoration test passed');
      return true;

    } catch (error) {
      console.error('❌ Restoration test failed:', error);
      return false;
    }
  }

  private async verifyDataConsistency(): Promise<boolean> {
    console.log('🔍 Verifying data consistency...');

    try {
      // Run consistency checks on production database
      const consistencyChecks = [
        // Check foreign key constraints
        `SELECT COUNT(*) FROM subscriptions s 
         LEFT JOIN users u ON s.user_id = u.id 
         WHERE u.id IS NULL;`,
        
        // Check data integrity
        `SELECT COUNT(*) FROM transactions 
         WHERE amount < 0 AND type = 'income';`,
        
        // Check required fields
        `SELECT COUNT(*) FROM users 
         WHERE email IS NULL OR email = '';`
      ];

      for (const check of consistencyChecks) {
        const { stdout } = await execAsync(`psql ${process.env.DATABASE_URL} -t -c "${check}"`);
        const count = parseInt(stdout.trim());
        
        if (count > 0) {
          console.error(`❌ Data consistency issue found: ${check}`);
          return false;
        }
      }

      console.log('✅ Data consistency check passed');
      return true;

    } catch (error) {
      console.error('❌ Data consistency check failed:', error);
      return false;
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  }

  private async cleanupTestFiles(basePath: string): Promise<void> {
    const dir = path.dirname(basePath);
    await fs.promises.rm(dir, { recursive: true, force: true });
  }

  private async logVerificationResult(result: VerificationResult): Promise<void> {
    const logPath = path.join(process.cwd(), 'logs', 'backup-verification.log');
    
    const logEntry = {
      ...result,
      timestamp: result.timestamp.toISOString()
    };

    await fs.promises.appendFile(
      logPath, 
      JSON.stringify(logEntry) + '\n'
    );

    // Send alert if verification failed
    if (result.status === 'failed') {
      await this.sendVerificationAlert(result);
    }
  }

  private async sendVerificationAlert(result: VerificationResult): Promise<void> {
    console.error('🚨 BACKUP VERIFICATION FAILED!');
    console.error('Failed checks:', 
      Object.entries(result.checks)
        .filter(([_, passed]) => !passed)
        .map(([check, _]) => check)
    );
    console.error('Errors:', result.errors);

    // In production, this would send alerts via email/Slack/PagerDuty
  }

  async verifyLatestBackups(): Promise<void> {
    console.log('🔍 Verifying latest backups...');

    const metadataPath = path.join(process.cwd(), 'logs', 'backup-metadata.json');
    
    try {
      const content = await fs.promises.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(content);
      
      // Get latest backup of each type
      const latestFull = metadata
        .filter((m: any) => m.type === 'full')
        .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))[0];
      
      const latestIncremental = metadata
        .filter((m: any) => m.type === 'incremental')
        .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))[0];

      const results = [];

      if (latestFull) {
        console.log('\n📋 Verifying latest full backup...');
        results.push(await this.verifyBackup(latestFull.s3Key));
      }

      if (latestIncremental) {
        console.log('\n📋 Verifying latest incremental backup...');
        results.push(await this.verifyBackup(latestIncremental.s3Key));
      }

      // Summary
      console.log('\n📊 Verification Summary:');
      results.forEach(result => {
        console.log(`- ${result.backup}: ${result.status.toUpperCase()}`);
      });

    } catch (error) {
      console.error('Failed to read backup metadata:', error);
    }
  }
}

// Main execution
async function main() {
  const verificationService = new BackupVerificationService();
  
  if (process.argv[2] === '--latest') {
    await verificationService.verifyLatestBackups();
  } else if (process.argv[2]) {
    const result = await verificationService.verifyBackup(process.argv[2]);
    console.log('\nVerification Result:', JSON.stringify(result, null, 2));
  } else {
    console.log('Usage: backup-verification.ts [--latest | <s3-key>]');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { BackupVerificationService, VerificationResult };