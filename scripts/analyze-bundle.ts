#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🔍 Analyzing bundle size...\n');

// Build with bundle analyzer
console.log('Building application with bundle analyzer...');
try {
  execSync('ANALYZE=true npm run build', { 
    stdio: 'inherit',
    env: { ...process.env, ANALYZE: 'true' }
  });
  
  console.log('\n✅ Bundle analysis complete!');
  console.log('📊 Open ./analyze.html to view the bundle analysis');
} catch (error) {
  console.error('❌ Failed to analyze bundle:', error);
  process.exit(1);
}

// Get build size stats
try {
  const buildManifest = JSON.parse(
    readFileSync(join(process.cwd(), '.next/build-manifest.json'), 'utf-8')
  );
  
  console.log('\n📦 Build Stats:');
  console.log('Pages:', Object.keys(buildManifest.pages).length);
  
  // Calculate total JS size
  let totalSize = 0;
  const chunks = new Set<string>();
  
  Object.values(buildManifest.pages).forEach((files: any) => {
    files.forEach((file: string) => {
      if (file.endsWith('.js')) {
        chunks.add(file);
      }
    });
  });
  
  console.log('Unique JS chunks:', chunks.size);
  
} catch (error) {
  console.log('Could not read build manifest');
}