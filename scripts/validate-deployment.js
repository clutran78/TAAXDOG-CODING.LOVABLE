#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

let hasErrors = false;
const results = [];

function log(status, message) {
  const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '⚠';
  const color = status === 'pass' ? colors.green : status === 'fail' ? colors.red : colors.yellow;
  console.log(`${color}${icon} ${message}${colors.reset}`);
  results.push({ status, message });
  if (status === 'fail') hasErrors = true;
}

function checkFile(filePath, description) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    log('pass', `${description}: ${filePath} exists`);
    return true;
  } else {
    log('fail', `${description}: ${filePath} not found`);
    return false;
  }
}

function validateYAML(filePath) {
  try {
    const content = fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
    yaml.load(content);
    log('pass', `Valid YAML syntax in ${filePath}`);
    return true;
  } catch (error) {
    log('fail', `Invalid YAML in ${filePath}: ${error.message}`);
    return false;
  }
}

function checkPackageJson() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Check required fields
    if (!packageJson.name) {
      log('fail', 'package.json missing "name" field');
      return false;
    }
    if (!packageJson.version) {
      log('fail', 'package.json missing "version" field');
      return false;
    }
    
    // Check scripts
    const requiredScripts = ['build', 'start'];
    for (const script of requiredScripts) {
      if (packageJson.scripts && packageJson.scripts[script]) {
        log('pass', `Required script "${script}" found`);
      } else {
        log('fail', `Missing required script "${script}" in package.json`);
      }
    }
    
    // Check Node.js engine
    if (packageJson.engines && packageJson.engines.node) {
      log('pass', `Node.js engine specified: ${packageJson.engines.node}`);
    } else {
      log('warn', 'No Node.js engine version specified in package.json');
    }
    
    return true;
  } catch (error) {
    log('fail', `Error reading package.json: ${error.message}`);
    return false;
  }
}

function checkPortConfiguration() {
  try {
    // Check server.js for process.env.PORT
    if (fs.existsSync('server.js')) {
      const serverContent = fs.readFileSync('server.js', 'utf8');
      if (serverContent.includes('process.env.PORT')) {
        log('pass', 'server.js uses process.env.PORT');
      } else {
        log('fail', 'server.js does not use process.env.PORT');
      }
      
      if (serverContent.includes('0.0.0.0')) {
        log('pass', 'server.js binds to 0.0.0.0 (all interfaces)');
      } else if (serverContent.includes('localhost') || serverContent.includes('127.0.0.1')) {
        log('fail', 'server.js binds to localhost/127.0.0.1 - should bind to 0.0.0.0');
      }
    }
    
    return true;
  } catch (error) {
    log('fail', `Error checking port configuration: ${error.message}`);
    return false;
  }
}

function checkGitHubRepository() {
  try {
    const appYaml = yaml.load(fs.readFileSync('.do/app.yaml', 'utf8'));
    const githubRepo = appYaml.services[0].github.repo;
    
    if (githubRepo && !githubRepo.endsWith('.git')) {
      log('pass', `GitHub repository format correct: ${githubRepo}`);
    } else {
      log('fail', 'GitHub repository should not include .git extension');
    }
    
    // Check if USERNAME needs to be replaced
    if (githubRepo.includes('USERNAME')) {
      log('fail', 'GitHub repository still contains placeholder "USERNAME" - update with actual username');
    }
    
    return true;
  } catch (error) {
    log('warn', `Could not verify GitHub repository: ${error.message}`);
    return false;
  }
}

function testBuildLocally() {
  console.log(`\n${colors.blue}Testing build command locally...${colors.reset}`);
  try {
    execSync('npm run build', { stdio: 'ignore' });
    log('pass', 'Build command executed successfully');
    return true;
  } catch (error) {
    log('fail', 'Build command failed - run "npm run build" to see errors');
    return false;
  }
}

function checkProjectSize() {
  try {
    const output = execSync('du -sh .', { encoding: 'utf8' });
    const size = output.trim().split('\t')[0];
    log('pass', `Project size: ${size}`);
    
    // Parse size and check if it's under 500MB
    const sizeValue = parseFloat(size);
    const sizeUnit = size.replace(/[0-9.]/g, '').trim();
    
    if (sizeUnit === 'G' || (sizeUnit === 'M' && sizeValue > 500)) {
      log('warn', 'Project size may exceed DigitalOcean limits (500MB)');
    }
    
    return true;
  } catch (error) {
    log('warn', 'Could not determine project size');
    return false;
  }
}

function checkEnvironmentVariables() {
  try {
    const appYaml = yaml.load(fs.readFileSync('.do/app.yaml', 'utf8'));
    const envVars = appYaml.services[0].envs || [];
    
    const requiredVars = ['NODE_ENV', 'PORT'];
    for (const varName of requiredVars) {
      const found = envVars.find(env => env.key === varName);
      if (found) {
        log('pass', `Required environment variable "${varName}" configured`);
      } else {
        log('warn', `Consider adding environment variable "${varName}"`);
      }
    }
    
    // Check for hardcoded secrets
    const secretVars = envVars.filter(env => env.type === 'SECRET');
    log('pass', `${secretVars.length} environment variables marked as SECRET`);
    
    return true;
  } catch (error) {
    log('warn', `Could not check environment variables: ${error.message}`);
    return false;
  }
}

// Run all checks
console.log(`${colors.blue}DigitalOcean Deployment Validation${colors.reset}`);
console.log('==================================\n');

// 1. Check for required files
checkFile('.do/app.yaml', 'DigitalOcean app configuration');
checkFile('package.json', 'Package configuration');
checkFile('.gitignore', 'Git ignore file');

// 2. Validate YAML syntax
if (fs.existsSync('.do/app.yaml')) {
  validateYAML('.do/app.yaml');
}

// 3. Check package.json
checkPackageJson();

// 4. Check port configuration
checkPortConfiguration();

// 5. Check GitHub repository
if (fs.existsSync('.do/app.yaml')) {
  checkGitHubRepository();
}

// 6. Check environment variables
if (fs.existsSync('.do/app.yaml')) {
  checkEnvironmentVariables();
}

// 7. Check project size
checkProjectSize();

// 8. Test build locally
// testBuildLocally(); // Commented out as it may take time

// Summary
console.log(`\n${colors.blue}Validation Summary${colors.reset}`);
console.log('==================');
const passCount = results.filter(r => r.status === 'pass').length;
const failCount = results.filter(r => r.status === 'fail').length;
const warnCount = results.filter(r => r.status === 'warn').length;

console.log(`${colors.green}Passed: ${passCount}${colors.reset}`);
console.log(`${colors.red}Failed: ${failCount}${colors.reset}`);
console.log(`${colors.yellow}Warnings: ${warnCount}${colors.reset}`);

if (hasErrors) {
  console.log(`\n${colors.red}Deployment validation failed. Fix the errors above before deploying.${colors.reset}`);
  process.exit(1);
} else {
  console.log(`\n${colors.green}Deployment validation passed!${colors.reset}`);
  process.exit(0);
}