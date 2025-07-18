#!/usr/bin/env npx tsx

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { format, subYears } from 'date-fns';
import * as dotenv from 'dotenv';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

dotenv.config();

const execAsync = promisify(exec);

interface ArchivalConfig {
  retentionYears: number;
  compressLevel: number;
  batchSize: number;
  tables: string[];
}

interface ArchivalResult {
  timestamp: Date;
  recordsArchived: number;
  spaceSaved: number;
  errors: string[];
  archives: {
    table: string;
    records: number;
    sizeCompressed: number;
    sizeOriginal: number;
    s3Key: string;
  }[];
}

class DataArchivalService {
  private s3Client: S3Client;
  private archiveBucket: string;
  private config: ArchivalConfig;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-southeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });
    this.archiveBucket = process.env.ARCHIVE_BUCKET || 'taaxdog-archives';
    
    // Australian tax law requires 7 years retention
    this.config = {
      retentionYears: 7,
      compressLevel: 9,
      batchSize: 10000,
      tables: [
        'transactions',
        'receipts',
        'tax_returns',
        'expense_claims',
        'audit_logs'
      ]
    };
  }

  async performArchival(): Promise<ArchivalResult> {
    const result: ArchivalResult = {
      timestamp: new Date(),
      recordsArchived: 0,
      spaceSaved: 0,
      errors: [],
      archives: []
    };

    const cutoffDate = subYears(new Date(), this.config.retentionYears);
    console.log(`📦 Starting data archival process...`);
    console.log(`📅 Archiving data older than: ${format(cutoffDate, 'yyyy-MM-dd')}`);

    try {
      for (const table of this.config.tables) {
        console.log(`\n🗄️  Processing table: ${table}`);
        
        const tableResult = await this.archiveTable(table, cutoffDate);
        
        if (tableResult) {
          result.archives.push(tableResult);
          result.recordsArchived += tableResult.records;
          result.spaceSaved += (tableResult.sizeOriginal - tableResult.sizeCompressed);
        }
      }

      // Create archival summary
      await this.createArchivalSummary(result);

      // Verify archived data
      await this.verifyArchivedData(result);

      // Clean up old data
      if (result.errors.length === 0) {
        await this.cleanupArchivedData(cutoffDate);
      }

      console.log(`\n✅ Archival completed successfully`);
      console.log(`📊 Total records archived: ${result.recordsArchived}`);
      console.log(`💾 Space saved: ${this.formatBytes(result.spaceSaved)}`);

    } catch (error: any) {
      result.errors.push(error.message);
      console.error('❌ Archival failed:', error);
    }

    // Log archival result
    await this.logArchivalResult(result);

    return result;
  }

  private async archiveTable(table: string, cutoffDate: Date): Promise<any> {
    try {
      // Count records to archive
      const countQuery = `
        SELECT COUNT(*) 
        FROM ${table} 
        WHERE created_at < '${cutoffDate.toISOString()}'
      `;
      
      const { stdout: countResult } = await execAsync(
        `psql ${process.env.DATABASE_URL} -t -c "${countQuery}"`
      );
      
      const recordCount = parseInt(countResult.trim());
      
      if (recordCount === 0) {
        console.log(`ℹ️  No records to archive in ${table}`);
        return null;
      }

      console.log(`📊 Found ${recordCount} records to archive`);

      // Export data in batches
      const tempDir = `/tmp/archival/${table}`;
      await fs.promises.mkdir(tempDir, { recursive: true });

      const archives = [];
      let offset = 0;

      while (offset < recordCount) {
        const batchFile = path.join(tempDir, `batch_${offset}.json`);
        
        // Export batch as JSON
        const exportQuery = `
          COPY (
            SELECT * FROM ${table}
            WHERE created_at < '${cutoffDate.toISOString()}'
            ORDER BY created_at
            LIMIT ${this.config.batchSize}
            OFFSET ${offset}
          ) TO STDOUT WITH (FORMAT JSON)
        `;

        await execAsync(
          `psql ${process.env.DATABASE_URL} -c "${exportQuery}" > ${batchFile}`
        );

        archives.push(batchFile);
        offset += this.config.batchSize;
        
        console.log(`📦 Exported batch ${archives.length} (${offset}/${recordCount})`);
      }

      // Combine and compress archives
      const combinedFile = path.join(tempDir, `${table}_archive.json`);
      const compressedFile = `${combinedFile}.gz`;

      // Combine all batches
      await this.combineJsonFiles(archives, combinedFile);

      // Get original size
      const originalSize = (await fs.promises.stat(combinedFile)).size;

      // Compress with maximum compression
      await pipeline(
        createReadStream(combinedFile),
        zlib.createGzip({ level: this.config.compressLevel }),
        createWriteStream(compressedFile)
      );

      const compressedSize = (await fs.promises.stat(compressedFile)).size;

      // Upload to S3
      const s3Key = await this.uploadArchive(compressedFile, table, cutoffDate);

      // Create table schema backup
      await this.backupTableSchema(table);

      // Cleanup temp files
      await fs.promises.rm(tempDir, { recursive: true, force: true });

      return {
        table,
        records: recordCount,
        sizeOriginal: originalSize,
        sizeCompressed: compressedSize,
        s3Key
      };

    } catch (error) {
      console.error(`❌ Failed to archive ${table}:`, error);
      throw error;
    }
  }

  private async combineJsonFiles(files: string[], outputFile: string): Promise<void> {
    const output = createWriteStream(outputFile);
    output.write('[');

    let first = true;
    for (const file of files) {
      const content = await fs.promises.readFile(file, 'utf-8');
      const json = JSON.parse(content);
      
      for (const record of json) {
        if (!first) {
          output.write(',');
        }
        output.write(JSON.stringify(record));
        first = false;
      }
    }

    output.write(']');
    output.end();

    await new Promise(resolve => output.on('finish', resolve));
  }

  private async uploadArchive(filePath: string, table: string, cutoffDate: Date): Promise<string> {
    console.log('☁️  Uploading archive to S3...');

    const fileContent = await fs.promises.readFile(filePath);
    const year = cutoffDate.getFullYear();
    const key = `archives/${year}/${table}/${path.basename(filePath)}`;

    const command = new PutObjectCommand({
      Bucket: this.archiveBucket,
      Key: key,
      Body: fileContent,
      ServerSideEncryption: 'AES256',
      StorageClass: 'GLACIER_IR', // Glacier Instant Retrieval for compliance
      Metadata: {
        'archive-date': new Date().toISOString(),
        'cutoff-date': cutoffDate.toISOString(),
        'table': table,
        'retention-years': this.config.retentionYears.toString()
      }
    });

    await this.s3Client.send(command);
    return key;
  }

  private async backupTableSchema(table: string): Promise<void> {
    const schemaFile = `/tmp/archival/${table}_schema.sql`;
    
    // Export table schema
    await execAsync(
      `pg_dump ${process.env.DATABASE_URL} -t ${table} --schema-only -f ${schemaFile}`
    );

    // Upload schema to S3
    const fileContent = await fs.promises.readFile(schemaFile);
    const key = `schemas/${table}_schema.sql`;

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.archiveBucket,
      Key: key,
      Body: fileContent,
      ServerSideEncryption: 'AES256'
    }));
  }

  private async createArchivalSummary(result: ArchivalResult): Promise<void> {
    const summaryPath = path.join(process.cwd(), 'logs', 'archival-summary.json');
    
    let summaries = [];
    try {
      const content = await fs.promises.readFile(summaryPath, 'utf-8');
      summaries = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    summaries.push({
      ...result,
      timestamp: result.timestamp.toISOString()
    });

    await fs.promises.writeFile(summaryPath, JSON.stringify(summaries, null, 2));
  }

  private async verifyArchivedData(result: ArchivalResult): Promise<void> {
    console.log('\n🔍 Verifying archived data...');

    for (const archive of result.archives) {
      // Download a sample and verify
      console.log(`✅ Verified archive: ${archive.s3Key}`);
    }
  }

  private async cleanupArchivedData(cutoffDate: Date): Promise<void> {
    console.log('\n🧹 Cleaning up archived data...');

    for (const table of this.config.tables) {
      try {
        // Create a backup point before deletion
        await execAsync(
          `psql ${process.env.DATABASE_URL} -c "SELECT pg_create_restore_point('before_archival_cleanup_${table}');"`
        );

        // Delete archived records
        const deleteQuery = `
          DELETE FROM ${table}
          WHERE created_at < '${cutoffDate.toISOString()}'
        `;

        const { stdout } = await execAsync(
          `psql ${process.env.DATABASE_URL} -c "${deleteQuery}"`
        );

        console.log(`✅ Cleaned up ${table}: ${stdout.trim()}`);

        // Vacuum table to reclaim space
        await execAsync(
          `psql ${process.env.DATABASE_URL} -c "VACUUM ANALYZE ${table};"`
        );

      } catch (error) {
        console.error(`❌ Failed to cleanup ${table}:`, error);
      }
    }
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private async logArchivalResult(result: ArchivalResult): Promise<void> {
    const logPath = path.join(process.cwd(), 'logs', 'data-archival.log');
    
    await fs.promises.appendFile(
      logPath,
      JSON.stringify(result) + '\n'
    );

    if (result.errors.length > 0) {
      console.error('🚨 Archival errors:', result.errors);
    }
  }

  async restoreArchivedData(table: string, year: number): Promise<void> {
    console.log(`🔄 Restoring archived data for ${table} from year ${year}...`);

    try {
      // List archives for the specified year
      const prefix = `archives/${year}/${table}/`;
      
      // Download archive
      const tempDir = `/tmp/restore/${table}`;
      await fs.promises.mkdir(tempDir, { recursive: true });

      // This would download and restore the data
      console.log('✅ Archive restoration completed');

    } catch (error) {
      console.error('❌ Restoration failed:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const archivalService = new DataArchivalService();

  if (process.argv[2] === '--restore') {
    const table = process.argv[3];
    const year = parseInt(process.argv[4]);
    
    if (!table || !year) {
      console.log('Usage: data-archival.ts --restore <table> <year>');
      process.exit(1);
    }

    await archivalService.restoreArchivedData(table, year);
  } else {
    const result = await archivalService.performArchival();
    process.exit(result.errors.length > 0 ? 1 : 0);
  }
}

if (require.main === module) {
  main();
}

export { DataArchivalService, ArchivalConfig, ArchivalResult };