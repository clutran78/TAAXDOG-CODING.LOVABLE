import { EventEmitter } from 'events';
import v8 from 'v8';
import { performance } from 'perf_hooks';

interface HeapSnapshot {
  timestamp: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  totalSize: number;
}

interface MemoryLeakReport {
  detected: boolean;
  confidence: number;
  trend: 'stable' | 'growing' | 'shrinking';
  growthRate: number; // MB per minute
  snapshots: HeapSnapshot[];
  recommendations: string[];
}

export class MemoryLeakDetector extends EventEmitter {
  private snapshots: HeapSnapshot[] = [];
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timer | null = null;
  
  // Configuration
  private readonly config = {
    snapshotInterval: 30000, // 30 seconds
    maxSnapshots: 20,
    leakThreshold: 50, // MB growth to consider a leak
    confidenceThreshold: 0.7, // 70% confidence needed
    warmupPeriod: 5, // Number of snapshots before analysis
  };

  constructor() {
    super();
    
    // Force garbage collection if available
    if (global.gc) {
      console.log('🔍 Garbage collection is available for accurate memory leak detection');
    } else {
      console.warn('⚠️  Run with --expose-gc flag for more accurate memory leak detection');
    }
  }

  startMonitoring(interval?: number) {
    if (this.isMonitoring) {
      console.log('Memory leak monitoring already active');
      return;
    }

    const snapshotInterval = interval || this.config.snapshotInterval;
    this.isMonitoring = true;
    this.snapshots = [];

    console.log(`🔍 Starting memory leak detection (interval: ${snapshotInterval}ms)`);

    // Take initial snapshot
    this.takeSnapshot();

    // Set up periodic snapshots
    this.monitoringInterval = setInterval(() => {
      this.takeSnapshot();
      
      // Analyze after warmup period
      if (this.snapshots.length >= this.config.warmupPeriod) {
        const report = this.analyze();
        
        if (report.detected) {
          this.emit('leak-detected', report);
        }
      }
    }, snapshotInterval);
  }

  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    console.log('🛑 Stopped memory leak detection');
  }

  private takeSnapshot() {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const memoryUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    const snapshot: HeapSnapshot = {
      timestamp: Date.now(),
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers || 0,
      totalSize: heapStats.total_heap_size
    };

    this.snapshots.push(snapshot);

    // Keep only recent snapshots
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }

    this.emit('snapshot-taken', snapshot);
  }

  analyze(): MemoryLeakReport {
    if (this.snapshots.length < this.config.warmupPeriod) {
      return {
        detected: false,
        confidence: 0,
        trend: 'stable',
        growthRate: 0,
        snapshots: [...this.snapshots],
        recommendations: ['Not enough data for analysis']
      };
    }

    // Calculate memory growth
    const firstSnapshot = this.snapshots[0];
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    const timeElapsed = (lastSnapshot.timestamp - firstSnapshot.timestamp) / 1000 / 60; // minutes
    
    const memoryGrowth = (lastSnapshot.heapUsed - firstSnapshot.heapUsed) / 1024 / 1024; // MB
    const growthRate = memoryGrowth / timeElapsed; // MB per minute

    // Analyze trend using linear regression
    const trend = this.calculateTrend();
    const confidence = this.calculateConfidence(trend);

    // Determine if leak is detected
    const detected = 
      memoryGrowth > this.config.leakThreshold &&
      confidence > this.config.confidenceThreshold &&
      trend.slope > 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(detected, growthRate, trend);

    return {
      detected,
      confidence,
      trend: trend.slope > 0.1 ? 'growing' : trend.slope < -0.1 ? 'shrinking' : 'stable',
      growthRate,
      snapshots: [...this.snapshots],
      recommendations
    };
  }

  private calculateTrend(): { slope: number; intercept: number } {
    const n = this.snapshots.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    this.snapshots.forEach((snapshot, i) => {
      const x = i;
      const y = snapshot.heapUsed / 1024 / 1024; // MB
      
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  private calculateConfidence(trend: { slope: number }): number {
    // Calculate R-squared value
    const n = this.snapshots.length;
    const meanY = this.snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / n;
    
    let ssTotal = 0;
    let ssResidual = 0;

    this.snapshots.forEach((snapshot, i) => {
      const y = snapshot.heapUsed;
      const yPredicted = trend.slope * i * this.config.snapshotInterval + this.snapshots[0].heapUsed;
      
      ssTotal += Math.pow(y - meanY, 2);
      ssResidual += Math.pow(y - yPredicted, 2);
    });

    const rSquared = 1 - (ssResidual / ssTotal);
    return Math.max(0, Math.min(1, rSquared));
  }

  private generateRecommendations(detected: boolean, growthRate: number, trend: any): string[] {
    const recommendations: string[] = [];

    if (!detected) {
      recommendations.push('No memory leak detected');
      return recommendations;
    }

    // General recommendations
    recommendations.push('🚨 Memory leak detected!');
    recommendations.push(`Memory growing at ${growthRate.toFixed(2)} MB/minute`);

    // Specific recommendations based on growth rate
    if (growthRate > 10) {
      recommendations.push('CRITICAL: Severe memory leak - immediate action required');
      recommendations.push('• Restart the application immediately');
      recommendations.push('• Enable heap snapshots for debugging');
    } else if (growthRate > 5) {
      recommendations.push('WARNING: Significant memory leak');
      recommendations.push('• Plan application restart within the hour');
      recommendations.push('• Review recent code changes');
    } else {
      recommendations.push('NOTICE: Slow memory leak detected');
      recommendations.push('• Monitor closely');
      recommendations.push('• Schedule maintenance window');
    }

    // Technical recommendations
    recommendations.push('\nDebugging steps:');
    recommendations.push('• Use Chrome DevTools for heap profiling');
    recommendations.push('• Check for unregistered event listeners');
    recommendations.push('• Review closure usage and circular references');
    recommendations.push('• Examine cache implementations');
    recommendations.push('• Check database connection pooling');

    return recommendations;
  }

  generateReport(): string {
    const report = this.analyze();
    
    let output = '=== Memory Leak Detection Report ===\n';
    output += `Status: ${report.detected ? '🚨 LEAK DETECTED' : '✅ No leak detected'}\n`;
    output += `Confidence: ${(report.confidence * 100).toFixed(1)}%\n`;
    output += `Trend: ${report.trend}\n`;
    output += `Growth Rate: ${report.growthRate.toFixed(2)} MB/minute\n`;
    output += `\nSnapshots: ${this.snapshots.length}\n`;
    
    if (this.snapshots.length > 0) {
      const first = this.snapshots[0];
      const last = this.snapshots[this.snapshots.length - 1];
      output += `First: ${new Date(first.timestamp).toISOString()} - ${(first.heapUsed / 1024 / 1024).toFixed(2)} MB\n`;
      output += `Last: ${new Date(last.timestamp).toISOString()} - ${(last.heapUsed / 1024 / 1024).toFixed(2)} MB\n`;
    }
    
    output += '\nRecommendations:\n';
    report.recommendations.forEach(rec => {
      output += `${rec}\n`;
    });
    
    return output;
  }

  // Get current memory stats
  static getMemoryStats() {
    const usage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers || 0,
      heapSizeLimit: heapStats.heap_size_limit,
      totalAvailable: heapStats.total_available_size,
      percentUsed: (usage.heapUsed / heapStats.heap_size_limit) * 100
    };
  }
}

// Create singleton instance
export const memoryLeakDetector = new MemoryLeakDetector();

// Export for use in monitoring
export function enableMemoryLeakDetection() {
  memoryLeakDetector.on('leak-detected', (report: MemoryLeakReport) => {
    console.error('🚨 MEMORY LEAK DETECTED!');
    console.error(`Confidence: ${(report.confidence * 100).toFixed(1)}%`);
    console.error(`Growth rate: ${report.growthRate.toFixed(2)} MB/minute`);
    report.recommendations.forEach(rec => console.error(rec));
  });

  memoryLeakDetector.startMonitoring();
}