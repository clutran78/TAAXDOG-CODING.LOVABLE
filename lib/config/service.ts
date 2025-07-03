import { getConfig, Config } from './index';

// Service connection status
export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked: Date;
  error?: string;
  metadata?: Record<string, any>;
}

// Configuration service class
export class ConfigurationService {
  private static instance: ConfigurationService;
  private serviceStatuses: Map<string, ServiceStatus> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    // Private constructor for singleton
  }
  
  static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }
  
  // Get configuration with validation
  getValidatedConfig(): Config {
    return getConfig();
  }
  
  // Service health checks
  async checkDatabaseHealth(): Promise<ServiceStatus> {
    const status: ServiceStatus = {
      name: 'database',
      status: 'unknown',
      lastChecked: new Date(),
    };
    
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
      
      status.status = 'healthy';
      status.metadata = {
        url: getConfig().database.url.replace(/:[^:@]+@/, ':***@'), // Hide password
      };
    } catch (error) {
      status.status = 'unhealthy';
      status.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    this.serviceStatuses.set('database', status);
    return status;
  }
  
  async checkStripeHealth(): Promise<ServiceStatus> {
    const status: ServiceStatus = {
      name: 'stripe',
      status: 'unknown',
      lastChecked: new Date(),
    };
    
    try {
      const stripe = await import('stripe');
      const stripeClient = new stripe.default(getConfig().stripe.secretKey, {
        apiVersion: '2024-12-18.acacia',
      });
      
      // Test with a simple API call
      await stripeClient.paymentMethods.list({ limit: 1 });
      
      status.status = 'healthy';
      status.metadata = {
        mode: getConfig().stripe.publishableKey.includes('test') ? 'test' : 'live',
      };
    } catch (error) {
      status.status = 'unhealthy';
      status.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    this.serviceStatuses.set('stripe', status);
    return status;
  }
  
  async checkAIProvidersHealth(): Promise<Record<string, ServiceStatus>> {
    const providers = ['anthropic', 'openrouter', 'gemini'];
    const results: Record<string, ServiceStatus> = {};
    
    for (const provider of providers) {
      const status: ServiceStatus = {
        name: `ai-${provider}`,
        status: 'unknown',
        lastChecked: new Date(),
      };
      
      try {
        switch (provider) {
          case 'anthropic':
            // Simple validation for Anthropic
            if (getConfig().ai.anthropic.apiKey.startsWith('sk-ant-')) {
              status.status = 'healthy';
            } else {
              throw new Error('Invalid Anthropic API key format');
            }
            break;
            
          case 'openrouter':
            // Simple validation for OpenRouter
            if (getConfig().ai.openrouter.apiKey.startsWith('sk-or-')) {
              status.status = 'healthy';
            } else {
              throw new Error('Invalid OpenRouter API key format');
            }
            break;
            
          case 'gemini':
            // Simple validation for Gemini
            if (getConfig().ai.gemini.apiKey.startsWith('AIzaSy')) {
              status.status = 'healthy';
            } else {
              throw new Error('Invalid Gemini API key format');
            }
            break;
        }
      } catch (error) {
        status.status = 'unhealthy';
        status.error = error instanceof Error ? error.message : 'Unknown error';
      }
      
      this.serviceStatuses.set(`ai-${provider}`, status);
      results[provider] = status;
    }
    
    return results;
  }
  
  async checkBasiqHealth(): Promise<ServiceStatus> {
    const status: ServiceStatus = {
      name: 'basiq',
      status: 'unknown',
      lastChecked: new Date(),
    };
    
    try {
      const config = getConfig().basiq;
      
      // Simple validation for BASIQ
      if (config.apiKey && config.serverUrl) {
        status.status = 'healthy';
        status.metadata = {
          serverUrl: config.serverUrl,
        };
      } else {
        throw new Error('Missing BASIQ configuration');
      }
    } catch (error) {
      status.status = 'unhealthy';
      status.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    this.serviceStatuses.set('basiq', status);
    return status;
  }
  
  // Check all services
  async checkAllServices(): Promise<Map<string, ServiceStatus>> {
    await Promise.all([
      this.checkDatabaseHealth(),
      this.checkStripeHealth(),
      this.checkAIProvidersHealth(),
      this.checkBasiqHealth(),
    ]);
    
    return this.serviceStatuses;
  }
  
  // Get service status
  getServiceStatus(serviceName: string): ServiceStatus | undefined {
    return this.serviceStatuses.get(serviceName);
  }
  
  // Get all service statuses
  getAllServiceStatuses(): Map<string, ServiceStatus> {
    return new Map(this.serviceStatuses);
  }
  
  // Start periodic health checks
  startHealthChecks(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Run initial check
    this.checkAllServices();
    
    // Set up periodic checks
    this.healthCheckInterval = setInterval(() => {
      this.checkAllServices();
    }, intervalMs);
  }
  
  // Stop health checks
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
  
  // Configuration validation
  validateRequiredServices(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = getConfig();
    
    // Check database
    if (!config.database.url) {
      errors.push('Database URL is not configured');
    }
    
    // Check NextAuth
    if (!config.auth.secret) {
      errors.push('NextAuth secret is not configured');
    }
    
    // Check Stripe
    if (!config.stripe.secretKey || !config.stripe.publishableKey) {
      errors.push('Stripe keys are not configured');
    }
    
    // Check AI providers
    if (!config.ai.anthropic.apiKey && !config.ai.openrouter.apiKey && !config.ai.gemini.apiKey) {
      errors.push('No AI provider API keys configured');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  // Get configuration summary (safe for logging)
  getConfigurationSummary(): Record<string, any> {
    const config = getConfig();
    
    return {
      environment: config.env,
      database: {
        configured: !!config.database.url,
        sslRequired: config.database.sslRequired,
        poolSize: `${config.database.poolMin}-${config.database.poolMax}`,
      },
      auth: {
        configured: !!config.auth.secret,
        url: config.auth.url,
        providers: {
          google: !!config.auth.providers?.google?.clientId,
        },
      },
      stripe: {
        configured: !!config.stripe.secretKey,
        mode: config.stripe.publishableKey.includes('test') ? 'test' : 'live',
      },
      ai: {
        anthropic: !!config.ai.anthropic.apiKey,
        openrouter: !!config.ai.openrouter.apiKey,
        gemini: !!config.ai.gemini.apiKey,
      },
      basiq: {
        configured: !!config.basiq.apiKey,
        serverUrl: config.basiq.serverUrl,
      },
      features: config.features,
      security: {
        rateLimiting: config.security.enableRateLimiting,
        secureCookies: config.security.sessionCookieSecure,
      },
    };
  }
}

// Export singleton instance
export const configService = ConfigurationService.getInstance();