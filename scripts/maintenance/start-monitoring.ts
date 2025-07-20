#!/usr/bin/env npx tsx

import { resourceMonitor } from '@/lib/monitoring/resources';
import { memoryLeakDetector } from '@/lib/monitoring/memory-leak-detector';
import { alertingSystem } from '@/lib/monitoring/alerts';
import { LogCleanup } from './cleanup-logs';

async function startResourceMonitoring() {
  console.log('🚀 Starting Resource Monitoring System...\n');

  // 1. Start resource monitoring
  console.log('📊 Starting resource monitor...');
  resourceMonitor.startMonitoring(30000); // Check every 30 seconds

  // 2. Start memory leak detection
  console.log('🔍 Starting memory leak detector...');
  memoryLeakDetector.startMonitoring(60000); // Check every minute

  // 3. Start alerting system
  console.log('🚨 Starting alerting system...');
  alertingSystem.startResourceMonitoring();
  alertingSystem.startMemoryLeakMonitoring();

  // 4. Schedule periodic log cleanup
  console.log('🧹 Scheduling log cleanup...');
  const logCleanup = new LogCleanup();
  
  // Run cleanup every 6 hours
  setInterval(async () => {
    console.log('\n🧹 Running scheduled log cleanup...');
    await logCleanup.cleanup({
      dryRun: false,
      maxAge: 7,
      maxSize: 100 * 1024 * 1024
    });
  }, 6 * 60 * 60 * 1000);

  // 5. Set up graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n⏹️  Shutting down monitoring...');
    resourceMonitor.stopMonitoring();
    memoryLeakDetector.stopMonitoring();
    process.exit(0);
  });

  // 6. Initial status report
  setTimeout(async () => {
    const metrics = await resourceMonitor.collectMetrics();
    console.log('\n📈 Initial System Status:');
    console.log(`Memory: ${metrics.memory.percentage}% used`);
    console.log(`CPU: ${metrics.cpu.percentage}% load`);
    console.log(`Disk: ${metrics.disk.percentage}% used`);
    
    if (metrics.alerts.length > 0) {
      console.log('\n⚠️  Active Alerts:');
      metrics.alerts.forEach(alert => {
        console.log(`- ${alert.severity.toUpperCase()}: ${alert.message}`);
      });
    }
  }, 2000);

  console.log('\n✅ All monitoring systems active!');
  console.log('Press Ctrl+C to stop monitoring.\n');
}

// Handle critical resource situations
alertingSystem.on('alert-sent', (alert) => {
  if (alert.severity === 'critical') {
    console.error(`\n🚨 CRITICAL ALERT: ${alert.title}`);
    console.error(alert.message);
    
    // Take automatic action for critical situations
    if (alert.type === 'memory' && alert.metadata?.value > 95) {
      console.log('🔄 Attempting to free memory...');
      if (global.gc) {
        global.gc();
      }
    }
    
    if (alert.type === 'disk' && alert.metadata?.value > 95) {
      console.log('🧹 Running emergency log cleanup...');
      const cleanup = new LogCleanup();
      cleanup.cleanup({
        dryRun: false,
        maxAge: 1, // Delete logs older than 1 day
        maxSize: 10 * 1024 * 1024, // 10MB
        preserveRecent: 1
      });
    }
  }
});

// Main execution
if (require.main === module) {
  startResourceMonitoring().catch(console.error);
}

export { startResourceMonitoring };