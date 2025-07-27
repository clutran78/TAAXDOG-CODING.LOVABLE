#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger';

/**
 * Script to update API endpoints to use standardized response utilities
 * 
 * This script identifies common patterns and provides a report of files
 * that need manual updates to use the standardized apiResponse utility
 */

interface UpdateCandidate {
  file: string;
  patterns: string[];
  currentImport?: string;
}

const API_PATTERNS = [
  // Direct res.status().json() patterns
  /res\.status\(\d+\)\.json\(/g,
  /res\.status\((\d+)\)\.end\(/g,
  
  // Old response utilities
  /sendSuccess\(/g,
  /sendError\(/g,
  /sendUnauthorized\(/g,
  /sendForbidden\(/g,
  /sendNotFound\(/g,
  /sendValidationError\(/g,
  /sendInternalError\(/g,
  /sendCreated\(/g,
  /sendMethodNotAllowed\(/g,
  /sendPaginatedSuccess\(/g,
  
  // Direct json responses
  /res\.json\(\{/g,
  /return\s+res\./g,
];

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /dist/,
  /build/,
  /scripts/,
  /test/,
  /spec/,
];

async function findApiFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  const walk = async (currentPath: string) => {
    const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      // Skip excluded directories
      if (EXCLUDE_PATTERNS.some(pattern => pattern.test(fullPath))) {
        continue;
      }
      
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts') && fullPath.includes('/api/')) {
        files.push(fullPath);
      }
    }
  };
  
  await walk(dir);
  return files;
}

async function analyzeFile(filePath: string): Promise<UpdateCandidate | null> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const patterns: string[] = [];
    
    // Check if already using standardized response
    if (content.includes("from '../../../lib/api/response'") || 
        content.includes('from "@/lib/api/response"') ||
        content.includes('apiResponse.')) {
      return null;
    }
    
    // Find patterns that need updating
    for (const pattern of API_PATTERNS) {
      if (pattern.test(content)) {
        patterns.push(pattern.toString());
      }
    }
    
    if (patterns.length === 0) {
      return null;
    }
    
    // Check current import
    const importMatch = content.match(/from ['"].*\/api-response['"]/);
    
    return {
      file: filePath,
      patterns,
      currentImport: importMatch ? importMatch[0] : undefined,
    };
  } catch (error) {
    logger.error(`Error analyzing file ${filePath}:`, error);
    return null;
  }
}

async function generateReport() {
  logger.info('Starting API response standardization analysis...');
  
  const apiFiles = await findApiFiles(path.join(process.cwd(), 'pages/api'));
  logger.info(`Found ${apiFiles.length} API files`);
  
  const candidates: UpdateCandidate[] = [];
  
  for (const file of apiFiles) {
    const candidate = await analyzeFile(file);
    if (candidate) {
      candidates.push(candidate);
    }
  }
  
  // Generate report
  logger.info(`\n${'='.repeat(80)}`);
  logger.info('API Response Standardization Report');
  logger.info(`${'='.repeat(80)}\n`);
  
  logger.info(`Total API files: ${apiFiles.length}`);
  logger.info(`Files needing updates: ${candidates.length}`);
  logger.info(`Files already standardized: ${apiFiles.length - candidates.length}\n`);
  
  if (candidates.length > 0) {
    logger.info('Files that need updating:');
    logger.info('-'.repeat(80));
    
    candidates.forEach((candidate, index) => {
      const relativePath = path.relative(process.cwd(), candidate.file);
      logger.info(`\n${index + 1}. ${relativePath}`);
      
      if (candidate.currentImport) {
        logger.info(`   Current import: ${candidate.currentImport}`);
      }
      
      logger.info('   Patterns found:');
      candidate.patterns.forEach(pattern => {
        logger.info(`   - ${pattern}`);
      });
    });
    
    logger.info(`\n${'='.repeat(80)}`);
    logger.info('Recommended Actions:');
    logger.info('-'.repeat(80));
    logger.info('1. Add import: import { apiResponse } from "@/lib/api/response";');
    logger.info('2. Replace response patterns:');
    logger.info('   - res.status(200).json({...}) → apiResponse.success(res, {...})');
    logger.info('   - res.status(201).json({...}) → apiResponse.created(res, {...})');
    logger.info('   - res.status(400).json({...}) → apiResponse.error(res, message, 400)');
    logger.info('   - res.status(401).json({...}) → apiResponse.unauthorized(res, message)');
    logger.info('   - res.status(403).json({...}) → apiResponse.forbidden(res, message)');
    logger.info('   - res.status(404).json({...}) → apiResponse.notFound(res, resource)');
    logger.info('   - res.status(500).json({...}) → apiResponse.internalError(res, error)');
    
    // Save report to file
    const reportPath = path.join(process.cwd(), 'api-response-update-report.txt');
    const reportContent = candidates.map(c => 
      `${path.relative(process.cwd(), c.file)}\n` +
      `  Patterns: ${c.patterns.join(', ')}\n`
    ).join('\n');
    
    await fs.promises.writeFile(reportPath, reportContent);
    logger.info(`\nDetailed report saved to: ${reportPath}`);
  } else {
    logger.info('✅ All API files are already using standardized responses!');
  }
}

// Run the analysis
generateReport().catch(error => {
  logger.error('Script failed:', error);
  process.exit(1);
});