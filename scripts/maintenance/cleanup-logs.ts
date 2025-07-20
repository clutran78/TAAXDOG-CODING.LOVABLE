#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

interface CleanupOptions {
  dryRun?: boolean;
  maxAge?: number; // Days
  maxSize?: number; // Bytes
  preserveRecent?: number; // Number of recent files to keep
}

interface CleanupResult {
  filesDeleted: string[];
  spaceFreed: number;
  errors: string[];
}

class LogCleanup {
  private logDirectories = [
    'logs',
    '.next',
    'node_modules/.cache',
    'tmp',
    '/tmp'
  ];

  private logPatterns = [
    '*.log',
    '*.log.*',
    '*.tmp',
    '*.cache',
    'npm-debug.log*',
    'yarn-debug.log*',
    'yarn-error.log*'
  ];

  async cleanup(options: CleanupOptions = {}): Promise<CleanupResult> {
    const {
      dryRun = false,
      maxAge = 7, // 7 days default
      maxSize = 100 * 1024 * 1024, // 100MB default
      preserveRecent = 5
    } = options;

    console.log('🧹 Starting log cleanup...');
    console.log(`Options: maxAge=${maxAge} days, maxSize=${this.formatBytes(maxSize)}, preserveRecent=${preserveRecent}`);
    if (dryRun) console.log('🔍 DRY RUN MODE - No files will be deleted');

    const result: CleanupResult = {
      filesDeleted: [],
      spaceFreed: 0,
      errors: []
    };

    // Clean each log directory
    for (const dir of this.logDirectories) {
      const fullPath = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
      
      if (!fs.existsSync(fullPath)) {
        continue;
      }

      try {
        const cleanupDirResult = await this.cleanupDirectory(fullPath, {
          dryRun,
          maxAge,
          maxSize,
          preserveRecent
        });
        
        result.filesDeleted.push(...cleanupDirResult.filesDeleted);
        result.spaceFreed += cleanupDirResult.spaceFreed;
        result.errors.push(...cleanupDirResult.errors);
      } catch (error) {
        result.errors.push(`Error cleaning ${fullPath}: ${error}`);
      }
    }

    // Clean specific files
    await this.cleanupSpecificFiles(result, { dryRun, maxAge });

    // Clean Docker artifacts if present
    await this.cleanupDockerArtifacts(result, dryRun);

    // Summary
    this.printSummary(result);

    return result;
  }

  private async cleanupDirectory(
    dirPath: string,
    options: Required<CleanupOptions>
  ): Promise<CleanupResult> {
    const result: CleanupResult = {
      filesDeleted: [],
      spaceFreed: 0,
      errors: []
    };

    try {
      const files = await fs.promises.readdir(dirPath);
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(dirPath, file);
          try {
            const stat = await fs.promises.stat(filePath);
            return { filePath, stat, fileName: file };
          } catch {
            return null;
          }
        })
      );

      // Filter out nulls and directories
      const validFiles = fileStats
        .filter((f): f is NonNullable<typeof f> => f !== null && f.stat.isFile())
        .filter(f => this.isLogFile(f.fileName));

      // Sort by modification time (newest first)
      validFiles.sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

      // Process files
      for (let i = 0; i < validFiles.length; i++) {
        const { filePath, stat } = validFiles[i];
        const ageInDays = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60 * 24);

        // Skip recent files if within preserve count
        if (i < options.preserveRecent) {
          continue;
        }

        // Check if file should be deleted
        if (ageInDays > options.maxAge || stat.size > options.maxSize) {
          if (!options.dryRun) {
            try {
              await fs.promises.unlink(filePath);
              result.filesDeleted.push(filePath);
              result.spaceFreed += stat.size;
            } catch (error) {
              result.errors.push(`Failed to delete ${filePath}: ${error}`);
            }
          } else {
            console.log(`Would delete: ${filePath} (${this.formatBytes(stat.size)}, ${Math.round(ageInDays)} days old)`);
            result.filesDeleted.push(filePath);
            result.spaceFreed += stat.size;
          }
        }
      }
    } catch (error) {
      result.errors.push(`Error processing directory ${dirPath}: ${error}`);
    }

    return result;
  }

  private isLogFile(fileName: string): boolean {
    const lowerName = fileName.toLowerCase();
    return (
      lowerName.endsWith('.log') ||
      lowerName.includes('.log.') ||
      lowerName.endsWith('.tmp') ||
      lowerName.endsWith('.cache') ||
      lowerName.includes('debug') ||
      lowerName.includes('error')
    );
  }

  private async cleanupSpecificFiles(result: CleanupResult, options: { dryRun: boolean; maxAge: number }) {
    const specificFiles = [
      '.DS_Store',
      'Thumbs.db',
      '.npm/_logs/*',
      '.yarn/cache/*'
    ];

    for (const pattern of specificFiles) {
      try {
        const files = await this.findFiles(pattern);
        for (const file of files) {
          try {
            const stat = await fs.promises.stat(file);
            if (!options.dryRun) {
              await fs.promises.unlink(file);
            }
            result.filesDeleted.push(file);
            result.spaceFreed += stat.size;
          } catch (error) {
            // Ignore errors for specific files
          }
        }
      } catch {
        // Pattern didn't match any files
      }
    }
  }

  private async cleanupDockerArtifacts(result: CleanupResult, dryRun: boolean) {
    try {
      // Check if Docker is available
      await execAsync('docker --version');

      // Clean up dangling images
      if (!dryRun) {
        const { stdout } = await execAsync('docker image prune -f');
        const match = stdout.match(/Total reclaimed space: (.+)/);
        if (match) {
          console.log(`🐳 Docker cleanup: ${match[1]}`);
        }
      }
    } catch {
      // Docker not available or command failed
    }
  }

  private async findFiles(pattern: string): Promise<string[]> {
    // Simple implementation - in production use glob or similar
    const files: string[] = [];
    const dir = path.dirname(pattern);
    const filePattern = path.basename(pattern);

    if (fs.existsSync(dir)) {
      const dirFiles = await fs.promises.readdir(dir);
      for (const file of dirFiles) {
        if (file.match(filePattern.replace('*', '.*'))) {
          files.push(path.join(dir, file));
        }
      }
    }

    return files;
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  private printSummary(result: CleanupResult) {
    console.log('\n📊 Cleanup Summary:');
    console.log(`Files deleted: ${result.filesDeleted.length}`);
    console.log(`Space freed: ${this.formatBytes(result.spaceFreed)}`);
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${result.errors.length}`);
      result.errors.forEach(err => console.log(`  - ${err}`));
    }

    if (result.filesDeleted.length > 0) {
      console.log('\n🗑️  Files deleted:');
      result.filesDeleted.slice(0, 10).forEach(file => {
        console.log(`  - ${file}`);
      });
      if (result.filesDeleted.length > 10) {
        console.log(`  ... and ${result.filesDeleted.length - 10} more`);
      }
    }
  }

  async getLogSpaceUsage(): Promise<{ total: number; byDirectory: Record<string, number> }> {
    let total = 0;
    const byDirectory: Record<string, number> = {};

    for (const dir of this.logDirectories) {
      const fullPath = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
      
      if (!fs.existsSync(fullPath)) {
        continue;
      }

      try {
        const size = await this.getDirectorySize(fullPath);
        byDirectory[dir] = size;
        total += size;
      } catch (error) {
        console.error(`Error calculating size for ${dir}:`, error);
      }
    }

    return { total, byDirectory };
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    
    const files = await fs.promises.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        const stat = await fs.promises.stat(filePath);
        if (stat.isFile()) {
          size += stat.size;
        } else if (stat.isDirectory()) {
          size += await this.getDirectorySize(filePath);
        }
      } catch {
        // Ignore inaccessible files
      }
    }

    return size;
  }
}

// Main execution
async function main() {
  const cleanup = new LogCleanup();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  
  // Get current disk usage
  const usage = await cleanup.getLogSpaceUsage();
  console.log(`\n📈 Current log space usage: ${cleanup['formatBytes'](usage.total)}`);
  console.log('By directory:');
  Object.entries(usage.byDirectory).forEach(([dir, size]) => {
    console.log(`  ${dir}: ${cleanup['formatBytes'](size)}`);
  });

  // Perform cleanup
  const result = await cleanup.cleanup({
    dryRun,
    maxAge: force ? 1 : 7, // More aggressive if force flag
    maxSize: force ? 10 * 1024 * 1024 : 100 * 1024 * 1024, // 10MB vs 100MB
    preserveRecent: force ? 1 : 5
  });

  // Exit with appropriate code
  process.exit(result.errors.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch(console.error);
}

export { LogCleanup };