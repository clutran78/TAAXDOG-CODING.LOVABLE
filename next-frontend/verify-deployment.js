// Deployment verification script for TAAXDOG
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying TAAXDOG deployment configuration...');

// Check critical files exist
const criticalFiles = [
  'next.config.ts',
  'package.json',
  '.vercelignore',
  'src/app/page.tsx',
  'src/app/layout.tsx',
  'src/app/(auth)/dashboard/page.tsx',
  'src/app/(unauth)/login/page.tsx'
];

let allFilesExist = true;

criticalFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} MISSING`);
    allFilesExist = false;
  }
});

// Check next.config.ts configuration
const nextConfigPath = path.join(__dirname, 'next.config.ts');
if (fs.existsSync(nextConfigPath)) {
  const configContent = fs.readFileSync(nextConfigPath, 'utf8');
  if (configContent.includes('output: \'standalone\'')) {
    console.log('✅ Next.js standalone output configured');
  } else {
    console.log('❌ Missing standalone output configuration');
    allFilesExist = false;
  }
}

if (allFilesExist) {
  console.log('🎉 All deployment files verified successfully!');
  console.log('🚀 Ready for Vercel deployment');
} else {
  console.log('⚠️  Deployment verification failed - fix missing files');
  process.exit(1);
} 