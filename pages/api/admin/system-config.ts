import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { authMiddleware, AuthenticatedRequest } from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { getClientIp } from 'request-ip';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

// Configuration categories
enum ConfigCategory {
  SECURITY = 'SECURITY',
  FEATURES = 'FEATURES',
  INTEGRATIONS = 'INTEGRATIONS',
  NOTIFICATIONS = 'NOTIFICATIONS',
  COMPLIANCE = 'COMPLIANCE',
  MAINTENANCE = 'MAINTENANCE',
}

// Validation schema for configuration updates
const ConfigUpdateSchema = z.object({
  category: z.nativeEnum(ConfigCategory),
  configs: z.array(
    z.object({
      key: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.any()), z.record(z.any())]),
      description: z.string().optional(),
    }),
  ),
});

/**
 * System Configuration API endpoint
 * Manages system-wide settings and feature flags
 * Requires ADMIN role only
 */
async function systemConfigHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const userId = req.userId;
  const clientIp = getClientIp(req) || 'unknown';

  try {
    // Log config access
    await prisma.auditLog
      .create({
        data: {
          event: 'ADMIN_SYSTEM_CONFIG_ACCESS',
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            method: req.method,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, userId);
      case 'PUT':
        return handlePut(req, res, userId);
      default:
        res.setHeader('Allow', ['GET', 'PUT']);
        return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
    }
  } catch (error) {
    logger.error('System config API error:', error);
    return apiResponse.internalError(res, {
      error: 'Internal server error',
      message: 'An error occurred while processing your request',
    });
  }
}

async function handleGet(req: AuthenticatedRequest, res: NextApiResponse, adminId: string) {
  try {
    // Get all system configurations
    const configurations = await getSystemConfigurations();

    // Log successful retrieval
    await prisma.auditLog
      .create({
        data: {
          event: 'ADMIN_CONFIG_RETRIEVED',
          userId: adminId,
          ipAddress: getClientIp(req) || 'unknown',
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    return apiResponse.success(res, {
      success: true,
      data: configurations,
    });
  } catch (error) {
    logger.error('Get system config error:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to fetch configurations',
      message: 'Unable to retrieve system configurations. Please try again.',
    });
  }
}

async function handlePut(req: AuthenticatedRequest, res: NextApiResponse, adminId: string) {
  try {
    // Validate input
    const validationResult = ConfigUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return apiResponse.error(res, {
        error: 'Validation error',
        message: 'Invalid configuration data',
        errors: validationResult.error.flatten(),
      });
    }

    const { category, configs } = validationResult.data;

    // Store previous values for audit trail
    const previousConfigs: Record<string, any> = {};
    for (const config of configs) {
      const existing = await prisma.systemConfig.findUnique({
        where: { key: config.key },
      });
      if (existing) {
        previousConfigs[config.key] = existing.value;
      }
    }

    // Update configurations in a transaction
    const updatedConfigs = await prisma.$transaction(
      configs.map((config) =>
        prisma.systemConfig.upsert({
          where: { key: config.key },
          update: {
            value: config.value,
            category,
            description: config.description,
            updatedAt: new Date(),
            updatedBy: adminId,
          },
          create: {
            key: config.key,
            value: config.value,
            category,
            description: config.description,
            createdBy: adminId,
            updatedBy: adminId,
          },
        }),
      ),
    );

    // Handle special configuration changes
    await handleConfigurationSideEffects(category, configs, adminId);

    // Log configuration changes
    await prisma.auditLog.create({
      data: {
        event: 'ADMIN_CONFIG_UPDATED',
        userId: adminId,
        ipAddress: getClientIp(req) || 'unknown',
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: {
          category,
          changes: configs.map((c) => ({
            key: c.key,
            previousValue: previousConfigs[c.key],
            newValue: c.value,
          })),
          timestamp: new Date().toISOString(),
        },
      },
    });

    return apiResponse.success(res, {
      success: true,
      data: {
        message: 'Configurations updated successfully',
        updated: updatedConfigs.length,
        category,
      },
    });
  } catch (error) {
    logger.error('Update system config error:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to update configurations',
      message: 'Unable to update system configurations. Please try again.',
    });
  }
}

// Get all system configurations organized by category
async function getSystemConfigurations() {
  // Security configurations
  const security = {
    category: ConfigCategory.SECURITY,
    configs: [
      {
        key: 'auth.sessionTimeout',
        value: 24 * 60 * 60 * 1000, // 24 hours in ms
        description: 'Session timeout duration in milliseconds',
        type: 'number',
        unit: 'milliseconds',
      },
      {
        key: 'auth.maxLoginAttempts',
        value: 5,
        description: 'Maximum failed login attempts before account lock',
        type: 'number',
      },
      {
        key: 'auth.accountLockDuration',
        value: 30 * 60 * 1000, // 30 minutes
        description: 'Account lock duration after max failed attempts',
        type: 'number',
        unit: 'milliseconds',
      },
      {
        key: 'auth.require2FAForAdmin',
        value: true,
        description: 'Require 2FA for admin and privileged accounts',
        type: 'boolean',
      },
      {
        key: 'auth.passwordMinLength',
        value: 8,
        description: 'Minimum password length',
        type: 'number',
      },
      {
        key: 'auth.passwordRequireSpecialChar',
        value: true,
        description: 'Require special characters in passwords',
        type: 'boolean',
      },
    ],
  };

  // Feature flags
  const features = {
    category: ConfigCategory.FEATURES,
    configs: [
      {
        key: 'features.aiInsights',
        value: true,
        description: 'Enable AI-powered financial insights',
        type: 'boolean',
      },
      {
        key: 'features.receiptScanning',
        value: true,
        description: 'Enable receipt scanning and OCR',
        type: 'boolean',
      },
      {
        key: 'features.bankingIntegration',
        value: true,
        description: 'Enable BASIQ banking integration',
        type: 'boolean',
      },
      {
        key: 'features.taxOptimization',
        value: true,
        description: 'Enable tax optimization suggestions',
        type: 'boolean',
      },
      {
        key: 'features.budgetPrediction',
        value: true,
        description: 'Enable AI budget predictions',
        type: 'boolean',
      },
      {
        key: 'features.multiCurrency',
        value: false,
        description: 'Enable multi-currency support',
        type: 'boolean',
      },
    ],
  };

  // Integration settings
  const integrations = {
    category: ConfigCategory.INTEGRATIONS,
    configs: [
      {
        key: 'integrations.basiq.enabled',
        value: true,
        description: 'Enable BASIQ API integration',
        type: 'boolean',
      },
      {
        key: 'integrations.basiq.syncInterval',
        value: 6 * 60 * 60 * 1000, // 6 hours
        description: 'BASIQ sync interval in milliseconds',
        type: 'number',
        unit: 'milliseconds',
      },
      {
        key: 'integrations.stripe.enabled',
        value: true,
        description: 'Enable Stripe payment integration',
        type: 'boolean',
      },
      {
        key: 'integrations.openai.enabled',
        value: true,
        description: 'Enable OpenAI integration',
        type: 'boolean',
      },
      {
        key: 'integrations.anthropic.enabled',
        value: true,
        description: 'Enable Anthropic Claude integration',
        type: 'boolean',
      },
    ],
  };

  // Notification settings
  const notifications = {
    category: ConfigCategory.NOTIFICATIONS,
    configs: [
      {
        key: 'notifications.email.enabled',
        value: true,
        description: 'Enable email notifications',
        type: 'boolean',
      },
      {
        key: 'notifications.email.provider',
        value: 'sendgrid',
        description: 'Email service provider',
        type: 'string',
        options: ['sendgrid', 'ses', 'smtp'],
      },
      {
        key: 'notifications.goalReminders',
        value: true,
        description: 'Send goal deadline reminders',
        type: 'boolean',
      },
      {
        key: 'notifications.taxDeadlines',
        value: true,
        description: 'Send tax deadline reminders',
        type: 'boolean',
      },
      {
        key: 'notifications.securityAlerts',
        value: true,
        description: 'Send security alerts to users',
        type: 'boolean',
      },
    ],
  };

  // Compliance settings
  const compliance = {
    category: ConfigCategory.COMPLIANCE,
    configs: [
      {
        key: 'compliance.dataRetentionDays',
        value: 2555, // 7 years for Australian tax records
        description: 'Data retention period in days',
        type: 'number',
        unit: 'days',
      },
      {
        key: 'compliance.auditLogRetentionDays',
        value: 365,
        description: 'Audit log retention period in days',
        type: 'number',
        unit: 'days',
      },
      {
        key: 'compliance.gdprEnabled',
        value: false,
        description: 'Enable GDPR compliance features',
        type: 'boolean',
      },
      {
        key: 'compliance.privacyActCompliance',
        value: true,
        description: 'Enable Australian Privacy Act compliance',
        type: 'boolean',
      },
      {
        key: 'compliance.exportDataFormat',
        value: 'json',
        description: 'Default format for data exports',
        type: 'string',
        options: ['json', 'csv', 'pdf'],
      },
    ],
  };

  // Maintenance settings
  const maintenance = {
    category: ConfigCategory.MAINTENANCE,
    configs: [
      {
        key: 'maintenance.mode',
        value: false,
        description: 'Enable maintenance mode',
        type: 'boolean',
      },
      {
        key: 'maintenance.message',
        value: 'System is undergoing maintenance. Please check back later.',
        description: 'Maintenance mode message',
        type: 'string',
      },
      {
        key: 'maintenance.allowAdminAccess',
        value: true,
        description: 'Allow admin access during maintenance',
        type: 'boolean',
      },
      {
        key: 'maintenance.scheduledStart',
        value: null,
        description: 'Scheduled maintenance start time',
        type: 'datetime',
      },
      {
        key: 'maintenance.scheduledEnd',
        value: null,
        description: 'Scheduled maintenance end time',
        type: 'datetime',
      },
    ],
  };

  // Fetch stored values from database
  const storedConfigs = await prisma.systemConfig.findMany();
  const configMap = storedConfigs.reduce(
    (acc, config) => {
      acc[config.key] = config.value;
      return acc;
    },
    {} as Record<string, any>,
  );

  // Merge stored values with defaults
  const categories = [security, features, integrations, notifications, compliance, maintenance];
  categories.forEach((category) => {
    category.configs.forEach((config) => {
      if (configMap.hasOwnProperty(config.key)) {
        config.value = configMap[config.key];
      }
    });
  });

  return categories;
}

// Handle side effects of configuration changes
async function handleConfigurationSideEffects(
  category: ConfigCategory,
  configs: Array<{ key: string; value: any }>,
  adminId: string,
) {
  for (const config of configs) {
    switch (config.key) {
      case 'maintenance.mode':
        if (config.value === true) {
          // Log maintenance mode activation
          await prisma.auditLog.create({
            data: {
              event: 'MAINTENANCE_MODE_ACTIVATED',
              userId: adminId,
              ipAddress: 'system',
              userAgent: 'system',
              success: true,
              metadata: {
                activatedBy: adminId,
                timestamp: new Date().toISOString(),
              },
            },
          });
          // Could trigger notifications to users here
        }
        break;

      case 'auth.require2FAForAdmin':
        if (config.value === true) {
          // Flag admin users without 2FA
          await prisma.user.updateMany({
            where: {
              role: { in: ['ADMIN', 'ACCOUNTANT'] },
              twoFactorEnabled: false,
            },
            data: {
              twoFactorRequired: true,
            },
          });
        }
        break;

      case 'integrations.basiq.enabled':
        if (config.value === false) {
          // Log BASIQ disablement
          await prisma.auditLog.create({
            data: {
              event: 'INTEGRATION_DISABLED',
              userId: adminId,
              ipAddress: 'system',
              userAgent: 'system',
              success: true,
              metadata: {
                integration: 'BASIQ',
                disabledBy: adminId,
                timestamp: new Date().toISOString(),
              },
            },
          });
        }
        break;
    }
  }
}

// Export with authentication middleware requiring ADMIN role only
export default withSessionRateLimit(
  authMiddleware.authenticated(systemConfigHandler, {
    allowedRoles: ['ADMIN'],
  }),
  {
    window: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute (config changes should be infrequent)
  },
);
