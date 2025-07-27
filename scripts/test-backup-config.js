#!/usr/bin/env node

require('dotenv').config({ path: '.env.production' });

const { S3Client, ListBucketsCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

async function testBackupConfiguration() {
  console.log('🔍 Testing Backup Configuration\n');

  // Check environment variables
  console.log('Environment Check:');
  console.log('- AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing');
  console.log(
    '- AWS_SECRET_ACCESS_KEY:',
    process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing',
  );
  console.log('- AWS_REGION:', process.env.AWS_REGION || '❌ Missing (should be ap-southeast-2)');
  console.log('- BACKUP_BUCKET:', process.env.BACKUP_BUCKET || '❌ Missing');
  console.log('- ARCHIVE_BUCKET:', process.env.ARCHIVE_BUCKET || '❌ Missing');
  console.log(
    '- BACKUP_ENCRYPTION_KEY:',
    process.env.BACKUP_ENCRYPTION_KEY ? '✅ Set' : '❌ Missing',
  );

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('\n❌ AWS credentials are not configured');
    console.log('\nTo configure AWS S3 for backups:');
    console.log('1. Create an AWS account at https://aws.amazon.com');
    console.log('2. Create an IAM user with S3 permissions');
    console.log('3. Generate access keys for the IAM user');
    console.log('4. Add to .env.production:');
    console.log('   AWS_ACCESS_KEY_ID=your-access-key');
    console.log('   AWS_SECRET_ACCESS_KEY=your-secret-key');
    console.log('   AWS_REGION=ap-southeast-2');
    console.log('   BACKUP_BUCKET=taaxdog-backups');
    console.log('5. Create S3 buckets in Sydney region (ap-southeast-2)');
    process.exit(1);
  }

  // Test AWS connection
  try {
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-southeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    console.log('\n🔄 Testing AWS S3 connection...');

    // List buckets to verify credentials
    const listCommand = new ListBucketsCommand({});
    const buckets = await s3Client.send(listCommand);
    console.log('✅ AWS credentials are valid');
    console.log(`Found ${buckets.Buckets?.length || 0} buckets`);

    // Check specific backup bucket if configured
    if (process.env.BACKUP_BUCKET) {
      try {
        const headCommand = new HeadBucketCommand({ Bucket: process.env.BACKUP_BUCKET });
        await s3Client.send(headCommand);
        console.log(`✅ Backup bucket "${process.env.BACKUP_BUCKET}" exists and is accessible`);
      } catch (error) {
        if (error.name === 'NotFound') {
          console.error(`❌ Backup bucket "${process.env.BACKUP_BUCKET}" does not exist`);
          console.log(
            '  Create it with: aws s3 mb s3://' +
              process.env.BACKUP_BUCKET +
              ' --region ap-southeast-2',
          );
        } else {
          console.error(`❌ Cannot access backup bucket: ${error.message}`);
        }
      }
    }

    // Check archive bucket if configured
    if (process.env.ARCHIVE_BUCKET) {
      try {
        const headCommand = new HeadBucketCommand({ Bucket: process.env.ARCHIVE_BUCKET });
        await s3Client.send(headCommand);
        console.log(`✅ Archive bucket "${process.env.ARCHIVE_BUCKET}" exists and is accessible`);
      } catch (error) {
        if (error.name === 'NotFound') {
          console.error(`❌ Archive bucket "${process.env.ARCHIVE_BUCKET}" does not exist`);
          console.log(
            '  Create it with: aws s3 mb s3://' +
              process.env.ARCHIVE_BUCKET +
              ' --region ap-southeast-2',
          );
        } else {
          console.error(`❌ Cannot access archive bucket: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error('\n❌ AWS S3 connection failed:', error.message);
    console.log('\nPossible issues:');
    console.log('- Invalid AWS credentials');
    console.log('- Insufficient IAM permissions');
    console.log('- Network connectivity issues');
    process.exit(1);
  }

  // Production readiness check
  console.log('\n🏁 Production Readiness:');
  const isReady =
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION === 'ap-southeast-2' &&
    process.env.BACKUP_BUCKET &&
    process.env.BACKUP_ENCRYPTION_KEY;

  if (isReady) {
    console.log('✅ Backup system is ready for production');
  } else {
    console.log('❌ Backup system is NOT ready for production');
    console.log('\nRequired fixes:');
    if (!process.env.AWS_ACCESS_KEY_ID) console.log('  - Set AWS_ACCESS_KEY_ID');
    if (!process.env.AWS_SECRET_ACCESS_KEY) console.log('  - Set AWS_SECRET_ACCESS_KEY');
    if (process.env.AWS_REGION !== 'ap-southeast-2')
      console.log('  - Set AWS_REGION=ap-southeast-2');
    if (!process.env.BACKUP_BUCKET) console.log('  - Set BACKUP_BUCKET');
    if (!process.env.BACKUP_ENCRYPTION_KEY) console.log('  - Set BACKUP_ENCRYPTION_KEY');
  }

  // Encryption key validation
  if (process.env.BACKUP_ENCRYPTION_KEY) {
    if (process.env.BACKUP_ENCRYPTION_KEY.length !== 64) {
      console.log('\n⚠️  Warning: BACKUP_ENCRYPTION_KEY should be 32 bytes (64 hex characters)');
      console.log('  Current length:', process.env.BACKUP_ENCRYPTION_KEY.length);
      console.log('  Generate with: node scripts/generate-secure-keys.js');
    }
  }
}

testBackupConfiguration().catch(console.error);
