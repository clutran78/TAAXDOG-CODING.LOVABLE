#!/usr/bin/env node

/**
 * Script to remove console statements from production code
 * Replaces them with proper logger calls
 */

const fs = require('fs');
const path = require('path');

const EXCLUDE_DIRS = ['node_modules', '.next', 'scripts', 'tests', '__tests__', '.git'];
const INCLUDE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

let processedFiles = 0;
let consoleStatementsRemoved = 0;
let filesModified = [];

// Logger import statement to add
const LOGGER_IMPORT = "import { logger } from '@/lib/logger';\n";

// Patterns to replace
const CONSOLE_PATTERNS = [
  {
    pattern: /console\.log\((.*?)\);?/g,
    replacement: (match, args) => {
      // Skip if it's in a comment
      if (match.includes('//') || match.includes('/*')) return match;
      
      // Determine log level based on content
      if (args.includes('error') || args.includes('Error')) {
        return `logger.error(${args});`;
      } else if (args.includes('warn') || args.includes('Warning')) {
        return `logger.warn(${args});`;
      } else if (args.includes('debug') || args.includes('Debug')) {
        return `logger.debug(${args});`;
      }
      return `logger.info(${args});`;
    }
  },
  {
    pattern: /console\.error\((.*?)\);?/g,
    replacement: (match, args) => `logger.error(${args});`
  },
  {
    pattern: /console\.warn\((.*?)\);?/g,
    replacement: (match, args) => `logger.warn(${args});`
  },
  {
    pattern: /console\.debug\((.*?)\);?/g,
    replacement: (match, args) => `logger.debug(${args});`
  },
  {
    pattern: /console\.info\((.*?)\);?/g,
    replacement: (match, args) => `logger.info(${args});`
  }
];

function shouldProcessFile(filePath) {
  // Check if file is in excluded directory
  for (const excludeDir of EXCLUDE_DIRS) {
    if (filePath.includes(excludeDir)) {
      return false;
    }
  }
  
  // Check file extension
  const ext = path.extname(filePath);
  return INCLUDE_EXTENSIONS.includes(ext);
}

function processFile(filePath) {
  if (!shouldProcessFile(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let hasConsoleStatements = false;
  let needsLoggerImport = false;
  
  // Check if file has console statements
  for (const { pattern } of CONSOLE_PATTERNS) {
    if (pattern.test(content)) {
      hasConsoleStatements = true;
      break;
    }
  }
  
  if (!hasConsoleStatements) return;
  
  // Apply replacements
  for (const { pattern, replacement } of CONSOLE_PATTERNS) {
    content = content.replace(pattern, (match, ...args) => {
      const result = replacement(match, ...args);
      if (result !== match) {
        consoleStatementsRemoved++;
        needsLoggerImport = true;
      }
      return result;
    });
  }
  
  // Add logger import if needed and not already present
  if (needsLoggerImport && !content.includes("from '@/lib/logger'")) {
    // Find the right place to insert import (after other imports)
    const importMatch = content.match(/^(import .* from .*;\n)+/m);
    if (importMatch) {
      const lastImportEnd = importMatch.index + importMatch[0].length;
      content = content.slice(0, lastImportEnd) + LOGGER_IMPORT + content.slice(lastImportEnd);
    } else {
      // No imports found, add at the beginning
      content = LOGGER_IMPORT + '\n' + content;
    }
  }
  
  // Write back if changed
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    filesModified.push(filePath);
    processedFiles++;
    console.log(`✅ Processed: ${path.relative(process.cwd(), filePath)}`);
  }
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !EXCLUDE_DIRS.includes(file) && !file.startsWith('.')) {
      processDirectory(filePath);
    } else if (stat.isFile()) {
      processFile(filePath);
    }
  }
}

// Create logger utility if it doesn't exist
function createLoggerUtility() {
  const loggerPath = path.join(process.cwd(), 'lib', 'logger.ts');
  
  if (!fs.existsSync(loggerPath)) {
    const loggerContent = `/**
 * Centralized logging utility
 * Replaces console statements for production-ready logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  context?: Record<string, any>;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  
  private log(level: LogLevel, message: string, data?: any) {
    const logEntry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    
    // In development, use console
    if (this.isDevelopment) {
      const consoleMethod = level === 'error' ? console.error : 
                           level === 'warn' ? console.warn : 
                           console.log;
      
      consoleMethod(\`[\${level.toUpperCase()}]\`, message, data || '');
      return;
    }
    
    // In production, send to logging service
    // TODO: Implement production logging (e.g., Sentry, LogRocket, etc.)
    this.sendToLoggingService(logEntry);
  }
  
  private sendToLoggingService(logEntry: LogEntry) {
    // Implement your preferred logging service here
    // For now, we'll use a safe console fallback
    if (logEntry.level === 'error') {
      console.error('[LOGGER]', logEntry);
    }
  }
  
  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }
  
  info(message: string, data?: any) {
    this.log('info', message, data);
  }
  
  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }
  
  error(message: string, error?: any) {
    const errorData = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error;
    
    this.log('error', message, errorData);
  }
}

export const logger = new Logger();
`;
    
    // Ensure lib directory exists
    const libDir = path.dirname(loggerPath);
    if (!fs.existsSync(libDir)) {
      fs.mkdirSync(libDir, { recursive: true });
    }
    
    fs.writeFileSync(loggerPath, loggerContent);
    console.log('✅ Created logger utility at lib/logger.ts');
  }
}

console.log('🧹 Starting console statement cleanup...\n');

// Create logger utility first
createLoggerUtility();

// Process all directories
const projectRoot = process.cwd();
const dirsToProcess = ['components', 'pages', 'lib', 'hooks'];

for (const dir of dirsToProcess) {
  const fullPath = path.join(projectRoot, dir);
  if (fs.existsSync(fullPath)) {
    console.log(`\nProcessing ${dir}...`);
    processDirectory(fullPath);
  }
}

// Summary
console.log('\n\n📊 Summary:');
console.log(`✅ Processed ${processedFiles} files`);
console.log(`🔄 Replaced ${consoleStatementsRemoved} console statements`);
console.log(`📝 Modified ${filesModified.length} files`);

if (filesModified.length > 0) {
  console.log('\n🎯 Top modified files:');
  filesModified.slice(0, 10).forEach(f => 
    console.log(`  - ${path.relative(process.cwd(), f)}`)
  );
  if (filesModified.length > 10) {
    console.log(`  ... and ${filesModified.length - 10} more files`);
  }
}

console.log('\n✨ Console statement cleanup completed!');
console.log('📌 Logger utility is available at: lib/logger.ts');
console.log('⚠️  Please review the changes and run tests to ensure everything works correctly.');