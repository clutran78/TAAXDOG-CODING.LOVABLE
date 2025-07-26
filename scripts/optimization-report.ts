#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

console.log('📊 Bundle Optimization Report\n');
console.log('='.repeat(50));

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to get directory size
function getDirectorySize(dir: string): number {
  let totalSize = 0;
  
  try {
    const files = readdirSync(dir);
    
    for (const file of files) {
      const filePath = join(dir, file);
      const stats = statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    // Ignore errors for inaccessible directories
  }
  
  return totalSize;
}

// 1. Check build output size
console.log('\n📦 Build Output Analysis:');
console.log('-'.repeat(30));

const nextDir = join(process.cwd(), '.next');
if (existsSync(nextDir)) {
  const buildSize = getDirectorySize(nextDir);
  console.log(`Total .next directory: ${formatBytes(buildSize)}`);
  
  // Check static files
  const staticDir = join(nextDir, 'static');
  if (existsSync(staticDir)) {
    const staticSize = getDirectorySize(staticDir);
    console.log(`Static files: ${formatBytes(staticSize)}`);
  }
  
  // Check server files
  const serverDir = join(nextDir, 'server');
  if (existsSync(serverDir)) {
    const serverSize = getDirectorySize(serverDir);
    console.log(`Server files: ${formatBytes(serverSize)}`);
  }
} else {
  console.log('⚠️  No build found. Run "npm run build" first.');
}

// 2. Analyze package.json for heavy dependencies
console.log('\n📚 Dependency Analysis:');
console.log('-'.repeat(30));

try {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const heavyPackages = [
    '@mui/material',
    'recharts',
    'd3',
    'moment',
    'lodash',
    '@sentry/nextjs',
    'react-pdf',
  ];
  
  console.log('Heavy packages found:');
  heavyPackages.forEach(pkg => {
    if (deps[pkg]) {
      console.log(`  - ${pkg}: ${deps[pkg]}`);
    }
  });
} catch (error) {
  console.log('❌ Failed to analyze package.json');
}

// 3. Check for optimization opportunities
console.log('\n🎯 Optimization Opportunities:');
console.log('-'.repeat(30));

const optimizations = [
  {
    name: 'Dynamic Imports',
    check: () => {
      const lazyDir = join(process.cwd(), 'components/lazy');
      return existsSync(lazyDir) ? '✅ Implemented' : '❌ Not found';
    },
  },
  {
    name: 'Image Optimization',
    check: () => {
      const config = readFileSync('next.config.js', 'utf-8');
      return config.includes('images:') ? '✅ Configured' : '❌ Not configured';
    },
  },
  {
    name: 'Bundle Analyzer',
    check: () => {
      const config = readFileSync('next.config.js', 'utf-8');
      return config.includes('BundleAnalyzerPlugin') ? '✅ Available' : '❌ Not configured';
    },
  },
  {
    name: 'Compression',
    check: () => {
      const config = readFileSync('next.config.js', 'utf-8');
      return config.includes('CompressionPlugin') ? '✅ Enabled' : '❌ Not enabled';
    },
  },
  {
    name: 'SWC Minification',
    check: () => {
      const config = readFileSync('next.config.js', 'utf-8');
      return config.includes('swcMinify: true') ? '✅ Enabled' : '❌ Not enabled';
    },
  },
];

optimizations.forEach(opt => {
  try {
    console.log(`${opt.name}: ${opt.check()}`);
  } catch (error) {
    console.log(`${opt.name}: ❓ Unable to check`);
  }
});

// 4. Performance recommendations
console.log('\n💡 Recommendations:');
console.log('-'.repeat(30));

const recommendations = [
  'Use "npm run analyze-bundle" to identify large modules',
  'Implement lazy loading for heavy components',
  'Consider removing unused dependencies',
  'Enable gzip/brotli compression on your server',
  'Use Next.js Image component for all images',
  'Implement resource hints (prefetch, preload)',
  'Monitor Core Web Vitals in production',
];

recommendations.forEach((rec, index) => {
  console.log(`${index + 1}. ${rec}`);
});

console.log('\n✅ Optimization report complete!');
console.log('='.repeat(50));