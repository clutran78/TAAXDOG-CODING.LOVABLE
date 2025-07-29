#!/usr/bin/env ts-node

/**
 * PostgreSQL Database Backup Script
 * Features: Compression, Encryption, Automated Scheduling, Cloud Upload
 * 
 * Usage:
 *   npm run backup:db                    # Run manual backup
 *   npm run backup:db -- --schedule      # Setup automated schedule
 *   npm run backup:db -- --restore       # Restore from backup
 *   npm run backup:db -- --list          # List available backups
 *   npm run backup:db -- --cleanup       # Clean old backups
 */

import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import * as cron from 'node-cron';
import chalk from 'chalk';
import { format } from 'date-fns';
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '@/lib/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const execAsync = promisify(exec);

// Configuration
interface BackupConfig {
  // Database
  databaseUrl: string;
  databaseName: string;
  host: string;
  port: string;
  username: string;
  password: string;
  
  // Backup settings
  backupDir: string;
  encryptionKey: string;
  compressionLevel: number;
  retentionDays: number;
  maxBackups: number;
  
  // Cloud storage (S3-compatible)
  cloudEnabled: boolean;
  cloudBucket?: string;
  cloudRegion?: string;
  cloudAccessKey?: string;
  cloudSecretKey?: string;
  cloudEndpoint?: string; // For S3-compatible services
  
  // Scheduling
  scheduleEnabled: boolean;
  scheduleCron: string; // Default: Daily at 2 AM
  
  // Notifications
  notificationWebhook?: string;
  emailRecipients?: string[];
}

// Parse database URL
function parseDatabaseUrl(url: string): Partial<BackupConfig> {
  const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const match = url.match(regex);
  
  if (!match) {
    throw new Error('Invalid database URL format');
  }
  
  return {
    username: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    databaseName: match[5].split('?')[0],
  };
}

// Load configuration
function loadConfig(): BackupConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  const dbConfig = parseDatabaseUrl(databaseUrl);
  
  return {
    databaseUrl,
    ...dbConfig,
    
    // Backup settings
    backupDir: process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'),
    encryptionKey: process.env.BACKUP_ENCRYPTION_KEY || process.env.FIELD_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
    compressionLevel: parseInt(process.env.BACKUP_COMPRESSION_LEVEL || '9'),
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
    maxBackups: parseInt(process.env.BACKUP_MAX_COUNT || '10'),
    
    // Cloud storage
    cloudEnabled: process.env.BACKUP_CLOUD_ENABLED === 'true',
    cloudBucket: process.env.BACKUP_CLOUD_BUCKET || process.env.AWS_S3_BUCKET,
    cloudRegion: process.env.BACKUP_CLOUD_REGION || process.env.AWS_REGION || 'ap-southeast-2',
    cloudAccessKey: process.env.BACKUP_CLOUD_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID,
    cloudSecretKey: process.env.BACKUP_CLOUD_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    cloudEndpoint: process.env.BACKUP_CLOUD_ENDPOINT,
    
    // Scheduling
    scheduleEnabled: process.env.BACKUP_SCHEDULE_ENABLED === 'true',
    scheduleCron: process.env.BACKUP_SCHEDULE_CRON || '0 2 * * *', // 2 AM daily
    
    // Notifications
    notificationWebhook: process.env.BACKUP_NOTIFICATION_WEBHOOK,
    emailRecipients: process.env.BACKUP_EMAIL_RECIPIENTS?.split(','),
  } as BackupConfig;
}

// Backup class
class DatabaseBackup {
  private config: BackupConfig;
  private s3Client?: S3Client;

  constructor(config: BackupConfig) {
    this.config = config;
    
    // Initialize S3 client if cloud backup is enabled
    if (config.cloudEnabled) {
      this.s3Client = new S3Client({
        region: config.cloudRegion,
        credentials: {
          accessKeyId: config.cloudAccessKey!,
          secretAccessKey: config.cloudSecretKey!,
        },
        endpoint: config.cloudEndpoint,
      });
    }
  }

  // Generate backup filename
  private generateBackupFilename(includeExtensions = true): string {
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    const base = `backup-${this.config.databaseName}-${timestamp}`;
    return includeExtensions ? `${base}.sql.gz.enc` : base;
  }

  // Create backup directory
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.backupDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create backup directory: ${error}`);
    }
  }

  // Perform database dump
  private async dumpDatabase(outputPath: string): Promise<void> {
    console.log(chalk.blue('📦 Creating database dump...'));
    
    const pgDumpCommand = [
      'pg_dump',
      `--host=${this.config.host}`,
      `--port=${this.config.port}`,
      `--username=${this.config.username}`,
      `--dbname=${this.config.databaseName}`,
      '--no-password',
      '--verbose',
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '--exclude-schema=_timescaledb*', // Exclude TimescaleDB internal schemas if present
      `--file=${outputPath}`,
    ].join(' ');

    try {
      const env = {
        ...process.env,
        PGPASSWORD: this.config.password,
      };
      
      await execAsync(pgDumpCommand, { env });
      console.log(chalk.green('✓ Database dump completed'));
    } catch (error) {
      throw new Error(`Database dump failed: ${error}`);
    }
  }

  // Compress backup
  private async compressBackup(inputPath: string, outputPath: string): Promise<void> {
    console.log(chalk.blue('🗜️  Compressing backup...'));
    
    const gzip = zlib.createGzip({
      level: this.config.compressionLevel,
    });
    
    await pipeline(
      createReadStream(inputPath),
      gzip,
      createWriteStream(outputPath)
    );
    
    // Remove uncompressed file
    await fs.unlink(inputPath);
    
    console.log(chalk.green('✓ Compression completed'));
  }

  // Encrypt backup
  private async encryptBackup(inputPath: string, outputPath: string): Promise<void> {
    console.log(chalk.blue('🔐 Encrypting backup...'));
    
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    const input = createReadStream(inputPath);
    const output = createWriteStream(outputPath);
    
    // Write IV and auth tag to the beginning of the file
    output.write(iv);
    
    await pipeline(input, cipher, output);
    
    // Append auth tag
    const authTag = cipher.getAuthTag();
    await fs.appendFile(outputPath, authTag);
    
    // Remove unencrypted file
    await fs.unlink(inputPath);
    
    console.log(chalk.green('✓ Encryption completed'));
  }

  // Decrypt backup
  private async decryptBackup(inputPath: string, outputPath: string): Promise<void> {
    console.log(chalk.blue('🔓 Decrypting backup...'));
    
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
    
    const fileContent = await fs.readFile(inputPath);
    const iv = fileContent.slice(0, 16);
    const authTag = fileContent.slice(-16);
    const encrypted = fileContent.slice(16, -16);
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    await fs.writeFile(outputPath, decrypted);
    
    console.log(chalk.green('✓ Decryption completed'));
  }

  // Upload to cloud storage
  private async uploadToCloud(filePath: string, fileName: string): Promise<void> {
    if (!this.config.cloudEnabled || !this.s3Client) {
      return;
    }
    
    console.log(chalk.blue('☁️  Uploading to cloud storage...'));
    
    try {
      const fileContent = await fs.readFile(filePath);
      
      const command = new PutObjectCommand({
        Bucket: this.config.cloudBucket!,
        Key: `database-backups/${fileName}`,
        Body: fileContent,
        ContentType: 'application/octet-stream',
        ServerSideEncryption: 'AES256',
        Metadata: {
          'backup-date': new Date().toISOString(),
          'database-name': this.config.databaseName,
          'backup-type': 'postgresql',
        },
      });
      
      await this.s3Client.send(command);
      console.log(chalk.green('✓ Cloud upload completed'));
    } catch (error) {
      throw new Error(`Cloud upload failed: ${error}`);
    }
  }

  // Clean old backups
  private async cleanOldBackups(): Promise<void> {
    console.log(chalk.blue('🧹 Cleaning old backups...'));
    
    const files = await fs.readdir(this.config.backupDir);
    const backupFiles = files
      .filter(f => f.startsWith('backup-') && f.endsWith('.sql.gz.enc'))
      .map(f => ({
        name: f,
        path: path.join(this.config.backupDir, f),
      }));
    
    // Sort by modification time
    const fileStats = await Promise.all(
      backupFiles.map(async (file) => ({
        ...file,
        mtime: (await fs.stat(file.path)).mtime,
      }))
    );
    
    fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    
    // Remove old backups based on retention policy
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    
    let removed = 0;
    for (let i = 0; i < fileStats.length; i++) {
      const file = fileStats[i];
      
      // Keep at least maxBackups regardless of age
      if (i < this.config.maxBackups && file.mtime > cutoffDate) {
        continue;
      }
      
      // Remove if too old or exceeds max count
      if (file.mtime < cutoffDate || i >= this.config.maxBackups) {
        await fs.unlink(file.path);
        removed++;
        console.log(chalk.yellow(`  Removed: ${file.name}`));
      }
    }
    
    console.log(chalk.green(`✓ Cleaned ${removed} old backups`));
  }

  // Send notification
  private async sendNotification(success: boolean, details: string): Promise<void> {
    if (!this.config.notificationWebhook) {
      return;
    }
    
    try {
      const payload = {
        text: success
          ? `✅ Database backup completed successfully`
          : `❌ Database backup failed`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: success
                ? `*Database Backup Successful*\n${details}`
                : `*Database Backup Failed*\n${details}`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Database: ${this.config.databaseName} | Time: ${new Date().toISOString()}`,
              },
            ],
          },
        ],
      };
      
      await fetch(this.config.notificationWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      logger.error('Failed to send notification:', error);
    }
  }

  // Main backup process
  async backup(): Promise<string> {
    const startTime = Date.now();
    await this.ensureBackupDirectory();
    
    const filename = this.generateBackupFilename(false);
    const sqlPath = path.join(this.config.backupDir, `${filename}.sql`);
    const gzPath = path.join(this.config.backupDir, `${filename}.sql.gz`);
    const encPath = path.join(this.config.backupDir, `${filename}.sql.gz.enc`);
    
    try {
      // 1. Dump database
      await this.dumpDatabase(sqlPath);
      
      // 2. Compress
      await this.compressBackup(sqlPath, gzPath);
      
      // 3. Encrypt
      await this.encryptBackup(gzPath, encPath);
      
      // 4. Upload to cloud
      await this.uploadToCloud(encPath, `${filename}.sql.gz.enc`);
      
      // 5. Clean old backups
      await this.cleanOldBackups();
      
      // 6. Get file size
      const stats = await fs.stat(encPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      const details = `Backup size: ${sizeMB} MB | Duration: ${duration}s | File: ${filename}.sql.gz.enc`;
      
      console.log(chalk.green(`\n✅ Backup completed successfully!`));
      console.log(chalk.gray(details));
      
      await this.sendNotification(true, details);
      
      return encPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n❌ Backup failed: ${errorMessage}`));
      
      await this.sendNotification(false, errorMessage);
      
      // Cleanup partial files
      for (const path of [sqlPath, gzPath, encPath]) {
        try {
          await fs.unlink(path);
        } catch {}
      }
      
      throw error;
    }
  }

  // Restore from backup
  async restore(backupFile: string): Promise<void> {
    console.log(chalk.blue(`\n🔄 Restoring from backup: ${backupFile}`));
    
    const tempDir = path.join(this.config.backupDir, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const encPath = path.join(this.config.backupDir, backupFile);
    const gzPath = path.join(tempDir, 'restore.sql.gz');
    const sqlPath = path.join(tempDir, 'restore.sql');
    
    try {
      // 1. Decrypt
      await this.decryptBackup(encPath, gzPath);
      
      // 2. Decompress
      console.log(chalk.blue('📦 Decompressing backup...'));
      await pipeline(
        createReadStream(gzPath),
        zlib.createGunzip(),
        createWriteStream(sqlPath)
      );
      console.log(chalk.green('✓ Decompression completed'));
      
      // 3. Restore to database
      console.log(chalk.blue('🔄 Restoring to database...'));
      console.log(chalk.yellow('⚠️  WARNING: This will overwrite the current database!'));
      
      // Add confirmation prompt here in production
      
      const psqlCommand = [
        'psql',
        `--host=${this.config.host}`,
        `--port=${this.config.port}`,
        `--username=${this.config.username}`,
        `--dbname=${this.config.databaseName}`,
        '--no-password',
        `--file=${sqlPath}`,
      ].join(' ');
      
      const env = {
        ...process.env,
        PGPASSWORD: this.config.password,
      };
      
      await execAsync(psqlCommand, { env });
      
      console.log(chalk.green('✓ Database restored successfully!'));
      
      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Cleanup on error
      await fs.rm(tempDir, { recursive: true, force: true });
      throw new Error(`Restore failed: ${error}`);
    }
  }

  // List available backups
  async listBackups(): Promise<void> {
    console.log(chalk.blue('\n📋 Available backups:\n'));
    
    // Local backups
    const files = await fs.readdir(this.config.backupDir);
    const backupFiles = files
      .filter(f => f.startsWith('backup-') && f.endsWith('.sql.gz.enc'))
      .sort()
      .reverse();
    
    if (backupFiles.length === 0) {
      console.log(chalk.yellow('No local backups found'));
    } else {
      console.log(chalk.white('Local backups:'));
      for (const file of backupFiles) {
        const stats = await fs.stat(path.join(this.config.backupDir, file));
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        const date = format(stats.mtime, 'yyyy-MM-dd HH:mm:ss');
        console.log(chalk.gray(`  ${file} (${sizeMB} MB) - ${date}`));
      }
    }
    
    // Cloud backups
    if (this.config.cloudEnabled && this.s3Client) {
      console.log(chalk.white('\nCloud backups:'));
      
      try {
        const command = new ListObjectsV2Command({
          Bucket: this.config.cloudBucket!,
          Prefix: 'database-backups/',
          MaxKeys: 20,
        });
        
        const response = await this.s3Client.send(command);
        
        if (!response.Contents || response.Contents.length === 0) {
          console.log(chalk.yellow('No cloud backups found'));
        } else {
          for (const obj of response.Contents) {
            const sizeMB = ((obj.Size || 0) / 1024 / 1024).toFixed(2);
            const date = format(obj.LastModified!, 'yyyy-MM-dd HH:mm:ss');
            const name = obj.Key!.replace('database-backups/', '');
            console.log(chalk.gray(`  ${name} (${sizeMB} MB) - ${date}`));
          }
        }
      } catch (error) {
        console.log(chalk.red(`Failed to list cloud backups: ${error}`));
      }
    }
  }

  // Setup automated scheduling
  setupSchedule(): void {
    if (!this.config.scheduleEnabled) {
      console.log(chalk.yellow('⚠️  Scheduled backups are disabled'));
      return;
    }
    
    console.log(chalk.blue(`⏰ Setting up scheduled backups: ${this.config.scheduleCron}`));
    
    const task = cron.schedule(this.config.scheduleCron, async () => {
      console.log(chalk.blue(`\n🕐 Running scheduled backup at ${new Date().toISOString()}`));
      
      try {
        await this.backup();
      } catch (error) {
        logger.error('Scheduled backup failed:', error);
      }
    });
    
    task.start();
    
    console.log(chalk.green('✓ Backup schedule activated'));
    console.log(chalk.gray('Press Ctrl+C to stop the scheduler'));
    
    // Keep the process running
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n⏹️  Stopping backup scheduler...'));
      task.stop();
      process.exit(0);
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const config = loadConfig();
  const backup = new DatabaseBackup(config);
  
  console.log(chalk.blue.bold('\n🗄️  PostgreSQL Backup Tool\n'));
  
  try {
    if (args.includes('--schedule')) {
      backup.setupSchedule();
    } else if (args.includes('--restore')) {
      const fileIndex = args.indexOf('--file');
      if (fileIndex === -1 || !args[fileIndex + 1]) {
        console.error(chalk.red('Please specify a backup file with --file <filename>'));
        process.exit(1);
      }
      await backup.restore(args[fileIndex + 1]);
    } else if (args.includes('--list')) {
      await backup.listBackups();
    } else if (args.includes('--cleanup')) {
      // Manual cleanup
      const backupDir = config.backupDir;
      const files = await fs.readdir(backupDir);
      const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.sql.gz.enc'));
      
      console.log(chalk.yellow(`Found ${backupFiles.length} backup files`));
      // Implement cleanup logic
    } else {
      // Default: perform backup
      await backup.backup();
    }
  } catch (error) {
    console.error(chalk.red(`\nError: ${error}`));
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { DatabaseBackup, BackupConfig };