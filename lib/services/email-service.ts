import sgMail from '@sendgrid/mail';
import { logger } from '@/lib/logger';
import { getCacheManager, CacheTTL } from './cache/cacheManager';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { z } from 'zod';
import { auditLogger, AuditCategory, AuditSeverity } from '@/lib/audit/audit-logger';
import { AuthEvent } from '@prisma/client';
import Handlebars from 'handlebars';
import DOMPurify from 'isomorphic-dompurify';
import { RateLimiter } from 'limiter';

// Email types for tracking and templates
export enum EmailType {
  WELCOME = 'WELCOME',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  LOGIN_ALERT = 'LOGIN_ALERT',
  INVOICE = 'INVOICE',
  RECEIPT = 'RECEIPT',
  TAX_SUMMARY = 'TAX_SUMMARY',
  SUBSCRIPTION_CONFIRMATION = 'SUBSCRIPTION_CONFIRMATION',
  SUBSCRIPTION_RENEWAL = 'SUBSCRIPTION_RENEWAL',
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  BUDGET_ALERT = 'BUDGET_ALERT',
  GOAL_ACHIEVED = 'GOAL_ACHIEVED',
  WEEKLY_SUMMARY = 'WEEKLY_SUMMARY',
  MONTHLY_REPORT = 'MONTHLY_REPORT',
  SECURITY_ALERT = 'SECURITY_ALERT',
  DATA_EXPORT_READY = 'DATA_EXPORT_READY',
}

// Email priority levels
export enum EmailPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Email configuration interface
export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
  sandboxMode?: boolean;
  enableTracking?: boolean;
  enableUnsubscribe?: boolean;
  unsubscribeUrl?: string;
  baseUrl: string;
}

// Email options interface
export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: EmailType;
  templateData?: Record<string, any>;
  attachments?: EmailAttachment[];
  priority?: EmailPriority;
  scheduledAt?: Date;
  tags?: string[];
  metadata?: Record<string, any>;
  trackOpens?: boolean;
  trackClicks?: boolean;
  unsubscribeGroupId?: number;
}

// Email attachment interface
export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  type?: string;
  disposition?: 'attachment' | 'inline';
  contentId?: string;
}

// Email template interface
export interface EmailTemplate {
  id: string;
  type: EmailType;
  subject: string;
  htmlTemplate: string;
  textTemplate?: string;
  metadata?: Record<string, any>;
  active: boolean;
  version: number;
}

// Validation schemas
const emailAddressSchema = z.string().email().toLowerCase().trim();

const emailOptionsSchema = z.object({
  to: z.union([emailAddressSchema, z.array(emailAddressSchema)]),
  cc: z.union([emailAddressSchema, z.array(emailAddressSchema)]).optional(),
  bcc: z.union([emailAddressSchema, z.array(emailAddressSchema)]).optional(),
  subject: z.string().min(1).max(200),
  html: z.string().optional(),
  text: z.string().optional(),
  template: z.nativeEnum(EmailType).optional(),
  templateData: z.record(z.any()).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.union([z.string(), z.instanceof(Buffer)]),
    type: z.string().optional(),
    disposition: z.enum(['attachment', 'inline']).optional(),
    contentId: z.string().optional(),
  })).optional(),
  priority: z.nativeEnum(EmailPriority).optional(),
  scheduledAt: z.date().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  trackOpens: z.boolean().optional(),
  trackClicks: z.boolean().optional(),
  unsubscribeGroupId: z.number().optional(),
}).refine((data) => {
  // Must have either html/text or template
  return !!(data.html || data.text || data.template);
}, {
  message: 'Email must have either html/text content or a template',
});

/**
 * Comprehensive email service with SendGrid integration
 */
export class EmailService {
  private static instance: EmailService;
  private config: EmailConfig;
  private rateLimiter: RateLimiter;
  private templates: Map<EmailType, Handlebars.TemplateDelegate> = new Map();
  private initialized: boolean = false;

  private constructor(config: EmailConfig) {
    this.config = config;
    
    // Initialize SendGrid
    sgMail.setApiKey(config.apiKey);
    
    // Initialize rate limiter (100 emails per minute)
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 100,
      interval: 'minute',
    });

    // Register Handlebars helpers
    this.registerHandlebarsHelpers();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: EmailConfig): EmailService {
    if (!EmailService.instance) {
      if (!config) {
        throw new Error('Email service configuration required for initialization');
      }
      EmailService.instance = new EmailService(config);
    }
    return EmailService.instance;
  }

  /**
   * Initialize email service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load email templates from database
      await this.loadTemplates();
      
      // Verify SendGrid configuration
      await this.verifyConfiguration();
      
      this.initialized = true;
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service', { error });
      throw error;
    }
  }

  /**
   * Send email
   */
  public async send(options: EmailOptions, userId?: string): Promise<string> {
    const startTime = Date.now();
    const emailId = crypto.randomUUID();

    try {
      // Validate options
      const validatedOptions = emailOptionsSchema.parse(options);
      
      // Check rate limit
      const hasTokens = await this.rateLimiter.tryRemoveTokens(1);
      if (!hasTokens) {
        throw new Error('Email rate limit exceeded');
      }

      // Build email content
      const emailContent = await this.buildEmailContent(validatedOptions);
      
      // Sanitize HTML content
      if (emailContent.html) {
        emailContent.html = DOMPurify.sanitize(emailContent.html);
      }

      // Build SendGrid message
      const msg: sgMail.MailDataRequired = {
        to: this.normalizeRecipients(validatedOptions.to),
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName,
        },
        subject: validatedOptions.subject,
        html: emailContent.html,
        text: emailContent.text,
        mailSettings: {
          sandboxMode: {
            enable: this.config.sandboxMode || false,
          },
        },
        trackingSettings: {
          clickTracking: {
            enable: validatedOptions.trackClicks ?? this.config.enableTracking ?? true,
          },
          openTracking: {
            enable: validatedOptions.trackOpens ?? this.config.enableTracking ?? true,
          },
          subscriptionTracking: {
            enable: this.config.enableUnsubscribe ?? true,
          },
        },
      };

      // Add optional fields
      if (validatedOptions.cc) {
        msg.cc = this.normalizeRecipients(validatedOptions.cc);
      }
      if (validatedOptions.bcc) {
        msg.bcc = this.normalizeRecipients(validatedOptions.bcc);
      }
      if (this.config.replyToEmail) {
        msg.replyTo = this.config.replyToEmail;
      }
      if (validatedOptions.attachments) {
        msg.attachments = this.buildAttachments(validatedOptions.attachments);
      }
      if (validatedOptions.scheduledAt && validatedOptions.scheduledAt > new Date()) {
        msg.sendAt = Math.floor(validatedOptions.scheduledAt.getTime() / 1000);
      }
      if (validatedOptions.tags) {
        msg.categories = validatedOptions.tags;
      }
      if (validatedOptions.unsubscribeGroupId) {
        msg.asm = {
          groupId: validatedOptions.unsubscribeGroupId,
        };
      }

      // Custom headers for tracking
      msg.headers = {
        'X-Email-ID': emailId,
        'X-Email-Type': validatedOptions.template || 'CUSTOM',
        'X-Priority': validatedOptions.priority || EmailPriority.NORMAL,
      };

      // Send email
      const [response] = await sgMail.send(msg);

      // Log email sent
      await this.logEmailSent(emailId, validatedOptions, userId, response.statusCode);

      logger.info('Email sent successfully', {
        emailId,
        to: validatedOptions.to,
        subject: validatedOptions.subject,
        type: validatedOptions.template,
        duration: Date.now() - startTime,
      });

      return emailId;

    } catch (error) {
      logger.error('Failed to send email', {
        error,
        emailId,
        options: this.sanitizeEmailOptions(options),
        duration: Date.now() - startTime,
      });

      // Log failure
      await this.logEmailFailed(emailId, options, userId, error);

      throw error;
    }
  }

  /**
   * Send bulk emails
   */
  public async sendBulk(
    recipients: Array<{ to: string; data?: Record<string, any> }>,
    template: EmailType,
    commonData?: Record<string, any>,
    userId?: string
  ): Promise<string[]> {
    const batchId = crypto.randomUUID();
    const emailIds: string[] = [];
    const errors: any[] = [];

    logger.info('Starting bulk email send', {
      batchId,
      recipientCount: recipients.length,
      template,
    });

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (recipient) => {
          try {
            const emailId = await this.send({
              to: recipient.to,
              template,
              templateData: {
                ...commonData,
                ...recipient.data,
              },
              metadata: {
                batchId,
                batchIndex: i / batchSize,
              },
            }, userId);
            
            emailIds.push(emailId);
          } catch (error) {
            errors.push({ recipient: recipient.to, error });
          }
        })
      );

      // Rate limiting between batches
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info('Bulk email send completed', {
      batchId,
      sent: emailIds.length,
      failed: errors.length,
    });

    if (errors.length > 0) {
      logger.error('Some bulk emails failed', { batchId, errors });
    }

    return emailIds;
  }

  /**
   * Send transactional email with template
   */
  public async sendTransactional(
    type: EmailType,
    to: string,
    data: Record<string, any>,
    userId?: string
  ): Promise<string> {
    // Get template
    const template = await this.getTemplate(type);
    if (!template) {
      throw new Error(`Email template not found: ${type}`);
    }

    // Merge with default data
    const templateData = {
      ...this.getDefaultTemplateData(),
      ...data,
    };

    return this.send({
      to,
      template: type,
      subject: template.subject,
      templateData,
      priority: this.getEmailPriority(type),
      tags: [type, 'transactional'],
    }, userId);
  }

  /**
   * Build email content from template or raw content
   */
  private async buildEmailContent(options: EmailOptions): Promise<{
    html?: string;
    text?: string;
  }> {
    if (options.template && options.templateData) {
      const template = await this.getTemplate(options.template);
      if (!template) {
        throw new Error(`Email template not found: ${options.template}`);
      }

      // Compile template if not cached
      if (!this.templates.has(options.template)) {
        const compiledHtml = Handlebars.compile(template.htmlTemplate);
        this.templates.set(options.template, compiledHtml);
      }

      const compiledTemplate = this.templates.get(options.template)!;
      const html = compiledTemplate(options.templateData);
      
      // Generate text version if not provided
      const text = template.textTemplate 
        ? Handlebars.compile(template.textTemplate)(options.templateData)
        : this.htmlToText(html);

      return { html, text };
    }

    return {
      html: options.html,
      text: options.text || (options.html ? this.htmlToText(options.html) : undefined),
    };
  }

  /**
   * Load email templates from database
   */
  private async loadTemplates(): Promise<void> {
    const cacheManager = await getCacheManager();
    const cacheKey = 'email:templates:all';

    // Try cache first
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      logger.debug('Using cached email templates');
      return;
    }

    try {
      const templates = await prisma.emailTemplate.findMany({
        where: { active: true },
        orderBy: { version: 'desc' },
      });

      // Group by type and get latest version
      const latestTemplates = templates.reduce((acc, template) => {
        if (!acc[template.type] || acc[template.type].version < template.version) {
          acc[template.type] = template;
        }
        return acc;
      }, {} as Record<string, any>);

      // Cache templates
      await cacheManager.set(cacheKey, latestTemplates, CacheTTL.HOUR);

      logger.info('Email templates loaded', {
        count: Object.keys(latestTemplates).length,
      });
    } catch (error) {
      logger.error('Failed to load email templates', { error });
      // Continue with default templates
    }
  }

  /**
   * Get email template
   */
  private async getTemplate(type: EmailType): Promise<EmailTemplate | null> {
    const cacheManager = await getCacheManager();
    const cacheKey = `email:template:${type}`;

    // Try cache first
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return cached as EmailTemplate;
    }

    // Get from database
    const template = await prisma.emailTemplate.findFirst({
      where: {
        type,
        active: true,
      },
      orderBy: {
        version: 'desc',
      },
    });

    if (template) {
      await cacheManager.set(cacheKey, template, CacheTTL.HOUR);
      return template as any;
    }

    // Fallback to default template
    return this.getDefaultTemplate(type);
  }

  /**
   * Get default template
   */
  private getDefaultTemplate(type: EmailType): EmailTemplate {
    const templates: Record<EmailType, EmailTemplate> = {
      [EmailType.WELCOME]: {
        id: 'default-welcome',
        type: EmailType.WELCOME,
        subject: 'Welcome to TAAXDOG! 🐕',
        htmlTemplate: `
          <h1>Welcome {{name}}!</h1>
          <p>Thank you for joining TAAXDOG. We're excited to help you manage your taxes and finances.</p>
          <p><a href="{{baseUrl}}/dashboard">Get Started</a></p>
        `,
        active: true,
        version: 1,
      },
      [EmailType.EMAIL_VERIFICATION]: {
        id: 'default-verify',
        type: EmailType.EMAIL_VERIFICATION,
        subject: 'Verify your email address',
        htmlTemplate: `
          <h1>Verify Your Email</h1>
          <p>Please click the link below to verify your email address:</p>
          <p><a href="{{verificationUrl}}">Verify Email</a></p>
          <p>This link will expire in 24 hours.</p>
        `,
        active: true,
        version: 1,
      },
      [EmailType.PASSWORD_RESET]: {
        id: 'default-reset',
        type: EmailType.PASSWORD_RESET,
        subject: 'Reset your password',
        htmlTemplate: `
          <h1>Reset Your Password</h1>
          <p>You requested to reset your password. Click the link below:</p>
          <p><a href="{{resetUrl}}">Reset Password</a></p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
        active: true,
        version: 1,
      },
      // Add more default templates as needed
    } as any;

    return templates[type] || {
      id: `default-${type}`,
      type,
      subject: 'TAAXDOG Notification',
      htmlTemplate: '<p>{{content}}</p>',
      active: true,
      version: 1,
    };
  }

  /**
   * Get default template data
   */
  private getDefaultTemplateData(): Record<string, any> {
    return {
      baseUrl: this.config.baseUrl,
      year: new Date().getFullYear(),
      companyName: 'TAAXDOG',
      supportEmail: 'support@taaxdog.com.au',
      unsubscribeUrl: this.config.unsubscribeUrl || `${this.config.baseUrl}/unsubscribe`,
    };
  }

  /**
   * Get email priority based on type
   */
  private getEmailPriority(type: EmailType): EmailPriority {
    const priorities: Partial<Record<EmailType, EmailPriority>> = {
      [EmailType.EMAIL_VERIFICATION]: EmailPriority.HIGH,
      [EmailType.PASSWORD_RESET]: EmailPriority.HIGH,
      [EmailType.SECURITY_ALERT]: EmailPriority.CRITICAL,
      [EmailType.LOGIN_ALERT]: EmailPriority.HIGH,
      [EmailType.PAYMENT_FAILED]: EmailPriority.HIGH,
      [EmailType.WEEKLY_SUMMARY]: EmailPriority.LOW,
      [EmailType.MONTHLY_REPORT]: EmailPriority.LOW,
    };

    return priorities[type] || EmailPriority.NORMAL;
  }

  /**
   * Log email sent
   */
  private async logEmailSent(
    emailId: string,
    options: EmailOptions,
    userId?: string,
    statusCode?: number
  ): Promise<void> {
    try {
      // Log to database
      await prisma.emailLog.create({
        data: {
          id: emailId,
          userId,
          type: options.template || 'CUSTOM',
          to: Array.isArray(options.to) ? options.to.join(',') : options.to,
          subject: options.subject,
          status: 'SENT',
          statusCode,
          metadata: {
            priority: options.priority,
            tags: options.tags,
            hasAttachments: !!options.attachments?.length,
            ...options.metadata,
          } as any,
        },
      });

      // Audit log
      if (userId) {
        await auditLogger.log({
          event: AuthEvent.EMAIL_SENT,
          category: AuditCategory.SYSTEM,
          severity: AuditSeverity.INFO,
          userId,
          ipAddress: 'system',
          userAgent: 'email-service',
          success: true,
          metadata: {
            emailId,
            type: options.template,
            to: options.to,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to log email sent', { error, emailId });
    }
  }

  /**
   * Log email failure
   */
  private async logEmailFailed(
    emailId: string,
    options: EmailOptions,
    userId?: string,
    error: any
  ): Promise<void> {
    try {
      // Log to database
      await prisma.emailLog.create({
        data: {
          id: emailId,
          userId,
          type: options.template || 'CUSTOM',
          to: Array.isArray(options.to) ? options.to.join(',') : options.to,
          subject: options.subject,
          status: 'FAILED',
          error: error.message || 'Unknown error',
          metadata: {
            priority: options.priority,
            tags: options.tags,
            errorDetails: error,
            ...options.metadata,
          } as any,
        },
      });

      // Audit log
      if (userId) {
        await auditLogger.log({
          event: AuthEvent.EMAIL_FAILED,
          category: AuditCategory.SYSTEM,
          severity: AuditSeverity.ERROR,
          userId,
          ipAddress: 'system',
          userAgent: 'email-service',
          success: false,
          errorMessage: error.message,
          metadata: {
            emailId,
            type: options.template,
            to: options.to,
          },
        });
      }
    } catch (logError) {
      logger.error('Failed to log email failure', { error: logError, emailId });
    }
  }

  /**
   * Normalize recipients
   */
  private normalizeRecipients(recipients: string | string[]): string | string[] {
    if (Array.isArray(recipients)) {
      return recipients.map(r => r.toLowerCase().trim());
    }
    return recipients.toLowerCase().trim();
  }

  /**
   * Build attachments for SendGrid
   */
  private buildAttachments(attachments: EmailAttachment[]): sgMail.AttachmentData[] {
    return attachments.map(attachment => ({
      filename: attachment.filename,
      content: typeof attachment.content === 'string' 
        ? attachment.content 
        : attachment.content.toString('base64'),
      type: attachment.type,
      disposition: attachment.disposition,
      contentId: attachment.contentId,
    }));
  }

  /**
   * Convert HTML to text
   */
  private htmlToText(html: string): string {
    // Simple conversion - in production, use a proper library
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Sanitize email options for logging
   */
  private sanitizeEmailOptions(options: EmailOptions): any {
    const sanitized = { ...options };
    
    // Remove sensitive content
    if (sanitized.html) sanitized.html = '[REDACTED]';
    if (sanitized.text) sanitized.text = '[REDACTED]';
    if (sanitized.attachments) {
      sanitized.attachments = sanitized.attachments.map(a => ({
        filename: a.filename,
        type: a.type,
        size: a.content.length,
      }));
    }
    
    return sanitized;
  }

  /**
   * Register Handlebars helpers
   */
  private registerHandlebarsHelpers(): void {
    // Date formatting
    Handlebars.registerHelper('formatDate', (date: Date | string, format: string) => {
      const d = new Date(date);
      return d.toLocaleDateString('en-AU', { dateStyle: 'long' });
    });

    // Currency formatting
    Handlebars.registerHelper('formatCurrency', (amount: number) => {
      return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
      }).format(amount);
    });

    // Conditional helpers
    Handlebars.registerHelper('ifEquals', function(arg1: any, arg2: any, options: any) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });

    // URL encoding
    Handlebars.registerHelper('urlEncode', (str: string) => {
      return encodeURIComponent(str);
    });
  }

  /**
   * Verify SendGrid configuration
   */
  private async verifyConfiguration(): Promise<void> {
    try {
      // Test configuration by getting account details
      // This is a lightweight API call to verify credentials
      await sgMail.send({
        to: this.config.fromEmail,
        from: this.config.fromEmail,
        subject: 'TAAXDOG Email Service Test',
        text: 'This is a test email to verify SendGrid configuration.',
        mailSettings: {
          sandboxMode: {
            enable: true, // Don't actually send
          },
        },
      });
    } catch (error: any) {
      if (error.code === 401) {
        throw new Error('Invalid SendGrid API key');
      }
      throw error;
    }
  }

  /**
   * Get email statistics
   */
  public async getStatistics(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    const where: any = {};
    
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, sent, failed, byType] = await Promise.all([
      prisma.emailLog.count({ where }),
      prisma.emailLog.count({ where: { ...where, status: 'SENT' } }),
      prisma.emailLog.count({ where: { ...where, status: 'FAILED' } }),
      prisma.emailLog.groupBy({
        by: ['type'],
        where,
        _count: true,
      }),
    ]);

    return {
      total,
      sent,
      failed,
      successRate: total > 0 ? (sent / total) * 100 : 0,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

// Export singleton instance with lazy initialization
export const emailService = EmailService.getInstance({
  apiKey: process.env.SENDGRID_API_KEY!,
  fromEmail: process.env.EMAIL_FROM || 'noreply@taaxdog.com.au',
  fromName: process.env.EMAIL_FROM_NAME || 'TAAXDOG',
  replyToEmail: process.env.EMAIL_REPLY_TO,
  sandboxMode: process.env.NODE_ENV === 'development',
  enableTracking: true,
  enableUnsubscribe: true,
  baseUrl: process.env.NEXTAUTH_URL || 'https://taaxdog.com.au',
});