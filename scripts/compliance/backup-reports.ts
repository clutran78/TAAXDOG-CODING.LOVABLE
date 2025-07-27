#!/usr/bin/env ts-node

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { format } from 'date-fns';

const execAsync = promisify(exec);

/**
 * Backup compliance reports to secure storage
 * This script runs weekly to ensure reports are safely archived
 */
async function backupComplianceReports() {
  console.log('Starting compliance reports backup...');

  try {
    const reportsDir = path.join(process.cwd(), 'compliance-reports');
    const backupDir = path.join(process.cwd(), 'backups', 'compliance');
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');

    // Ensure directories exist
    await fs.mkdir(backupDir, { recursive: true });

    // Check if reports directory exists
    try {
      await fs.access(reportsDir);
    } catch {
      console.log('No compliance reports directory found. Nothing to backup.');
      return;
    }

    // Get list of report files
    const files = await fs.readdir(reportsDir);
    const reportFiles = files.filter((f) => f.endsWith('.json'));

    if (reportFiles.length === 0) {
      console.log('No report files found to backup.');
      return;
    }

    console.log(`Found ${reportFiles.length} report files to backup`);

    // Create archive
    const archiveName = `compliance-reports-${timestamp}.tar.gz`;
    const archivePath = path.join(backupDir, archiveName);

    // Create tar.gz archive
    const tarCommand = `tar -czf "${archivePath}" -C "${reportsDir}" ${reportFiles.join(' ')}`;
    await execAsync(tarCommand);

    console.log(`✅ Created archive: ${archiveName}`);

    // Verify archive
    const { stdout } = await execAsync(`tar -tzf "${archivePath}" | wc -l`);
    const fileCount = parseInt(stdout.trim());

    if (fileCount !== reportFiles.length) {
      throw new Error('Archive verification failed: file count mismatch');
    }

    console.log(`✅ Archive verified: ${fileCount} files`);

    // In production, upload to secure cloud storage
    if (process.env.NODE_ENV === 'production') {
      await uploadToSecureStorage(archivePath, archiveName);
    }

    // Clean up old local backups (keep last 4 weeks)
    await cleanupOldBackups(backupDir);

    // Create backup manifest
    const manifest = {
      backupDate: new Date().toISOString(),
      archiveName,
      fileCount: reportFiles.length,
      files: reportFiles,
      size: (await fs.stat(archivePath)).size,
      checksumCmd: `sha256sum "${archivePath}"`,
    };

    const manifestPath = path.join(backupDir, `manifest-${timestamp}.json`);
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    console.log('\n📊 Backup Summary:');
    console.log(`- Files backed up: ${reportFiles.length}`);
    console.log(`- Archive size: ${(manifest.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Location: ${archivePath}`);
    console.log(`- Manifest: ${manifestPath}`);
  } catch (error) {
    console.error('Backup error:', error);
    process.exit(1);
  }
}

async function uploadToSecureStorage(archivePath: string, archiveName: string) {
  // In production, this would upload to:
  // - AWS S3 with server-side encryption
  // - Azure Blob Storage with encryption
  // - Google Cloud Storage with customer-managed encryption keys

  console.log('🔒 Would upload to secure cloud storage in production');

  // Example S3 upload (requires AWS SDK):
  /*
  const s3 = new AWS.S3({
    region: 'ap-southeast-2', // Sydney region
  });
  
  await s3.upload({
    Bucket: process.env.COMPLIANCE_BACKUP_BUCKET,
    Key: `compliance-reports/${archiveName}`,
    Body: await fs.readFile(archivePath),
    ServerSideEncryption: 'aws:kms',
    SSEKMSKeyId: process.env.COMPLIANCE_KMS_KEY_ID,
  }).promise();
  */
}

async function cleanupOldBackups(backupDir: string) {
  try {
    const files = await fs.readdir(backupDir);
    const archives = files.filter(
      (f) => f.startsWith('compliance-reports-') && f.endsWith('.tar.gz'),
    );

    const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const archive of archives) {
      const filePath = path.join(backupDir, archive);
      const stats = await fs.stat(filePath);

      if (stats.mtime.getTime() < fourWeeksAgo) {
        await fs.unlink(filePath);
        deletedCount++;

        // Also delete associated manifest
        const manifestName = archive
          .replace('.tar.gz', '.json')
          .replace('compliance-reports-', 'manifest-');
        try {
          await fs.unlink(path.join(backupDir, manifestName));
        } catch {
          // Manifest might not exist
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`🗑️  Cleaned up ${deletedCount} old backup(s)`);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
    // Don't fail the backup process due to cleanup errors
  }
}

// Run the backup
backupComplianceReports().catch(console.error);
