#!/usr/bin/env npx tsx

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { format } from 'date-fns';
import * as dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

interface BackupConfig {
  type: 'full' | 'incremental';
  retention: number; // days
  compress: boolean;
  encrypt: boolean;
}

class DatabaseBackupService {
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
    this.encryptionKey = process.env.BACKUP_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  }

  async performBackup(config: BackupConfig): Promise<string> {
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    const backupType = config.type;
    const fileName = `taaxdog-${backupType}-${timestamp}.sql`;
    const tempDir = '/tmp/backups';
    const filePath = path.join(tempDir, fileName);

    try {
      // Create temp directory
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Generate backup based on type
      if (config.type === 'full') {
        await this.createFullBackup(filePath);
      } else {
        await this.createIncrementalBackup(filePath, timestamp);
      }

      let finalPath = filePath;

      // Compress if enabled
      if (config.compress) {
        finalPath = await this.compressBackup(filePath);
      }

      // Encrypt if enabled
      if (config.encrypt) {
        finalPath = await this.encryptBackup(finalPath);
      }

      // Upload to S3
      const s3Key = await this.uploadToS3(finalPath, backupType, timestamp);

      // Create backup metadata
      await this.saveBackupMetadata({
        timestamp,
        type: backupType,
        size: (await fs.promises.stat(finalPath)).size,
        compressed: config.compress,
        encrypted: config.encrypt,
        s3Key,
        checksum: await this.calculateChecksum(finalPath)
      });

      // Cleanup temp files
      await this.cleanupTempFiles(tempDir);

      // Apply retention policy
      await this.applyRetentionPolicy(config.retention, backupType);

      console.log(`✅ ${backupType} backup completed: ${s3Key}`);
      return s3Key;

    } catch (error) {
      console.error(`❌ Backup failed: ${error}`);
      throw error;
    }
  }

  private async createFullBackup(filePath: string): Promise<void> {
    const connectionString = process.env.DATABASE_URL!;
    const pgDumpCommand = `pg_dump ${connectionString} --clean --if-exists --verbose -f ${filePath}`;
    
    console.log('📦 Creating full database backup...');
    const { stdout, stderr } = await execAsync(pgDumpCommand);
    if (stderr && !stderr.includes('warning')) {
      throw new Error(`pg_dump error: ${stderr}`);
    }
  }

  private async createIncrementalBackup(filePath: string, timestamp: string): Promise<void> {
    // For PostgreSQL, we'll use WAL archiving for incremental backups
    // This requires WAL archiving to be enabled in postgresql.conf
    const walArchiveDir = process.env.WAL_ARCHIVE_DIR || '/var/lib/postgresql/wal_archive';
    const lastBackupTime = await this.getLastBackupTime('incremental');
    
    console.log('📦 Creating incremental backup using WAL archives...');
    
    // Create a backup label
    const labelCommand = `psql ${process.env.DATABASE_URL} -c "SELECT pg_create_restore_point('backup_${timestamp}');"`;
    await execAsync(labelCommand);

    // Archive current WAL files
    const archiveCommand = `pg_archivecleanup -d ${walArchiveDir} ${lastBackupTime}`;
    await execAsync(archiveCommand);

    // Create tar of WAL files since last backup
    const tarCommand = `tar -czf ${filePath} -C ${walArchiveDir} --newer-mtime="${lastBackupTime}" .`;
    await execAsync(tarCommand);
  }

  private async compressBackup(filePath: string): Promise<string> {
    const compressedPath = `${filePath}.gz`;
    console.log('🗜️  Compressing backup...');
    
    await execAsync(`gzip -9 -c ${filePath} > ${compressedPath}`);
    await fs.promises.unlink(filePath);
    
    return compressedPath;
  }

  private async encryptBackup(filePath: string): Promise<string> {
    const encryptedPath = `${filePath}.enc`;
    console.log('🔐 Encrypting backup...');

    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(encryptedPath);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);

    // Write IV to the beginning of the file
    output.write(iv);

    await new Promise((resolve, reject) => {
      input
        .pipe(cipher)
        .pipe(output)
        .on('finish', resolve)
        .on('error', reject);
    });

    await fs.promises.unlink(filePath);
    return encryptedPath;
  }

  private async uploadToS3(filePath: string, backupType: string, timestamp: string): Promise<string> {
    console.log('☁️  Uploading to S3...');
    
    const fileContent = await fs.promises.readFile(filePath);
    const key = `backups/${backupType}/${timestamp}/${path.basename(filePath)}`;

    const command = new PutObjectCommand({
      Bucket: this.backupBucket,
      Key: key,
      Body: fileContent,
      ServerSideEncryption: 'AES256',
      StorageClass: backupType === 'full' ? 'STANDARD_IA' : 'STANDARD',
      Metadata: {
        'backup-type': backupType,
        'timestamp': timestamp,
        'retention-days': '30'
      }
    });

    await this.s3Client.send(command);
    return key;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  }

  private async saveBackupMetadata(metadata: any): Promise<void> {
    const metadataPath = path.join(process.cwd(), 'logs', 'backup-metadata.json');
    
    let existingMetadata = [];
    try {
      const content = await fs.promises.readFile(metadataPath, 'utf-8');
      existingMetadata = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    existingMetadata.push(metadata);
    await fs.promises.writeFile(metadataPath, JSON.stringify(existingMetadata, null, 2));
  }

  private async getLastBackupTime(type: string): Promise<string> {
    const metadataPath = path.join(process.cwd(), 'logs', 'backup-metadata.json');
    
    try {
      const content = await fs.promises.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(content);
      
      const lastBackup = metadata
        .filter((m: any) => m.type === type)
        .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))[0];
      
      return lastBackup ? lastBackup.timestamp : new Date(Date.now() - 86400000).toISOString();
    } catch {
      return new Date(Date.now() - 86400000).toISOString();
    }
  }

  private async applyRetentionPolicy(retentionDays: number, backupType: string): Promise<void> {
    console.log(`🗑️  Applying ${retentionDays}-day retention policy...`);
    
    const metadataPath = path.join(process.cwd(), 'logs', 'backup-metadata.json');
    const cutoffDate = new Date(Date.now() - retentionDays * 86400000);
    
    try {
      const content = await fs.promises.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(content);
      
      const toDelete = metadata.filter((m: any) => 
        m.type === backupType && new Date(m.timestamp) < cutoffDate
      );
      
      // Delete from S3
      for (const backup of toDelete) {
        // Implement S3 deletion
        console.log(`Deleting old backup: ${backup.s3Key}`);
      }
      
      // Update metadata
      const remaining = metadata.filter((m: any) => 
        !(m.type === backupType && new Date(m.timestamp) < cutoffDate)
      );
      
      await fs.promises.writeFile(metadataPath, JSON.stringify(remaining, null, 2));
    } catch {
      // No metadata file yet
    }
  }

  private async cleanupTempFiles(tempDir: string): Promise<void> {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp files:', error);
    }
  }
}

// Main execution
async function main() {
  const backupService = new DatabaseBackupService();
  const backupType = process.argv[2] as 'full' | 'incremental' || 'full';
  
  const config: BackupConfig = {
    type: backupType,
    retention: backupType === 'full' ? 30 : 7,
    compress: true,
    encrypt: true
  };

  try {
    await backupService.performBackup(config);
    process.exit(0);
  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DatabaseBackupService, BackupConfig };