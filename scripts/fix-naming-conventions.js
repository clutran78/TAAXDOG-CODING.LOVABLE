#!/usr/bin/env node

/**
 * Script to fix file naming conventions across the codebase
 * Renames component files from camelCase/lowercase to PascalCase
 */

const fs = require('fs');
const path = require('path');

const COMPONENT_DIRS = [
  'components/auth',
  'components/ui',
  'components/dashboard',
  'components/basiq',
  'components/budget',
  'components/Goal',
  'components/insights',
  'components/receipts',
  'components/transactions'
];

const FILE_RENAMES = {
  // Auth components
  'login.tsx': 'Login.tsx',
  'signUp.tsx': 'SignUp.tsx',
  'forgotPassword.tsx': 'ForgotPassword.tsx',
  
  // UI components
  'tabs.tsx': 'Tabs.tsx',
  'card.tsx': 'Card.tsx',
  'alert.tsx': 'Alert.tsx',
  'badge.tsx': 'Badge.tsx',
  'button.tsx': 'Button.tsx',
  'input.tsx': 'Input.tsx',
  'modal.tsx': 'Modal.tsx',
  'spinner.tsx': 'Spinner.tsx',
  
  // Dashboard components
  'subscription.tsx': 'Subscription.tsx',
  
  // Goal components
  'goalPage.tsx': 'GoalPage.tsx',
  
  // Dashboard components
  'stats-card.tsx': 'StatsCard.tsx',
  'bank-accounts-card.tsx': 'BankAccountsCard.tsx',
  'net-balance-details.tsx': 'NetBalanceDetails.tsx',
  'net-income.tsx': 'NetIncome.tsx',
  'total-expenses.tsx': 'TotalExpenses.tsx',
  
  // Other patterns
  'goals-card.tsx': 'GoalsCard.tsx',
  'balance-card.tsx': 'BalanceCard.tsx',
  'income-source-card.tsx': 'IncomeSourceCard.tsx',
  'statistic-card.tsx': 'StatisticCard.tsx',
  'transaction-table.tsx': 'TransactionTable.tsx',
  'expenses-table.tsx': 'ExpensesTable.tsx'
};

let renamedFiles = [];
let updatedImports = [];

function renameFile(dir, oldName, newName) {
  const oldPath = path.join(dir, oldName);
  const newPath = path.join(dir, newName);
  
  if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
    fs.renameSync(oldPath, newPath);
    renamedFiles.push(`${oldPath} → ${newPath}`);
    console.log(`✅ Renamed: ${oldName} → ${newName}`);
    return true;
  }
  return false;
}

function updateImports(filePath, renames) {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;
  
  for (const [oldName, newName] of Object.entries(renames)) {
    const oldImportName = oldName.replace('.tsx', '').replace('.ts', '');
    const newImportName = newName.replace('.tsx', '').replace('.ts', '');
    
    // Update various import patterns
    const patterns = [
      // from './login' → from './Login'
      new RegExp(`from ['"](.*/)?${oldImportName}['"]`, 'g'),
      // import('./login') → import('./Login')
      new RegExp(`import\\(['"](.*/)?${oldImportName}['"]\\)`, 'g'),
      // require('./login') → require('./Login')
      new RegExp(`require\\(['"](.*/)?${oldImportName}['"]\\)`, 'g')
    ];
    
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        content = content.replace(pattern, (match, path) => {
          return match.replace(oldImportName, newImportName);
        });
        updated = true;
      }
    }
  }
  
  if (updated) {
    fs.writeFileSync(filePath, content);
    updatedImports.push(filePath);
    console.log(`📝 Updated imports in: ${path.relative(process.cwd(), filePath)}`);
  }
}

function findAndUpdateImports(dir, renames) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.includes('node_modules') && !file.startsWith('.')) {
      findAndUpdateImports(filePath, renames);
    } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx'))) {
      updateImports(filePath, renames);
    }
  }
}

console.log('🔧 Starting file naming convention fixes...\n');

// Step 1: Rename files
console.log('Step 1: Renaming files to PascalCase...');
for (const dir of COMPONENT_DIRS) {
  if (fs.existsSync(dir)) {
    console.log(`\nChecking ${dir}...`);
    for (const [oldName, newName] of Object.entries(FILE_RENAMES)) {
      renameFile(dir, oldName, newName);
    }
  }
}

// Step 2: Update imports across the codebase
console.log('\n\nStep 2: Updating import statements...');
const projectRoot = process.cwd();
const dirsToSearch = ['components', 'pages', 'lib', 'hooks'];

for (const dir of dirsToSearch) {
  const fullPath = path.join(projectRoot, dir);
  if (fs.existsSync(fullPath)) {
    findAndUpdateImports(fullPath, FILE_RENAMES);
  }
}

// Summary
console.log('\n\n📊 Summary:');
console.log(`✅ Renamed ${renamedFiles.length} files`);
console.log(`📝 Updated imports in ${updatedImports.length} files`);

if (renamedFiles.length > 0) {
  console.log('\n🎯 Files renamed:');
  renamedFiles.forEach(f => console.log(`  - ${f}`));
}

console.log('\n✨ File naming convention fixes completed!');
console.log('⚠️  Please run your tests to ensure everything still works correctly.');