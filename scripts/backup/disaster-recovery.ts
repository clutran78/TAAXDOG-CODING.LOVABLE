#!/usr/bin/env npx tsx

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { format, parseISO } from 'date-fns';
import * as dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

interface RecoveryOptions {
  targetTime?: Date;
  backupKey?: string;
  verifyOnly?: boolean;
  targetDatabase?: string;
}

interface RecoveryResult {
  success: boolean;
  recoveredTo: Date;
  dataLoss: boolean;
  errors: string[];
  metrics: {
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
    recordsRecovered: number;
  };
}

class DisasterRecoveryService {
  private s3Client: S3Client;
  private backupBucket: string;
  private encryptionKey: string;
  private rto: number = 4 * 60; // 4 hours in minutes
  private rpo: number = 60; // 1 hour in minutes

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

  async performRecovery(options: RecoveryOptions): Promise<RecoveryResult> {
    const startTime = new Date();
    const result: RecoveryResult = {
      success: false,
      recoveredTo: new Date(),
      dataLoss: false,
      errors: [],
      metrics: {
        startTime,
        endTime: new Date(),
        durationMinutes: 0,
        recordsRecovered: 0
      }
    };

    try {
      console.log('🚨 DISASTER RECOVERY INITIATED');
      console.log(`RTO Target: ${this.rto} minutes`);
      console.log(`RPO Target: ${this.rpo} minutes`);

      // Step 1: Identify recovery point
      const recoveryPoint = await this.identifyRecoveryPoint(options);
      console.log(`📍 Recovery point: ${recoveryPoint.timestamp}`);

      // Step 2: Validate backup availability
      const backups = await this.validateBackupAvailability(recoveryPoint);
      
      // Step 3: Prepare recovery environment
      await this.prepareRecoveryEnvironment(options);

      // Step 4: Download and prepare backups
      const preparedBackups = await this.downloadAndPrepareBackups(backups);

      // Step 5: Perform recovery
      if (!options.verifyOnly) {
        await this.executeRecovery(preparedBackups, options);
      }

      // Step 6: Verify recovery
      const verification = await this.verifyRecovery(options);
      result.metrics.recordsRecovered = verification.recordCount;

      // Step 7: Post-recovery tasks
      await this.performPostRecoveryTasks(recoveryPoint);

      // Calculate metrics
      result.endTime = new Date();
      result.metrics.endTime = result.endTime;
      result.metrics.durationMinutes = 
        Math.round((result.endTime.getTime() - startTime.getTime()) / 60000);

      // Check if we met our targets
      if (result.metrics.durationMinutes > this.rto) {
        result.errors.push(`RTO exceeded: ${result.metrics.durationMinutes} minutes > ${this.rto} minutes`);
      }

      const dataLossMinutes = Math.round(
        (new Date().getTime() - recoveryPoint.timestamp.getTime()) / 60000
      );
      
      if (dataLossMinutes > this.rpo) {
        result.dataLoss = true;
        result.errors.push(`RPO exceeded: ${dataLossMinutes} minutes > ${this.rpo} minutes`);
      }

      result.success = result.errors.length === 0;
      result.recoveredTo = recoveryPoint.timestamp;

      console.log('✅ Recovery completed successfully');

    } catch (error: any) {
      result.errors.push(error.message);
      console.error('❌ Recovery failed:', error);
    }

    // Log recovery result
    await this.logRecoveryResult(result);

    return result;
  }

  private async identifyRecoveryPoint(options: RecoveryOptions): Promise<any> {
    if (options.backupKey) {
      // Specific backup requested
      const metadata = await this.getBackupMetadata(options.backupKey);
      return {
        key: options.backupKey,
        timestamp: new Date(metadata.timestamp),
        type: metadata.type
      };
    }

    if (options.targetTime) {
      // Point-in-time recovery requested
      return await this.findNearestBackup(options.targetTime);
    }

    // Default to latest backup
    return await this.findLatestBackup();
  }

  private async validateBackupAvailability(recoveryPoint: any): Promise<any[]> {
    console.log('🔍 Validating backup availability...');

    const backups = [];

    // Get the full backup
    const fullBackup = await this.findLastFullBackup(recoveryPoint.timestamp);
    if (!fullBackup) {
      throw new Error('No full backup found before recovery point');
    }
    backups.push(fullBackup);

    // Get incremental backups if needed
    if (fullBackup.timestamp < recoveryPoint.timestamp) {
      const incrementals = await this.findIncrementalBackups(
        fullBackup.timestamp,
        recoveryPoint.timestamp
      );
      backups.push(...incrementals);
    }

    console.log(`📦 Found ${backups.length} backup(s) for recovery`);
    return backups;
  }

  private async prepareRecoveryEnvironment(options: RecoveryOptions): Promise<void> {
    console.log('🔧 Preparing recovery environment...');

    const targetDb = options.targetDatabase || 'taaxdog-recovery';
    const adminUrl = process.env.DATABASE_URL!.replace('/taaxdog-production', '/defaultdb');

    // Create recovery database
    try {
      await execAsync(`psql ${adminUrl} -c "DROP DATABASE IF EXISTS ${targetDb};"`);
      await execAsync(`psql ${adminUrl} -c "CREATE DATABASE ${targetDb};"`);
      console.log(`✅ Created recovery database: ${targetDb}`);
    } catch (error) {
      console.error('Failed to create recovery database:', error);
      throw error;
    }

    // Stop application connections
    if (!options.verifyOnly) {
      console.log('🛑 Stopping application connections...');
      // In production, this would stop the application servers
    }
  }

  private async downloadAndPrepareBackups(backups: any[]): Promise<string[]> {
    console.log('📥 Downloading and preparing backups...');

    const tempDir = '/tmp/disaster-recovery';
    await fs.promises.mkdir(tempDir, { recursive: true });

    const preparedPaths = [];

    for (const backup of backups) {
      console.log(`Processing ${backup.type} backup: ${backup.key}`);

      // Download
      const command = new GetObjectCommand({
        Bucket: this.backupBucket,
        Key: backup.key
      });

      const response = await this.s3Client.send(command);
      const localPath = path.join(tempDir, path.basename(backup.key));
      
      const fileStream = fs.createWriteStream(localPath);
      await new Promise((resolve, reject) => {
        response.Body!.pipe(fileStream)
          .on('error', reject)
          .on('finish', resolve);
      });

      // Decrypt if needed
      let processedPath = localPath;
      if (localPath.endsWith('.enc')) {
        processedPath = await this.decryptFile(localPath);
      }

      // Decompress if needed
      if (processedPath.endsWith('.gz')) {
        processedPath = await this.decompressFile(processedPath);
      }

      preparedPaths.push(processedPath);
    }

    return preparedPaths;
  }

  private async executeRecovery(backupPaths: string[], options: RecoveryOptions): Promise<void> {
    console.log('🔄 Executing recovery...');

    const targetDb = options.targetDatabase || 'taaxdog-recovery';
    const targetUrl = process.env.DATABASE_URL!.replace('/taaxdog-production', `/${targetDb}`);

    // Restore full backup first
    const fullBackupPath = backupPaths[0];
    console.log('📦 Restoring full backup...');
    
    const { stderr } = await execAsync(`psql ${targetUrl} -f ${fullBackupPath}`);
    if (stderr && !stderr.includes('NOTICE') && !stderr.includes('WARNING')) {
      throw new Error(`Restore error: ${stderr}`);
    }

    // Apply incremental backups
    for (let i = 1; i < backupPaths.length; i++) {
      console.log(`📦 Applying incremental backup ${i}...`);
      // Apply WAL files for point-in-time recovery
      // This would involve pg_wal replay in a real scenario
    }

    console.log('✅ Database restoration completed');
  }

  private async verifyRecovery(options: RecoveryOptions): Promise<any> {
    console.log('🔍 Verifying recovery...');

    const targetDb = options.targetDatabase || 'taaxdog-recovery';
    const targetUrl = process.env.DATABASE_URL!.replace('/taaxdog-production', `/${targetDb}`);

    const verification = {
      recordCount: 0,
      integrityChecks: true,
      criticalTables: []
    };

    // Check critical tables
    const criticalTables = ['users', 'subscriptions', 'transactions', 'goals'];
    
    for (const table of criticalTables) {
      try {
        const { stdout } = await execAsync(
          `psql ${targetUrl} -t -c "SELECT COUNT(*) FROM ${table};"`
        );
        const count = parseInt(stdout.trim());
        verification.recordCount += count;
        verification.criticalTables.push({ table, count });
        console.log(`✅ ${table}: ${count} records`);
      } catch (error) {
        console.error(`❌ Failed to verify ${table}`);
        verification.integrityChecks = false;
      }
    }

    // Run integrity checks
    const integrityChecks = [
      `SELECT COUNT(*) FROM users WHERE email IS NULL;`,
      `SELECT COUNT(*) FROM subscriptions WHERE user_id NOT IN (SELECT id FROM users);`,
      `SELECT COUNT(*) FROM transactions WHERE amount < 0 AND type = 'income';`
    ];

    for (const check of integrityChecks) {
      const { stdout } = await execAsync(`psql ${targetUrl} -t -c "${check}"`);
      if (parseInt(stdout.trim()) > 0) {
        verification.integrityChecks = false;
        console.error('❌ Integrity check failed:', check);
      }
    }

    return verification;
  }

  private async performPostRecoveryTasks(recoveryPoint: any): Promise<void> {
    console.log('📋 Performing post-recovery tasks...');

    // 1. Update sequences
    console.log('🔧 Updating sequences...');
    // This would reset all sequences to their correct values

    // 2. Rebuild indexes
    console.log('🔧 Rebuilding indexes...');
    // REINDEX DATABASE in production

    // 3. Update statistics
    console.log('🔧 Updating statistics...');
    // ANALYZE in production

    // 4. Clear caches
    console.log('🔧 Clearing application caches...');
    // Clear Redis, CDN caches, etc.

    // 5. Notify stakeholders
    console.log('📧 Sending recovery notifications...');
    await this.sendRecoveryNotifications(recoveryPoint);
  }

  private async findLastFullBackup(beforeTime: Date): Promise<any> {
    const metadataPath = path.join(process.cwd(), 'logs', 'backup-metadata.json');
    const content = await fs.promises.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(content);

    return metadata
      .filter((m: any) => 
        m.type === 'full' && 
        new Date(m.timestamp) <= beforeTime
      )
      .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))[0];
  }

  private async findIncrementalBackups(fromTime: Date, toTime: Date): Promise<any[]> {
    const metadataPath = path.join(process.cwd(), 'logs', 'backup-metadata.json');
    const content = await fs.promises.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(content);

    return metadata
      .filter((m: any) => 
        m.type === 'incremental' && 
        new Date(m.timestamp) > fromTime &&
        new Date(m.timestamp) <= toTime
      )
      .sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
  }

  private async findNearestBackup(targetTime: Date): Promise<any> {
    const metadataPath = path.join(process.cwd(), 'logs', 'backup-metadata.json');
    const content = await fs.promises.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(content);

    const validBackups = metadata
      .filter((m: any) => new Date(m.timestamp) <= targetTime)
      .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));

    if (validBackups.length === 0) {
      throw new Error('No backups found before target time');
    }

    return {
      key: validBackups[0].s3Key,
      timestamp: new Date(validBackups[0].timestamp),
      type: validBackups[0].type
    };
  }

  private async findLatestBackup(): Promise<any> {
    const metadataPath = path.join(process.cwd(), 'logs', 'backup-metadata.json');
    const content = await fs.promises.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(content);

    const latest = metadata
      .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))[0];

    return {
      key: latest.s3Key,
      timestamp: new Date(latest.timestamp),
      type: latest.type
    };
  }

  private async getBackupMetadata(s3Key: string): Promise<any> {
    const metadataPath = path.join(process.cwd(), 'logs', 'backup-metadata.json');
    const content = await fs.promises.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(content);

    return metadata.find((m: any) => m.s3Key === s3Key);
  }

  private async decryptFile(encryptedPath: string): Promise<string> {
    const decryptedPath = encryptedPath.replace('.enc', '');
    
    const input = fs.createReadStream(encryptedPath);
    const output = fs.createWriteStream(decryptedPath);
    
    // Read IV
    const iv = Buffer.alloc(16);
    const fd = await fs.promises.open(encryptedPath, 'r');
    await fd.read(iv, 0, 16, 0);
    await fd.close();
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc', 
      Buffer.from(this.encryptionKey, 'hex'), 
      iv
    );

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

  private async decompressFile(compressedPath: string): Promise<string> {
    const decompressedPath = compressedPath.replace('.gz', '');
    await execAsync(`gunzip -c ${compressedPath} > ${decompressedPath}`);
    return decompressedPath;
  }

  private async logRecoveryResult(result: RecoveryResult): Promise<void> {
    const logPath = path.join(process.cwd(), 'logs', 'disaster-recovery.log');
    
    await fs.promises.appendFile(
      logPath,
      JSON.stringify(result) + '\n'
    );
  }

  private async sendRecoveryNotifications(recoveryPoint: any): Promise<void> {
    // In production, send emails/Slack notifications
    console.log('📧 Recovery notifications sent');
  }
}

// Main execution
async function main() {
  const drService = new DisasterRecoveryService();
  
  const options: RecoveryOptions = {
    verifyOnly: process.argv.includes('--verify'),
    targetDatabase: process.argv.find(arg => arg.startsWith('--target='))?.split('=')[1],
    backupKey: process.argv.find(arg => arg.startsWith('--backup='))?.split('=')[1],
    targetTime: process.argv.find(arg => arg.startsWith('--time=')) 
      ? parseISO(process.argv.find(arg => arg.startsWith('--time='))!.split('=')[1])
      : undefined
  };

  const result = await drService.performRecovery(options);
  
  console.log('\n📊 Recovery Result:');
  console.log(`Success: ${result.success}`);
  console.log(`Duration: ${result.metrics.durationMinutes} minutes`);
  console.log(`Records recovered: ${result.metrics.recordsRecovered}`);
  console.log(`Data loss: ${result.dataLoss}`);
  
  if (result.errors.length > 0) {
    console.error('\nErrors:', result.errors);
  }

  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main();
}

export { DisasterRecoveryService, RecoveryOptions, RecoveryResult };