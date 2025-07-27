#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger';

/**
 * Script to automatically update common API response patterns
 * to use the standardized apiResponse utility
 */

interface FileUpdate {
  file: string;
  originalContent: string;
  updatedContent: string;
  changes: number;
}

const RESPONSE_MAPPINGS = [
  // Status code patterns
  { 
    pattern: /res\.status\(200\)\.json\(/g,
    replacement: 'apiResponse.success(res, '
  },
  {
    pattern: /res\.status\(201\)\.json\(/g,
    replacement: 'apiResponse.created(res, '
  },
  {
    pattern: /res\.status\(204\)\.end\(\)/g,
    replacement: 'apiResponse.noContent(res)'
  },
  {
    pattern: /res\.status\(400\)\.json\(/g,
    replacement: 'apiResponse.error(res, '
  },
  {
    pattern: /res\.status\(401\)\.json\(/g,
    replacement: 'apiResponse.unauthorized(res, '
  },
  {
    pattern: /res\.status\(403\)\.json\(/g,
    replacement: 'apiResponse.forbidden(res, '
  },
  {
    pattern: /res\.status\(404\)\.json\(/g,
    replacement: 'apiResponse.notFound(res, '
  },
  {
    pattern: /res\.status\(405\)\.json\(/g,
    replacement: 'apiResponse.methodNotAllowed(res, '
  },
  {
    pattern: /res\.status\(422\)\.json\(/g,
    replacement: 'apiResponse.validationError(res, '
  },
  {
    pattern: /res\.status\(429\)\.json\(/g,
    replacement: 'apiResponse.rateLimitExceeded(res, '
  },
  {
    pattern: /res\.status\(500\)\.json\(/g,
    replacement: 'apiResponse.internalError(res, '
  },
  // Simple return patterns
  {
    pattern: /return res\.json\(\{/g,
    replacement: 'return apiResponse.success(res, {'
  }
];

const IMPORT_PATTERNS = [
  /from ['"]\.\.\/\.\.\/\.\.\/lib\/utils\/api-response['"]/,
  /from ['"].*\/api-response['"]/
];

async function processFile(filePath: string): Promise<FileUpdate | null> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    let updatedContent = content;
    let changes = 0;

    // Skip if already using new standardized response
    if (content.includes("from '../../../lib/api/response'") || 
        content.includes('from "@/lib/api/response"') ||
        content.includes('apiResponse.')) {
      return null;
    }

    // Replace old imports with new one
    let hasOldImport = false;
    for (const importPattern of IMPORT_PATTERNS) {
      if (importPattern.test(updatedContent)) {
        hasOldImport = true;
        updatedContent = updatedContent.replace(importPattern, 'from \'@/lib/api/response\'');
        changes++;
      }
    }

    // Add import if needed and file has response patterns
    const hasResponsePatterns = RESPONSE_MAPPINGS.some(m => m.pattern.test(content));
    if (!hasOldImport && hasResponsePatterns) {
      // Find the last import statement
      const importMatches = [...updatedContent.matchAll(/^import.*from.*;$/gm)];
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const insertPos = lastImport.index! + lastImport[0].length;
        updatedContent = 
          updatedContent.slice(0, insertPos) + 
          '\nimport { apiResponse } from \'@/lib/api/response\';' +
          updatedContent.slice(insertPos);
        changes++;
      }
    }

    // Apply response pattern replacements
    for (const mapping of RESPONSE_MAPPINGS) {
      const matches = [...updatedContent.matchAll(mapping.pattern)];
      if (matches.length > 0) {
        updatedContent = updatedContent.replace(mapping.pattern, mapping.replacement);
        changes += matches.length;
      }
    }

    // Fix old response utility calls
    const oldUtilityPatterns = [
      { pattern: /sendSuccess\(/g, replacement: 'apiResponse.success(' },
      { pattern: /sendCreated\(/g, replacement: 'apiResponse.created(' },
      { pattern: /sendUnauthorized\(/g, replacement: 'apiResponse.unauthorized(' },
      { pattern: /sendForbidden\(/g, replacement: 'apiResponse.forbidden(' },
      { pattern: /sendNotFound\(/g, replacement: 'apiResponse.notFound(' },
      { pattern: /sendValidationError\(/g, replacement: 'apiResponse.validationError(' },
      { pattern: /sendInternalError\(/g, replacement: 'apiResponse.internalError(' },
      { pattern: /sendMethodNotAllowed\(/g, replacement: 'apiResponse.methodNotAllowed(' },
      { pattern: /sendRateLimitExceeded\(/g, replacement: 'apiResponse.rateLimitExceeded(' },
    ];

    for (const { pattern, replacement } of oldUtilityPatterns) {
      const matches = [...updatedContent.matchAll(pattern)];
      if (matches.length > 0) {
        updatedContent = updatedContent.replace(pattern, replacement);
        changes += matches.length;
      }
    }

    if (changes === 0) {
      return null;
    }

    return {
      file: filePath,
      originalContent: content,
      updatedContent,
      changes
    };
  } catch (error) {
    logger.error(`Error processing file ${filePath}:`, error);
    return null;
  }
}

async function findApiFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  const walk = async (currentPath: string) => {
    const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      // Skip excluded directories
      if (entry.name === 'node_modules' || 
          entry.name === '.next' || 
          entry.name === 'dist' ||
          entry.name === 'scripts') {
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

async function updateApiResponses() {
  logger.info('Starting automated API response updates...');
  
  const apiFiles = await findApiFiles(path.join(process.cwd(), 'pages/api'));
  logger.info(`Found ${apiFiles.length} API files`);
  
  const updates: FileUpdate[] = [];
  const errors: string[] = [];
  
  for (const file of apiFiles) {
    const update = await processFile(file);
    if (update) {
      updates.push(update);
    }
  }
  
  if (updates.length === 0) {
    logger.info('No files need updating!');
    return;
  }
  
  logger.info(`\nFound ${updates.length} files to update`);
  
  // Apply updates
  for (const update of updates) {
    try {
      await fs.promises.writeFile(update.file, update.updatedContent);
      const relativePath = path.relative(process.cwd(), update.file);
      logger.info(`✅ Updated ${relativePath} (${update.changes} changes)`);
    } catch (error) {
      const relativePath = path.relative(process.cwd(), update.file);
      logger.error(`❌ Failed to update ${relativePath}:`, error);
      errors.push(relativePath);
    }
  }
  
  // Summary
  logger.info('\n' + '='.repeat(80));
  logger.info('Update Summary:');
  logger.info('='.repeat(80));
  logger.info(`Total files processed: ${apiFiles.length}`);
  logger.info(`Files updated: ${updates.length - errors.length}`);
  logger.info(`Files failed: ${errors.length}`);
  logger.info(`Total changes: ${updates.reduce((sum, u) => sum + u.changes, 0)}`);
  
  if (errors.length > 0) {
    logger.error('\nFailed updates:');
    errors.forEach(file => logger.error(`  - ${file}`));
  }
  
  logger.info('\n✨ API response standardization complete!');
  logger.info('\nNext steps:');
  logger.info('1. Review the changes with git diff');
  logger.info('2. Run tests to ensure everything works');
  logger.info('3. Manually check complex response patterns');
  logger.info('4. Update any custom error handling logic');
}

// Run the update
updateApiResponses().catch(error => {
  logger.error('Script failed:', error);
  process.exit(1);
});