#!/usr/bin/env ts-node

/**
 * Code Quality Report Generator
 * Analyzes the codebase and generates a comprehensive quality report
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface QualityMetrics {
  typeScriptCoverage: number;
  anyTypeCount: number;
  consoleStatementCount: number;
  todoCount: number;
  testCoverage: number;
  eslintIssues: number;
  duplicateFiles: number;
  namingViolations: string[];
  largeFiles: string[];
  complexFunctions: string[];
}

class CodeQualityAnalyzer {
  private projectRoot: string;
  private metrics: QualityMetrics;

  constructor() {
    this.projectRoot = process.cwd();
    this.metrics = {
      typeScriptCoverage: 0,
      anyTypeCount: 0,
      consoleStatementCount: 0,
      todoCount: 0,
      testCoverage: 0,
      eslintIssues: 0,
      duplicateFiles: 0,
      namingViolations: [],
      largeFiles: [],
      complexFunctions: []
    };
  }

  private runCommand(command: string): string {
    try {
      return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    } catch (error: any) {
      return error.stdout || '';
    }
  }

  private findFiles(dir: string, pattern: RegExp): string[] {
    const results: string[] = [];
    
    function traverse(currentDir: string) {
      if (!fs.existsSync(currentDir)) return;
      
      const files = fs.readdirSync(currentDir);
      
      for (const file of files) {
        const filePath = path.join(currentDir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.includes('node_modules') && !file.startsWith('.')) {
          traverse(filePath);
        } else if (stat.isFile() && pattern.test(file)) {
          results.push(filePath);
        }
      }
    }
    
    traverse(dir);
    return results;
  }

  analyzeTypeScriptCoverage() {
    console.log('📊 Analyzing TypeScript coverage...');
    
    const tsFiles = this.findFiles(this.projectRoot, /\.(ts|tsx)$/);
    const jsFiles = this.findFiles(this.projectRoot, /\.(js|jsx)$/);
    
    const totalFiles = tsFiles.length + jsFiles.length;
    this.metrics.typeScriptCoverage = totalFiles > 0 
      ? Math.round((tsFiles.length / totalFiles) * 100) 
      : 0;
    
    // Count any types
    let anyCount = 0;
    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(/:\s*any\b/g);
      if (matches) {
        anyCount += matches.length;
      }
    }
    this.metrics.anyTypeCount = anyCount;
  }

  analyzeCodeSmells() {
    console.log('🔍 Analyzing code smells...');
    
    const sourceFiles = this.findFiles(this.projectRoot, /\.(ts|tsx|js|jsx)$/);
    let consoleCount = 0;
    let todoCount = 0;
    
    for (const file of sourceFiles) {
      if (file.includes('/scripts/') || file.includes('/__tests__/')) continue;
      
      const content = fs.readFileSync(file, 'utf8');
      
      // Count console statements
      const consoleMatches = content.match(/console\.(log|error|warn|debug|info)/g);
      if (consoleMatches) {
        consoleCount += consoleMatches.length;
      }
      
      // Count TODOs
      const todoMatches = content.match(/\/\/\s*(TODO|FIXME|HACK|XXX)/gi);
      if (todoMatches) {
        todoCount += todoMatches.length;
      }
      
      // Check file size (> 500 lines)
      const lines = content.split('\n').length;
      if (lines > 500) {
        this.metrics.largeFiles.push(`${path.relative(this.projectRoot, file)} (${lines} lines)`);
      }
    }
    
    this.metrics.consoleStatementCount = consoleCount;
    this.metrics.todoCount = todoCount;
  }

  analyzeNamingConventions() {
    console.log('📝 Analyzing naming conventions...');
    
    // Check component files
    const componentFiles = this.findFiles(path.join(this.projectRoot, 'components'), /\.tsx$/);
    
    for (const file of componentFiles) {
      const fileName = path.basename(file);
      
      // Skip index files
      if (fileName === 'index.tsx' || fileName === 'index.ts') continue;
      
      // Check if component file starts with lowercase
      if (fileName[0] === fileName[0].toLowerCase() && !fileName.startsWith('use')) {
        this.metrics.namingViolations.push(path.relative(this.projectRoot, file));
      }
    }
  }

  analyzeDuplicateFiles() {
    console.log('🔄 Analyzing duplicate files...');
    
    const files = this.findFiles(this.projectRoot, /\.(ts|tsx)$/);
    const fileGroups: Record<string, string[]> = {};
    
    // Group files by base name
    for (const file of files) {
      const basename = path.basename(file).replace(/-rls-migrated|-updated|-rls/, '');
      if (!fileGroups[basename]) {
        fileGroups[basename] = [];
      }
      fileGroups[basename].push(file);
    }
    
    // Count groups with duplicates
    let duplicateCount = 0;
    for (const [basename, group] of Object.entries(fileGroups)) {
      if (group.length > 1) {
        duplicateCount++;
      }
    }
    
    this.metrics.duplicateFiles = duplicateCount;
  }

  analyzeTestCoverage() {
    console.log('🧪 Analyzing test coverage...');
    
    // Try to get coverage from last test run
    const coveragePath = path.join(this.projectRoot, 'coverage', 'coverage-summary.json');
    
    if (fs.existsSync(coveragePath)) {
      try {
        const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        this.metrics.testCoverage = Math.round(coverage.total.lines.pct);
      } catch (error) {
        console.log('   ⚠️  Could not parse coverage data');
        this.metrics.testCoverage = 0;
      }
    } else {
      console.log('   ⚠️  No coverage data found. Run tests with coverage first.');
      this.metrics.testCoverage = 0;
    }
  }

  analyzeESLintIssues() {
    console.log('🔧 Analyzing ESLint issues...');
    
    const eslintOutput = this.runCommand('npm run lint -- --format json 2>/dev/null');
    
    try {
      const results = JSON.parse(eslintOutput);
      let totalIssues = 0;
      
      for (const file of results) {
        totalIssues += file.errorCount + file.warningCount;
      }
      
      this.metrics.eslintIssues = totalIssues;
    } catch (error) {
      console.log('   ⚠️  Could not parse ESLint results');
      this.metrics.eslintIssues = -1;
    }
  }

  generateReport(): string {
    const report = `# Code Quality Report

Generated on: ${new Date().toISOString()}

## Summary Score: ${this.calculateOverallScore()}/100

## Metrics Overview

### Type Safety
- **TypeScript Coverage**: ${this.metrics.typeScriptCoverage}%
- **Any Type Usage**: ${this.metrics.anyTypeCount} instances
- **Score**: ${this.calculateTypeScore()}/20

### Code Quality
- **Console Statements**: ${this.metrics.consoleStatementCount} found
- **TODO Comments**: ${this.metrics.todoCount} found
- **ESLint Issues**: ${this.metrics.eslintIssues === -1 ? 'Unable to analyze' : this.metrics.eslintIssues}
- **Score**: ${this.calculateQualityScore()}/20

### Naming & Organization
- **Naming Violations**: ${this.metrics.namingViolations.length} files
- **Duplicate Files**: ${this.metrics.duplicateFiles} sets
- **Large Files**: ${this.metrics.largeFiles.length} files (>500 lines)
- **Score**: ${this.calculateOrganizationScore()}/20

### Testing
- **Test Coverage**: ${this.metrics.testCoverage}%
- **Score**: ${this.calculateTestScore()}/20

### Maintainability
- **Complex Functions**: ${this.metrics.complexFunctions.length}
- **Technical Debt**: ${this.calculateTechnicalDebt()}
- **Score**: ${this.calculateMaintainabilityScore()}/20

## Detailed Issues

### Naming Convention Violations
${this.metrics.namingViolations.length > 0 
  ? this.metrics.namingViolations.map(f => `- ${f}`).join('\n')
  : '✅ No violations found'}

### Large Files
${this.metrics.largeFiles.length > 0
  ? this.metrics.largeFiles.map(f => `- ${f}`).join('\n')
  : '✅ No large files found'}

## Recommendations

${this.generateRecommendations()}

## Action Items

${this.generateActionItems()}

---
*Next scan recommended in: 1 week*
`;

    return report;
  }

  private calculateOverallScore(): number {
    return this.calculateTypeScore() +
           this.calculateQualityScore() +
           this.calculateOrganizationScore() +
           this.calculateTestScore() +
           this.calculateMaintainabilityScore();
  }

  private calculateTypeScore(): number {
    let score = 20;
    
    // Deduct for low TypeScript coverage
    if (this.metrics.typeScriptCoverage < 95) {
      score -= Math.floor((95 - this.metrics.typeScriptCoverage) / 5);
    }
    
    // Deduct for any types
    score -= Math.min(10, Math.floor(this.metrics.anyTypeCount / 10));
    
    return Math.max(0, score);
  }

  private calculateQualityScore(): number {
    let score = 20;
    
    // Deduct for console statements
    score -= Math.min(10, Math.floor(this.metrics.consoleStatementCount / 20));
    
    // Deduct for TODOs
    score -= Math.min(5, Math.floor(this.metrics.todoCount / 10));
    
    // Deduct for ESLint issues
    if (this.metrics.eslintIssues > 0) {
      score -= Math.min(5, Math.floor(this.metrics.eslintIssues / 50));
    }
    
    return Math.max(0, score);
  }

  private calculateOrganizationScore(): number {
    let score = 20;
    
    // Deduct for naming violations
    score -= Math.min(10, this.metrics.namingViolations.length);
    
    // Deduct for duplicate files
    score -= Math.min(5, Math.floor(this.metrics.duplicateFiles / 5));
    
    // Deduct for large files
    score -= Math.min(5, Math.floor(this.metrics.largeFiles.length / 3));
    
    return Math.max(0, score);
  }

  private calculateTestScore(): number {
    // Simple linear scale: 80% coverage = 20 points
    return Math.min(20, Math.floor(this.metrics.testCoverage / 4));
  }

  private calculateMaintainabilityScore(): number {
    let score = 20;
    
    // Consider various factors
    const technicalDebt = this.calculateTechnicalDebt();
    
    if (technicalDebt === 'High') score -= 10;
    else if (technicalDebt === 'Medium') score -= 5;
    
    return Math.max(0, score);
  }

  private calculateTechnicalDebt(): string {
    const issues = 
      this.metrics.anyTypeCount +
      this.metrics.consoleStatementCount +
      this.metrics.todoCount +
      this.metrics.duplicateFiles * 10;
    
    if (issues > 200) return 'High';
    if (issues > 100) return 'Medium';
    return 'Low';
  }

  private generateRecommendations(): string {
    const recommendations: string[] = [];
    
    if (this.metrics.anyTypeCount > 50) {
      recommendations.push('1. **Reduce `any` types**: Run type inference to replace with proper types');
    }
    
    if (this.metrics.consoleStatementCount > 0) {
      recommendations.push('2. **Remove console statements**: Use the provided script to replace with logger');
    }
    
    if (this.metrics.namingViolations.length > 0) {
      recommendations.push('3. **Fix naming conventions**: Run the naming convention fix script');
    }
    
    if (this.metrics.testCoverage < 80) {
      recommendations.push('4. **Improve test coverage**: Focus on critical business logic paths');
    }
    
    if (this.metrics.duplicateFiles > 0) {
      recommendations.push('5. **Clean up duplicates**: Remove RLS migration duplicates');
    }
    
    return recommendations.join('\n');
  }

  private generateActionItems(): string {
    const actions: string[] = [];
    
    if (this.metrics.anyTypeCount > 100) {
      actions.push('- [ ] Schedule TypeScript strict mode migration sprint');
    }
    
    if (this.metrics.consoleStatementCount > 50) {
      actions.push('- [ ] Run `npm run fix:console` to remove console statements');
    }
    
    if (this.metrics.namingViolations.length > 5) {
      actions.push('- [ ] Run `npm run fix:naming` to fix file naming');
    }
    
    if (this.metrics.eslintIssues > 100) {
      actions.push('- [ ] Run `npm run lint:fix` to auto-fix ESLint issues');
    }
    
    actions.push('- [ ] Review and address TODO comments');
    actions.push('- [ ] Set up pre-commit hooks to prevent future issues');
    
    return actions.join('\n');
  }

  async run() {
    console.log('🚀 Starting code quality analysis...\n');
    
    this.analyzeTypeScriptCoverage();
    this.analyzeCodeSmells();
    this.analyzeNamingConventions();
    this.analyzeDuplicateFiles();
    this.analyzeTestCoverage();
    this.analyzeESLintIssues();
    
    const report = this.generateReport();
    
    // Save report
    const reportPath = path.join(this.projectRoot, 'code-quality-report.md');
    fs.writeFileSync(reportPath, report);
    
    console.log('\n✅ Analysis complete!');
    console.log(`📄 Report saved to: ${reportPath}`);
    console.log(`📊 Overall Score: ${this.calculateOverallScore()}/100`);
    
    // Also output key metrics to console
    console.log('\n🎯 Key Metrics:');
    console.log(`   TypeScript Coverage: ${this.metrics.typeScriptCoverage}%`);
    console.log(`   Any Types: ${this.metrics.anyTypeCount}`);
    console.log(`   Console Statements: ${this.metrics.consoleStatementCount}`);
    console.log(`   Test Coverage: ${this.metrics.testCoverage}%`);
    console.log(`   Technical Debt: ${this.calculateTechnicalDebt()}`);
  }
}

// Run the analyzer
const analyzer = new CodeQualityAnalyzer();
analyzer.run().catch(console.error);