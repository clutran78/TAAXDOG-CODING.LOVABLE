import { EventEmitter } from 'events';
import sgMail from '@sendgrid/mail';
import { resourceMonitor } from './resources';
import { memoryLeakDetector } from './memory-leak-detector';
import { logger } from '@/lib/logger';

interface Alert {
  id: string;
  type: 'memory' | 'cpu' | 'disk' | 'memory-leak' | 'error';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: Date;
}

interface AlertConfig {
  email?: {
    enabled: boolean;
    recipients: string[];
    sendGridApiKey?: string;
  };
  webhook?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
  };
  console?: {
    enabled: boolean;
  };
  thresholds?: {
    memory: { warning: number; critical: number };
    cpu: { warning: number; critical: number };
    disk: { warning: number; critical: number };
  };
}

export class AlertingSystem extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private config: AlertConfig;
  private cooldownPeriod = 300000; // 5 minutes
  private lastAlertTime: Map<string, number> = new Map();

  constructor(config: AlertConfig = {}) {
    super();

    this.config = {
      console: { enabled: true },
      ...config,
      thresholds: {
        memory: { warning: 80, critical: 90 },
        cpu: { warning: 80, critical: 95 },
        disk: { warning: 80, critical: 90 },
        ...config.thresholds,
      },
    };

    if (this.config.email?.enabled && this.config.email.sendGridApiKey) {
      sgMail.setApiKey(this.config.email.sendGridApiKey);
    }
  }

  async sendAlert(alert: Alert) {
    // Check cooldown period
    const lastAlert = this.lastAlertTime.get(alert.type);
    if (lastAlert && Date.now() - lastAlert < this.cooldownPeriod) {
      return; // Skip alert due to cooldown
    }

    // Store alert
    this.alerts.set(alert.id, alert);
    this.lastAlertTime.set(alert.type, Date.now());

    // Send through configured channels
    const promises: Promise<void>[] = [];

    if (this.config.console?.enabled) {
      promises.push(this.sendConsoleAlert(alert));
    }

    if (this.config.email?.enabled) {
      promises.push(this.sendEmailAlert(alert));
    }

    if (this.config.webhook?.enabled) {
      promises.push(this.sendWebhookAlert(alert));
    }

    await Promise.allSettled(promises);
    this.emit('alert-sent', alert);
  }

  private async sendConsoleAlert(alert: Alert) {
    const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
    const color =
      alert.severity === 'critical'
        ? '\x1b[31m'
        : alert.severity === 'warning'
          ? '\x1b[33m'
          : '\x1b[36m';
    const reset = '\x1b[0m';

    logger.info(`\n${emoji} ${color}[${alert.severity.toUpperCase();}] ${alert.title}${reset}`);
    logger.info(`Type: ${alert.type}`);
    logger.info(`Time: ${alert.timestamp.toISOString();}`);
    logger.info(`Message: ${alert.message}`);

    if (alert.metadata) {
      logger.info('Details:', JSON.stringify(alert.metadata, null, 2););
    }
    logger.info('---');
  }

  private async sendEmailAlert(alert: Alert) {
    if (!this.config.email?.recipients?.length) {
      return;
    }

    const msg = {
      to: this.config.email.recipients,
      from: process.env.EMAIL_FROM || 'alerts@taxreturnpro.com.au',
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      text: this.formatEmailText(alert),
      html: this.formatEmailHtml(alert),
    };

    try {
      await sgMail.sendMultiple(msg);
    } catch (error) {
      logger.error('Failed to send email alert:', error);
    }
  }

  private async sendWebhookAlert(alert: Alert) {
    if (!this.config.webhook?.url) {
      return;
    }

    try {
      const response = await fetch(this.config.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.webhook.headers,
        },
        body: JSON.stringify({
          alert,
          timestamp: Date.now(),
          environment: process.env.NODE_ENV,
        }),
      });

      if (!response.ok) {
        logger.error('Webhook alert failed:', response.statusText);
      }
    } catch (error) {
      logger.error('Failed to send webhook alert:', error);
    }
  }

  private formatEmailText(alert: Alert): string {
    let text = `${alert.title}\n\n`;
    text += `Severity: ${alert.severity.toUpperCase()}\n`;
    text += `Type: ${alert.type}\n`;
    text += `Time: ${alert.timestamp.toISOString()}\n\n`;
    text += `Message:\n${alert.message}\n\n`;

    if (alert.metadata) {
      text += `Details:\n${JSON.stringify(alert.metadata, null, 2)}\n`;
    }

    return text;
  }

  private formatEmailHtml(alert: Alert): string {
    const severityColor =
      alert.severity === 'critical'
        ? '#dc3545'
        : alert.severity === 'warning'
          ? '#ffc107'
          : '#17a2b8';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${severityColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
          <h2 style="margin: 0;">${alert.title}</h2>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6;">
          <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
          <p><strong>Type:</strong> ${alert.type}</p>
          <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
          <hr style="border-color: #dee2e6;">
          <p><strong>Message:</strong></p>
          <p style="background-color: white; padding: 10px; border-radius: 3px; border: 1px solid #dee2e6;">
            ${alert.message.replace(/\n/g, '<br>')}
          </p>
          ${
            alert.metadata
              ? `
            <p><strong>Additional Details:</strong></p>
            <pre style="background-color: white; padding: 10px; border-radius: 3px; border: 1px solid #dee2e6; overflow-x: auto;">
${JSON.stringify(alert.metadata, null, 2)}
            </pre>
          `
              : ''
          }
        </div>
      </div>
    `;
  }

  resolveAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alert-resolved', alert);
    }
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter((a) => !a.resolved);
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  clearResolvedAlerts() {
    for (const [id, alert] of this.alerts) {
      if (alert.resolved) {
        this.alerts.delete(id);
      }
    }
  }

  // Integration with resource monitor
  startResourceMonitoring() {
    resourceMonitor.startMonitoring(30000); // Check every 30 seconds

    // Listen for metrics collection
    setInterval(async () => {
      const metrics = resourceMonitor.getLatestMetrics();
      if (!metrics) return;

      // Check for alerts
      for (const alert of metrics.alerts) {
        await this.sendAlert({
          id: `resource-${alert.type}-${Date.now()}`,
          type: alert.type,
          severity: alert.severity,
          title: `Resource Alert: ${alert.type}`,
          message: alert.message,
          timestamp: new Date(),
          metadata: {
            value: alert.value,
            threshold: alert.threshold,
            metrics: {
              memory: metrics.memory,
              cpu: metrics.cpu,
              disk: metrics.disk,
            },
          },
        });
      }
    }, 60000); // Check every minute
  }

  // Integration with memory leak detector
  startMemoryLeakMonitoring() {
    memoryLeakDetector.on('leak-detected', async (report) => {
      await this.sendAlert({
        id: `memory-leak-${Date.now()}`,
        type: 'memory-leak',
        severity: report.growthRate > 10 ? 'critical' : 'warning',
        title: 'Memory Leak Detected',
        message: report.recommendations.join('\n'),
        timestamp: new Date(),
        metadata: {
          confidence: report.confidence,
          growthRate: report.growthRate,
          trend: report.trend,
          snapshots: report.snapshots.length,
        },
      });
    });

    memoryLeakDetector.startMonitoring();
  }
}

// Create and export singleton
export const alertingSystem = new AlertingSystem({
  console: { enabled: true },
  email: {
    enabled: !!process.env.SENDGRID_API_KEY,
    recipients: process.env.ALERT_RECIPIENTS?.split(',') || [],
    sendGridApiKey: process.env.SENDGRID_API_KEY,
  },
  webhook: {
    enabled: !!process.env.ALERT_WEBHOOK_URL,
    url: process.env.ALERT_WEBHOOK_URL || '',
  },
});
