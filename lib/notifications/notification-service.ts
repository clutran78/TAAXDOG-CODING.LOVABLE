import { z } from 'zod';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { getCacheManager, CacheTTL } from '@/lib/services/cache/cacheManager';
import { emailService, EmailType } from '@/lib/services/email-service';
import { format, differenceInDays, addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Goal, Budget, User } from '@prisma/client';
import Queue from 'bull';
import Redis from 'ioredis';

// Notification types
export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
  SLACK = 'SLACK',
}

export enum NotificationType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
}

export enum NotificationCategory {
  FINANCIAL = 'FINANCIAL',
  GOAL = 'GOAL',
  BUDGET = 'BUDGET',
  TAX = 'TAX',
  SECURITY = 'SECURITY',
  SYSTEM = 'SYSTEM',
  MARKETING = 'MARKETING',
  ACCOUNT = 'ACCOUNT',
  TRANSACTION = 'TRANSACTION',
  DOCUMENT = 'DOCUMENT',
}

// Notification events
export enum NotificationEvent {
  // Goal events
  GOAL_CREATED = 'GOAL_CREATED',
  GOAL_PROGRESS = 'GOAL_PROGRESS',
  GOAL_ACHIEVED = 'GOAL_ACHIEVED',
  GOAL_AT_RISK = 'GOAL_AT_RISK',
  GOAL_MILESTONE = 'GOAL_MILESTONE',

  // Budget events
  BUDGET_CREATED = 'BUDGET_CREATED',
  BUDGET_WARNING = 'BUDGET_WARNING',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  BUDGET_PERIOD_END = 'BUDGET_PERIOD_END',

  // Transaction events
  LARGE_TRANSACTION = 'LARGE_TRANSACTION',
  UNUSUAL_ACTIVITY = 'UNUSUAL_ACTIVITY',
  RECURRING_DETECTED = 'RECURRING_DETECTED',

  // Tax events
  TAX_DEADLINE = 'TAX_DEADLINE',
  TAX_DOCUMENT_READY = 'TAX_DOCUMENT_READY',
  TAX_REFUND_STATUS = 'TAX_REFUND_STATUS',
  QUARTERLY_BAS = 'QUARTERLY_BAS',

  // Account events
  LOGIN_NEW_DEVICE = 'LOGIN_NEW_DEVICE',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  SUBSCRIPTION_RENEWAL = 'SUBSCRIPTION_RENEWAL',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',

  // System events
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  NEW_FEATURE = 'NEW_FEATURE',
  DATA_EXPORT_READY = 'DATA_EXPORT_READY',
  WEEKLY_SUMMARY = 'WEEKLY_SUMMARY',
  MONTHLY_REPORT = 'MONTHLY_REPORT',
}

// Notification data interfaces
export interface NotificationData {
  event: NotificationEvent;
  userId: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl?: string;
  actionText?: string;
  channels?: NotificationChannel[];
  scheduledFor?: Date;
  expiresAt?: Date;
  groupKey?: string;
  deduplicationKey?: string;
}

export interface NotificationPreferences {
  email: {
    enabled: boolean;
    frequency: 'immediate' | 'daily' | 'weekly';
    categories: NotificationCategory[];
    quietHours?: { start: string; end: string };
  };
  push: {
    enabled: boolean;
    categories: NotificationCategory[];
    quietHours?: { start: string; end: string };
  };
  inApp: {
    enabled: boolean;
    categories: NotificationCategory[];
  };
  sms: {
    enabled: boolean;
    categories: NotificationCategory[];
    emergencyOnly: boolean;
  };
  preferences: {
    timezone: string;
    language: string;
    marketingOptIn: boolean;
    digestPreference: 'none' | 'daily' | 'weekly';
  };
}

// Default preferences
const DEFAULT_PREFERENCES: NotificationPreferences = {
  email: {
    enabled: true,
    frequency: 'immediate',
    categories: Object.values(NotificationCategory).filter(
      (c) => c !== NotificationCategory.MARKETING,
    ),
  },
  push: {
    enabled: true,
    categories: [
      NotificationCategory.FINANCIAL,
      NotificationCategory.GOAL,
      NotificationCategory.BUDGET,
      NotificationCategory.SECURITY,
    ],
  },
  inApp: {
    enabled: true,
    categories: Object.values(NotificationCategory),
  },
  sms: {
    enabled: false,
    categories: [NotificationCategory.SECURITY],
    emergencyOnly: true,
  },
  preferences: {
    timezone: 'Australia/Sydney',
    language: 'en',
    marketingOptIn: false,
    digestPreference: 'none',
  },
};

// Queue configuration
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

const notificationQueue = new Queue('notifications', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

/**
 * Comprehensive notification service
 */
export class NotificationService {
  private static instance: NotificationService;
  private initialized: boolean = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize notification service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Process notification queue
      notificationQueue.process('send-notification', async (job) => {
        return this.processNotification(job.data);
      });

      // Process digest queue
      notificationQueue.process('send-digest', async (job) => {
        return this.sendDigest(job.data.userId, job.data.type);
      });

      // Schedule recurring jobs
      await this.scheduleRecurringJobs();

      this.initialized = true;
      logger.info('Notification service initialized');
    } catch (error) {
      logger.error('Failed to initialize notification service', { error });
      throw error;
    }
  }

  /**
   * Send notification
   */
  public async send(notification: NotificationData): Promise<string> {
    const notificationId = crypto.randomUUID();

    try {
      // Validate notification data
      this.validateNotification(notification);

      // Check user preferences
      const preferences = await this.getUserPreferences(notification.userId);
      if (!preferences) {
        logger.warn('User preferences not found, using defaults', { userId: notification.userId });
      }

      // Deduplicate if key provided
      if (notification.deduplicationKey) {
        const isDuplicate = await this.checkDuplication(
          notification.userId,
          notification.deduplicationKey,
        );
        if (isDuplicate) {
          logger.debug('Duplicate notification skipped', {
            userId: notification.userId,
            deduplicationKey: notification.deduplicationKey,
          });
          return notificationId;
        }
      }

      // Determine channels based on preferences and priority
      const channels = this.determineChannels(notification, preferences || DEFAULT_PREFERENCES);

      // Queue notification
      await notificationQueue.add(
        'send-notification',
        {
          id: notificationId,
          ...notification,
          channels,
          createdAt: new Date(),
        },
        {
          delay: notification.scheduledFor ? notification.scheduledFor.getTime() - Date.now() : 0,
          priority: this.getPriorityValue(notification.priority),
        },
      );

      logger.info('Notification queued', {
        notificationId,
        userId: notification.userId,
        event: notification.event,
        channels,
      });

      return notificationId;
    } catch (error) {
      logger.error('Failed to send notification', {
        error,
        notificationId,
        event: notification.event,
        userId: notification.userId,
      });
      throw error;
    }
  }

  /**
   * Send goal progress notification
   */
  public async sendGoalProgressUpdate(goal: Goal & { contributions?: any[] }): Promise<void> {
    const progress = goal.targetAmount.gt(0)
      ? Math.round(goal.currentAmount.div(goal.targetAmount).toNumber() * 100)
      : 0;

    let event: NotificationEvent;
    let title: string;
    let message: string;
    let priority: NotificationPriority = NotificationPriority.MEDIUM;

    // Determine notification type based on progress
    if (progress >= 100) {
      event = NotificationEvent.GOAL_ACHIEVED;
      title = '🎉 Goal Achieved!';
      message = `Congratulations! You've reached your goal "${goal.title}" with $${goal.currentAmount.toLocaleString()}.`;
      priority = NotificationPriority.HIGH;
    } else if (progress >= 75 && progress < 100) {
      event = NotificationEvent.GOAL_MILESTONE;
      title = '🎯 Goal Milestone';
      message = `Great progress! You're ${progress}% of the way to your "${goal.title}" goal.`;
    } else if (goal.targetDate) {
      const daysRemaining = differenceInDays(new Date(goal.targetDate), new Date());
      const requiredDailyAmount = goal.targetAmount
        .sub(goal.currentAmount)
        .div(Math.max(daysRemaining, 1))
        .toNumber();

      if (daysRemaining < 30 && requiredDailyAmount > 100) {
        event = NotificationEvent.GOAL_AT_RISK;
        title = '⚠️ Goal at Risk';
        message = `Your goal "${goal.title}" may be at risk. You need to save $${requiredDailyAmount.toFixed(2)} daily to meet your deadline.`;
        priority = NotificationPriority.HIGH;
      } else {
        event = NotificationEvent.GOAL_PROGRESS;
        title = '📊 Goal Progress Update';
        message = `You're ${progress}% of the way to your "${goal.title}" goal. Keep it up!`;
      }
    } else {
      event = NotificationEvent.GOAL_PROGRESS;
      title = '📊 Goal Progress Update';
      message = `You've saved $${goal.currentAmount.toLocaleString()} towards your "${goal.title}" goal (${progress}% complete).`;
    }

    await this.send({
      event,
      userId: goal.userId,
      category: NotificationCategory.GOAL,
      priority,
      title,
      message,
      data: {
        goalId: goal.id,
        goalName: goal.title,
        progress,
        currentAmount: goal.currentAmount,
        targetAmount: goal.targetAmount,
        deadline: goal.targetDate,
      },
      actionUrl: `/goals/${goal.id}`,
      actionText: 'View Goal',
    });
  }

  /**
   * Send budget alert
   */
  public async sendBudgetAlert(
    budget: Budget & { categories?: any[] },
    spent: number,
    userId: string,
  ): Promise<void> {
    const percentage =
      budget.monthlyBudget && budget.monthlyBudget.gt(0)
        ? Math.round((spent / budget.monthlyBudget.toNumber()) * 100)
        : 0;

    let event: NotificationEvent;
    let title: string;
    let message: string;
    let priority: NotificationPriority = NotificationPriority.MEDIUM;

    if (percentage >= 100) {
      event = NotificationEvent.BUDGET_EXCEEDED;
      title = '🚨 Budget Exceeded';
      message = `You've exceeded your "${budget.name}" budget by $${(spent - budget.monthlyBudget.toNumber()).toFixed(2)}.`;
      priority = NotificationPriority.HIGH;
    } else if (percentage >= 90) {
      event = NotificationEvent.BUDGET_WARNING;
      title = '⚠️ Budget Warning';
      message = `You've used ${percentage}% of your "${budget.name}" budget. Only $${(budget.monthlyBudget.toNumber() - spent).toFixed(2)} remaining.`;
      priority = NotificationPriority.HIGH;
    } else if (percentage >= 75) {
      event = NotificationEvent.BUDGET_WARNING;
      title = '📊 Budget Update';
      message = `You've used ${percentage}% of your "${budget.name}" budget this period.`;
    } else {
      return; // Don't send notification for low usage
    }

    await this.send({
      event,
      userId,
      category: NotificationCategory.BUDGET,
      priority,
      title,
      message,
      data: {
        budgetId: budget.id,
        budgetName: budget.name,
        percentage,
        spent,
        totalAmount: budget.monthlyBudget.toNumber(),
        remaining: Math.max(0, budget.monthlyBudget.toNumber() - spent),
      },
      actionUrl: `/budgets/${budget.id}`,
      actionText: 'View Budget',
      deduplicationKey: `budget-alert-${budget.id}-${event}-${new Date().toISOString().split('T')[0]}`,
    });
  }

  /**
   * Send tax deadline reminder
   */
  public async sendTaxDeadlineReminder(
    userId: string,
    deadline: Date,
    type: string,
  ): Promise<void> {
    const daysUntilDeadline = differenceInDays(deadline, new Date());

    if (daysUntilDeadline > 30) return; // Don't send too early

    let title: string;
    let message: string;
    let priority: NotificationPriority = NotificationPriority.MEDIUM;

    if (daysUntilDeadline <= 7) {
      priority = NotificationPriority.HIGH;
      title = '🚨 Urgent: Tax Deadline Approaching';
      message = `Your ${type} is due in ${daysUntilDeadline} days (${format(deadline, 'dd MMM yyyy')}). Submit now to avoid penalties.`;
    } else if (daysUntilDeadline <= 14) {
      priority = NotificationPriority.HIGH;
      title = '⚠️ Tax Deadline Reminder';
      message = `Your ${type} is due in ${daysUntilDeadline} days. Start preparing your documents now.`;
    } else {
      title = '📅 Tax Deadline Reminder';
      message = `Your ${type} is due on ${format(deadline, 'dd MMM yyyy')} (${daysUntilDeadline} days).`;
    }

    await this.send({
      event: NotificationEvent.TAX_DEADLINE,
      userId,
      category: NotificationCategory.TAX,
      priority,
      title,
      message,
      data: {
        deadlineType: type,
        deadline,
        daysRemaining: daysUntilDeadline,
      },
      actionUrl: '/tax/deadlines',
      actionText: 'View Tax Calendar',
      deduplicationKey: `tax-deadline-${type}-${deadline.toISOString().split('T')[0]}`,
    });
  }

  /**
   * Send weekly summary
   */
  public async sendWeeklySummary(userId: string): Promise<void> {
    try {
      // Get user data for the week
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      const [transactions, goals, budgets, user] = await Promise.all([
        // Get week's transactions
        prisma.bank_transactions.findMany({
          where: {
            bank_account: {
              basiq_user_id: userId,
            },
            transaction_date: { gte: weekStart },
          },
          orderBy: { transaction_date: 'desc' },
          take: 50,
        }),
        // Get active goals
        prisma.goal.findMany({
          where: {
            userId,
            status: 'ACTIVE',
          },
        }),
        // Get active budgets
        prisma.budget.findMany({
          where: {
            userId,
            status: 'ACTIVE',
          },
        }),
        // Get user
        prisma.user.findUnique({
          where: { id: userId },
        }),
      ]);

      if (!user) return;

      // Calculate summary data
      const income = transactions
        .filter((t) => t.direction === 'credit')
        .reduce((sum, t) => sum + t.amount.toNumber(), 0);

      const expenses = transactions
        .filter((t) => t.direction === 'debit')
        .reduce((sum, t) => sum + Math.abs(t.amount.toNumber()), 0);

      const netSavings = income - expenses;
      const goalProgress = goals.map((g) => ({
        name: g.title,
        progress: g.targetAmount.gt(0)
          ? Math.round(g.currentAmount.div(g.targetAmount).toNumber() * 100)
          : 0,
      }));

      // Send email summary
      await emailService.sendTransactional(
        EmailType.WEEKLY_SUMMARY,
        user.email,
        {
          name: user.name,
          weekStart: format(weekStart, 'dd MMM'),
          weekEnd: format(new Date(), 'dd MMM'),
          income: income.toFixed(2),
          expenses: expenses.toFixed(2),
          netSavings: netSavings.toFixed(2),
          transactionCount: transactions.length,
          goalProgress,
          activeGoals: goals.length,
          activeBudgets: budgets.length,
        },
        userId,
      );

      logger.info('Weekly summary sent', {
        userId,
        income,
        expenses,
        netSavings,
      });
    } catch (error) {
      logger.error('Failed to send weekly summary', {
        error,
        userId,
      });
    }
  }

  /**
   * Process notification
   */
  private async processNotification(data: NotificationData & { id: string }): Promise<void> {
    const { id, channels = [], userId } = data;

    try {
      // Create notification record
      // TODO: Implement notification model when added to schema
      logger.info('Notification would be created', {
        id,
        userId,
        type: data.event,
        priority: data.priority || NotificationPriority.MEDIUM,
        title: data.title,
        message: data.message,
        data: data.data,
        actionUrl: data.actionUrl,
        category: data.category,
        channels: channels,
        expiresAt: data.expiresAt,
      });

      // Send to each channel
      const results = await Promise.allSettled(
        channels.map((channel) => this.sendToChannel(channel, data, id)),
      );

      // Update delivery status
      const deliveredChannels = channels.filter(
        (_, index) => results[index].status === 'fulfilled',
      );

      // TODO: Implement notification status update when notification model is added
      logger.info('Notification delivery status', {
        id,
        deliveredChannels: deliveredChannels.length,
        totalChannels: channels.length,
        deliveryStatus: deliveredChannels.length === channels.length ? 'DELIVERED' : 'PARTIAL',
        failedChannels: channels.filter((_, index) => results[index].status === 'rejected'),
      });

      logger.info('Notification processed', {
        notificationId: id,
        userId,
        channels,
        delivered: deliveredChannels,
      });
    } catch (error) {
      logger.error('Failed to process notification', {
        error,
        notificationId: id,
        userId,
      });
      throw error;
    }
  }

  /**
   * Send to specific channel
   */
  private async sendToChannel(
    channel: NotificationChannel,
    data: NotificationData,
    notificationId: string,
  ): Promise<void> {
    switch (channel) {
      case 'EMAIL':
        await this.sendEmailNotification(data);
        break;

      case 'PUSH':
        await this.sendPushNotification(data);
        break;

      case 'SMS':
        await this.sendSMSNotification(data);
        break;

      case 'IN_APP':
        // In-app notifications are created in the database
        // Client polls or uses WebSocket for real-time updates
        break;

      default:
        logger.warn('Unknown notification channel', { channel });
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(data: NotificationData): Promise<void> {
    // Map notification events to email types
    const emailTypeMap: Record<NotificationEvent, EmailType> = {
      [NotificationEvent.GOAL_ACHIEVED]: EmailType.GOAL_ACHIEVED,
      [NotificationEvent.BUDGET_EXCEEDED]: EmailType.BUDGET_ALERT,
      [NotificationEvent.LOGIN_NEW_DEVICE]: EmailType.LOGIN_ALERT,
      [NotificationEvent.PASSWORD_CHANGED]: EmailType.PASSWORD_CHANGED,
      [NotificationEvent.TAX_DOCUMENT_READY]: EmailType.TAX_SUMMARY,
      [NotificationEvent.DATA_EXPORT_READY]: EmailType.DATA_EXPORT_READY,
      [NotificationEvent.WEEKLY_SUMMARY]: EmailType.WEEKLY_SUMMARY,
      [NotificationEvent.MONTHLY_REPORT]: EmailType.MONTHLY_REPORT,
      // Add more mappings
    } as any;

    const emailType = emailTypeMap[data.event];
    if (!emailType) {
      logger.warn('No email template for event', { event: data.event });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { email: true, name: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    await emailService.sendTransactional(
      emailType,
      user.email,
      {
        name: user.name,
        title: data.title,
        message: data.message,
        actionUrl: data.actionUrl ? `${process.env.NEXTAUTH_URL}${data.actionUrl}` : undefined,
        actionText: data.actionText,
        ...data.data,
      },
      data.userId,
    );
  }

  /**
   * Send push notification (mock)
   */
  private async sendPushNotification(data: NotificationData): Promise<void> {
    // TODO: Integrate with push notification service (FCM, APNS)
    logger.info('Push notification would be sent', {
      userId: data.userId,
      title: data.title,
    });
  }

  /**
   * Send SMS notification (mock)
   */
  private async sendSMSNotification(data: NotificationData): Promise<void> {
    // TODO: Integrate with SMS service (Twilio, AWS SNS)
    logger.info('SMS notification would be sent', {
      userId: data.userId,
      message: data.message.substring(0, 160), // SMS limit
    });
  }

  /**
   * Get user preferences
   */
  public async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const cacheManager = await getCacheManager();
    const cacheKey = `notification:preferences:${userId}`;

    // Try cache first
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return cached as NotificationPreferences;
    }

    // Get from database
    // TODO: Implement when notificationPreference model is added
    // const preferences = await prisma.notificationPreference.findUnique({
    //   where: { userId },
    // });

    // Return default preferences for now
    const defaultPreferences: NotificationPreferences = {
      preferences: {
        email: {
          enabled: true,
          frequency: 'immediate' as const,
          categories: [NotificationCategory.BUDGET, NotificationCategory.GOAL],
        },
        sms: {
          enabled: false,
          categories: [],
          emergencyOnly: true,
        },
        push: {
          enabled: true,
          categories: [NotificationCategory.BUDGET, NotificationCategory.GOAL],
        },
        inApp: {
          enabled: true,
          categories: [NotificationCategory.BUDGET],
        },
      },
    };

    await cacheManager.set(cacheKey, defaultPreferences, 60 * 60 * 24);
    return defaultPreferences;
  }

  /**
   * Update user preferences
   */
  public async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const current = (await this.getUserPreferences(userId)) || DEFAULT_PREFERENCES;

    const updated = {
      ...current,
      ...preferences,
      email: { ...current.email, ...preferences.email },
      push: { ...current.push, ...preferences.push },
      inApp: { ...current.inApp, ...preferences.inApp },
      sms: { ...current.sms, ...preferences.sms },
      preferences: { ...current.preferences, ...preferences.preferences },
    };

    await prisma.notificationPreference.upsert({
      where: { userId },
      update: {
        preferences: updated as any,
        updatedAt: new Date(),
      },
      create: {
        userId,
        preferences: updated as any,
      },
    });

    // Clear cache
    const cacheManager = await getCacheManager();
    await cacheManager.delete(`notification:preferences:${userId}`);

    logger.info('Notification preferences updated', { userId });

    return updated;
  }

  /**
   * Validate notification
   */
  private validateNotification(notification: NotificationData): void {
    if (!notification.userId) {
      throw new Error('User ID is required');
    }
    if (!notification.title || !notification.message) {
      throw new Error('Title and message are required');
    }
    if (notification.title.length > 100) {
      throw new Error('Title must be 100 characters or less');
    }
    if (notification.message.length > 1000) {
      throw new Error('Message must be 1000 characters or less');
    }
  }

  /**
   * Check for duplicate notifications
   */
  private async checkDuplication(userId: string, key: string): Promise<boolean> {
    const cacheKey = `notification:dedup:${userId}:${key}`;
    const exists = await redisClient.get(cacheKey);

    if (exists) {
      return true;
    }

    // Set deduplication key with 24 hour expiry
    await redisClient.setex(cacheKey, 86400, '1');
    return false;
  }

  /**
   * Determine notification channels
   */
  private determineChannels(
    notification: NotificationData,
    preferences: NotificationPreferences,
  ): NotificationChannel[] {
    const channels: NotificationChannel[] = [];

    // Override channels if specified
    if (notification.channels && notification.channels.length > 0) {
      return notification.channels;
    }

    // Check if in quiet hours
    const now = new Date();
    const currentHour = now.getHours();

    // Email channel
    if (preferences.email.enabled && preferences.email.categories.includes(notification.category)) {
      const inQuietHours = this.isInQuietHours(currentHour, preferences.email.quietHours);
      if (!inQuietHours || notification.priority === 'CRITICAL') {
        channels.push('EMAIL');
      }
    }

    // Push channel
    if (preferences.push.enabled && preferences.push.categories.includes(notification.category)) {
      const inQuietHours = this.isInQuietHours(currentHour, preferences.push.quietHours);
      if (!inQuietHours || notification.priority === 'CRITICAL') {
        channels.push('PUSH');
      }
    }

    // In-app channel (always included if enabled)
    if (preferences.inApp.enabled && preferences.inApp.categories.includes(notification.category)) {
      channels.push('IN_APP');
    }

    // SMS channel (only for critical or if emergency only is false)
    if (preferences.sms.enabled && preferences.sms.categories.includes(notification.category)) {
      if (notification.priority === 'CRITICAL' || !preferences.sms.emergencyOnly) {
        channels.push('SMS');
      }
    }

    return channels;
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(
    currentHour: number,
    quietHours?: { start: string; end: string },
  ): boolean {
    if (!quietHours) return false;

    const start = parseInt(quietHours.start.split(':')[0]);
    const end = parseInt(quietHours.end.split(':')[0]);

    if (start <= end) {
      return currentHour >= start && currentHour < end;
    } else {
      // Quiet hours span midnight
      return currentHour >= start || currentHour < end;
    }
  }

  /**
   * Get priority value for queue
   */
  private getPriorityValue(priority?: NotificationPriority): number {
    switch (priority) {
      case 'CRITICAL':
        return 1;
      case NotificationPriority.HIGH:
        return 2;
      case NotificationPriority.MEDIUM:
        return 3;
      case NotificationPriority.LOW:
        return 4;
      default:
        return 3;
    }
  }

  /**
   * Schedule recurring jobs
   */
  private async scheduleRecurringJobs(): Promise<void> {
    // Weekly summaries (Mondays at 9 AM)
    await notificationQueue.add(
      'weekly-summary',
      {},
      {
        repeat: {
          cron: '0 9 * * 1',
          tz: 'Australia/Sydney',
        },
      },
    );

    // Monthly reports (1st of month at 9 AM)
    await notificationQueue.add(
      'monthly-report',
      {},
      {
        repeat: {
          cron: '0 9 1 * *',
          tz: 'Australia/Sydney',
        },
      },
    );

    // Tax deadline checks (daily at 10 AM)
    await notificationQueue.add(
      'tax-deadline-check',
      {},
      {
        repeat: {
          cron: '0 10 * * *',
          tz: 'Australia/Sydney',
        },
      },
    );

    // Budget period end checks (daily at 6 PM)
    await notificationQueue.add(
      'budget-check',
      {},
      {
        repeat: {
          cron: '0 18 * * *',
          tz: 'Australia/Sydney',
        },
      },
    );

    logger.info('Recurring notification jobs scheduled');
  }

  /**
   * Send notification digest
   */
  private async sendDigest(userId: string, type: 'daily' | 'weekly'): Promise<void> {
    const since =
      type === 'daily'
        ? new Date(Date.now() - 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        createdAt: { gte: since },
        isRead: false,
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    if (notifications.length === 0) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user) return;

    // Group notifications by category
    const grouped = notifications.reduce(
      (acc, notif) => {
        const category = notif.category || 'OTHER';
        if (!acc[category]) acc[category] = [];
        acc[category].push(notif);
        return acc;
      },
      {} as Record<string, typeof notifications>,
    );

    // Send digest email
    await emailService.send(
      {
        to: user.email,
        subject: `Your ${type} notification digest`,
        template: EmailType.WEEKLY_SUMMARY, // Reuse template
        templateData: {
          name: user.name,
          digestType: type,
          notificationCount: notifications.length,
          groups: Object.entries(grouped).map(([category, notifs]) => ({
            category,
            notifications: notifs.map((n) => ({
              title: n.title,
              message: n.message,
              time: formatInTimeZone(n.createdAt, 'Australia/Sydney', 'MMM d, h:mm a'),
              actionUrl: n.actionUrl,
            })),
          })),
        },
      },
      userId,
    );

    // Mark notifications as delivered in digest
    await prisma.notification.updateMany({
      where: {
        id: { in: notifications.map((n) => n.id) },
      },
      data: {
        metadata: {
          digestSent: true,
          digestType: type,
          digestSentAt: new Date(),
        } as any,
      },
    });
  }

  /**
   * Get unread notification count
   */
  public async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
        expiresAt: {
          OR: [{ gte: new Date() }, { equals: null }],
        },
      },
    });
  }

  /**
   * Mark notifications as read
   */
  public async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Get notifications for user
   */
  public async getNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      category?: NotificationCategory;
      unreadOnly?: boolean;
    } = {},
  ): Promise<{
    notifications: any[];
    pagination: any;
  }> {
    const { page = 1, limit = 20, category, unreadOnly = false } = options;
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
      expiresAt: {
        OR: [{ gte: new Date() }, { equals: null }],
      },
    };

    if (category) {
      where.category = category;
    }
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ isRead: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    };
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

// Export notification templates
export const notificationTemplates = {
  goalProgress: (goal: any, progress: number) => ({
    title: '📊 Goal Progress Update',
    message: `You're ${progress}% of the way to your "${goal.title}" goal!`,
  }),

  budgetWarning: (budget: any, percentage: number) => ({
    title: '⚠️ Budget Warning',
    message: `You've used ${percentage}% of your "${budget.name}" budget.`,
  }),

  taxDeadline: (type: string, days: number) => ({
    title: '📅 Tax Deadline Reminder',
    message: `Your ${type} is due in ${days} days.`,
  }),

  loginAlert: (device: string, location: string) => ({
    title: '🔐 New Login Detected',
    message: `Your account was accessed from ${device} in ${location}.`,
  }),
};
