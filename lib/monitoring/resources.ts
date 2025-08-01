import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/lib/logger';

const execAsync = promisify(exec);

interface ResourceMetrics {
  timestamp: Date;
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  cpu: {
    cores: number;
    loadAverage: number[];
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  alerts: ResourceAlert[];
}

interface ResourceAlert {
  type: 'memory' | 'cpu' | 'disk';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
}

interface ResourceThresholds {
  memory: { warning: number; critical: number };
  cpu: { warning: number; critical: number };
  disk: { warning: number; critical: number };
}

export class ResourceMonitor {
  private static instance: ResourceMonitor;
  private metrics: ResourceMetrics[] = [];
  private maxMetricsHistory = 100;
  private monitoringInterval: NodeJS.Timeout | null = null;

  private thresholds: ResourceThresholds = {
    memory: { warning: 80, critical: 90 },
    cpu: { warning: 80, critical: 95 },
    disk: { warning: 80, critical: 90 },
  };

  private constructor() {}

  static getInstance(): ResourceMonitor {
    if (!ResourceMonitor.instance) {
      ResourceMonitor.instance = new ResourceMonitor();
    }
    return ResourceMonitor.instance;
  }

  async collectMetrics(): Promise<ResourceMetrics> {
    const [memory, cpu, disk] = await Promise.all([
      this.getMemoryMetrics(),
      this.getCPUMetrics(),
      this.getDiskMetrics(),
    ]);

    const alerts = this.checkThresholds(memory, cpu, disk);

    const metrics: ResourceMetrics = {
      timestamp: new Date(),
      memory,
      cpu,
      disk,
      alerts,
    };

    // Store metrics
    this.metrics.push(metrics);
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    // Log critical alerts
    alerts
      .filter((a) => a.severity === 'critical')
      .forEach((alert) => {
        logger.error(`🚨 CRITICAL: ${alert.message}`);
      });

    return metrics;
  }

  private async getMemoryMetrics() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const percentage = Math.round((usedMemory / totalMemory) * 100);

    return {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      percentage,
    };
  }

  private async getCPUMetrics() {
    const cores = os.cpus().length;
    const loadAverage = os.loadavg();
    // Normalize load average to percentage (load / cores * 100)
    const percentage = Math.round((loadAverage[0] / cores) * 100);

    return {
      cores,
      loadAverage,
      percentage,
    };
  }

  private async getDiskMetrics() {
    try {
      const stats = await fs.promises.statfs(process.cwd());
      const totalSpace = stats.blocks * stats.bsize;
      const availableSpace = stats.bavail * stats.bsize;
      const usedSpace = totalSpace - availableSpace;
      const percentage = Math.round((usedSpace / totalSpace) * 100);

      return {
        total: totalSpace,
        used: usedSpace,
        free: availableSpace,
        percentage,
      };
    } catch (error) {
      logger.error('Error getting disk metrics:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        percentage: 0,
      };
    }
  }

  private checkThresholds(memory: any, cpu: any, disk: any): ResourceAlert[] {
    const alerts: ResourceAlert[] = [];

    // Check memory
    if (memory.percentage >= this.thresholds.memory.critical) {
      alerts.push({
        type: 'memory',
        severity: 'critical',
        message: `Memory usage at ${memory.percentage}% - Immediate action required!`,
        value: memory.percentage,
        threshold: this.thresholds.memory.critical,
      });
    } else if (memory.percentage >= this.thresholds.memory.warning) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `Memory usage at ${memory.percentage}% - Monitoring required`,
        value: memory.percentage,
        threshold: this.thresholds.memory.warning,
      });
    }

    // Check CPU
    if (cpu.percentage >= this.thresholds.cpu.critical) {
      alerts.push({
        type: 'cpu',
        severity: 'critical',
        message: `CPU load at ${cpu.percentage}% - System overloaded!`,
        value: cpu.percentage,
        threshold: this.thresholds.cpu.critical,
      });
    } else if (cpu.percentage >= this.thresholds.cpu.warning) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: `CPU load at ${cpu.percentage}% - High load detected`,
        value: cpu.percentage,
        threshold: this.thresholds.cpu.warning,
      });
    }

    // Check disk
    if (disk.percentage >= this.thresholds.disk.critical) {
      alerts.push({
        type: 'disk',
        severity: 'critical',
        message: `Disk usage at ${disk.percentage}% - Storage critically low!`,
        value: disk.percentage,
        threshold: this.thresholds.disk.critical,
      });
    } else if (disk.percentage >= this.thresholds.disk.warning) {
      alerts.push({
        type: 'disk',
        severity: 'warning',
        message: `Disk usage at ${disk.percentage}% - Consider cleanup`,
        value: disk.percentage,
        threshold: this.thresholds.disk.warning,
      });
    }

    return alerts;
  }

  startMonitoring(intervalMs: number = 60000) {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        logger.error('Error collecting resource metrics:', error);
      }
    }, intervalMs);

    // Collect initial metrics
    this.collectMetrics();
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  getLatestMetrics(): ResourceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  getMetricsHistory(): ResourceMetrics[] {
    return [...this.metrics];
  }

  async detectMemoryLeaks(durationMs: number = 300000): Promise<boolean> {
    // Collect metrics over time to detect memory leaks
    const startMetrics = await this.collectMetrics();

    return new Promise((resolve) => {
      setTimeout(async () => {
        const endMetrics = await this.collectMetrics();

        // Check if memory usage increased significantly
        const memoryIncrease = endMetrics.memory.percentage - startMetrics.memory.percentage;
        const hasLeak = memoryIncrease > 10; // 10% increase indicates potential leak

        if (hasLeak) {
          console.error(
            `🚨 Potential memory leak detected! Memory increased by ${memoryIncrease}%`,
          );
        }

        resolve(hasLeak);
      }, durationMs);
    });
  }

  async generateResourceReport(): Promise<string> {
    const metrics = await this.collectMetrics();
    const history = this.getMetricsHistory();

    const report = {
      current: metrics,
      summary: {
        averageMemory: this.calculateAverage(history, 'memory'),
        averageCPU: this.calculateAverage(history, 'cpu'),
        averageDisk: this.calculateAverage(history, 'disk'),
        criticalAlerts: history.flatMap((m) => m.alerts).filter((a) => a.severity === 'critical')
          .length,
        warningAlerts: history.flatMap((m) => m.alerts).filter((a) => a.severity === 'warning')
          .length,
      },
      recommendations: this.generateRecommendations(metrics),
    };

    return JSON.stringify(report, null, 2);
  }

  private calculateAverage(history: ResourceMetrics[], type: 'memory' | 'cpu' | 'disk'): number {
    if (history.length === 0) return 0;
    const sum = history.reduce((acc, m) => acc + m[type].percentage, 0);
    return Math.round(sum / history.length);
  }

  private generateRecommendations(metrics: ResourceMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.memory.percentage > 90) {
      recommendations.push('• Restart memory-intensive services');
      recommendations.push('• Check for memory leaks in applications');
      recommendations.push('• Consider increasing system memory');
    }

    if (metrics.cpu.percentage > 90) {
      recommendations.push('• Identify and optimize CPU-intensive processes');
      recommendations.push('• Check for runaway processes');
      recommendations.push('• Consider load balancing or scaling');
    }

    if (metrics.disk.percentage > 90) {
      recommendations.push('• Run disk cleanup to remove unnecessary files');
      recommendations.push('• Archive old logs and data');
      recommendations.push('• Consider expanding storage capacity');
    }

    return recommendations;
  }
}

// Export singleton instance
export const resourceMonitor = ResourceMonitor.getInstance();
