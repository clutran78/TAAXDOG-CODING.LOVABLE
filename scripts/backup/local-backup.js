#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function createLocalBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');
  const backupFile = path.join(backupDir, `taaxdog-backup-${timestamp}.sql`);
  const encryptedFile = `${backupFile}.enc`;
  
  // Create backup directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  console.log('🔄 Creating local database backup...');
  console.log(`Backup location: ${backupFile}`);
  
  try {
    // Get database URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not found in environment');
    }
    
    // Create database dump
    console.log('📦 Dumping database...');
    const dumpCommand = `pg_dump "${dbUrl}" --no-owner --no-privileges --if-exists --clean > "${backupFile}"`;
    await execAsync(dumpCommand);
    
    // Get file size
    const stats = fs.statSync(backupFile);
    console.log(`✅ Database backup created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Encrypt backup if encryption key is available
    if (process.env.BACKUP_ENCRYPTION_KEY) {
      console.log('🔒 Encrypting backup...');
      const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(process.env.BACKUP_ENCRYPTION_KEY, 'hex'),
        Buffer.alloc(16, 0) // IV
      );
      
      const input = fs.createReadStream(backupFile);
      const output = fs.createWriteStream(encryptedFile);
      
      await new Promise((resolve, reject) => {
        input.pipe(cipher).pipe(output);
        output.on('finish', resolve);
        output.on('error', reject);
      });
      
      // Remove unencrypted file
      fs.unlinkSync(backupFile);
      console.log('✅ Backup encrypted successfully');
      
      return encryptedFile;
    }
    
    return backupFile;
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    
    // Clean up failed backup
    if (fs.existsSync(backupFile)) {
      fs.unlinkSync(backupFile);
    }
    if (fs.existsSync(encryptedFile)) {
      fs.unlinkSync(encryptedFile);
    }
    
    throw error;
  }
}

async function listLocalBackups() {
  const backupDir = path.join(process.cwd(), 'backups');
  
  if (!fs.existsSync(backupDir)) {
    console.log('No backups found');
    return;
  }
  
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('taaxdog-backup-'))
    .sort()
    .reverse();
    
  console.log('\n📁 Local Backups:');
  files.forEach(file => {
    const stats = fs.statSync(path.join(backupDir, file));
    const size = (stats.size / 1024 / 1024).toFixed(2);
    const date = stats.mtime.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });
    console.log(`  - ${file} (${size} MB) - ${date}`);
  });
  
  // Check disk space
  const { stdout } = await execAsync('df -h .');
  console.log('\n💾 Disk Usage:');
  console.log(stdout);
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  if (command === 'list') {
    await listLocalBackups();
  } else {
    const backupFile = await createLocalBackup();
    console.log('\n✅ Backup completed:', backupFile);
    console.log('\n⚠️  Note: This is a local backup. For production, configure AWS S3 for remote backups.');
    await listLocalBackups();
  }
}

main().catch(error => {
  console.error('Backup operation failed:', error);
  process.exit(1);
});