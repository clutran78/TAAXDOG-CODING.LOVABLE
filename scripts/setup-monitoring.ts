#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('✅ Created logs directory');
} else {
  console.log('✅ Logs directory already exists');
}

// Create .gitignore in logs directory to prevent log files from being committed
const gitignorePath = path.join(logsDir, '.gitignore');
if (!fs.existsSync(gitignorePath)) {
  fs.writeFileSync(gitignorePath, '*.log\n');
  console.log('✅ Created .gitignore in logs directory');
}

console.log('\n📊 Performance monitoring setup complete!');
console.log('\nTo use monitoring in your API endpoints:');
console.log('1. Wrap handlers with withApiMonitoring()');
console.log('2. Use createPrismaWithMonitoring() for database queries');
console.log('3. Use withPerformanceMonitoring() for specific operations');
console.log('\nView metrics at: /admin/performance');
console.log('\nMonitoring logs will be stored in:');
console.log('- logs/db-queries.log (all queries)');
console.log('- logs/slow-queries.log (queries > 100ms)');
console.log('- logs/api-requests.log (all API requests)');
console.log('- logs/api-errors.log (API errors)');
console.log('- logs/app-metrics.log (system metrics)');
console.log('- logs/client-metrics.log (browser performance)');
console.log('- logs/client-errors.log (browser errors)');