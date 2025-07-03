import { AIProvider, AIOperationType, AI_MODELS, MODEL_COSTS, getProviderFromModel } from './config';
import { prisma } from '../prisma';

interface CostOptimizationStrategy {
  provider: AIProvider;
  model: string;
  estimatedCost: number;
  rationale: string;
  priority: number;
}

export class AIRoutingOptimizer {
  private static CACHE_HIT_COST_SAVING = 1.0; // 100% saving on cache hit
  private static COMPLEXITY_THRESHOLDS = {
    simple: 100,    // < 100 tokens
    medium: 500,    // 100-500 tokens
    complex: 2000,  // 500-2000 tokens
    veryComplex: Infinity, // > 2000 tokens
  };

  /**
   * Intelligent routing based on query complexity and cost optimization
   */
  static async getOptimalProvider(
    operationType: AIOperationType,
    estimatedTokens: number,
    requiresVision: boolean = false
  ): Promise<CostOptimizationStrategy> {
    // Check cache potential first
    const cacheHitRate = await this.getCacheHitRate(operationType);
    if (cacheHitRate > 0.7) {
      // High cache hit rate, use cheaper models
      return {
        provider: AIProvider.ANTHROPIC,
        model: AI_MODELS.CLAUDE_3_HAIKU,
        estimatedCost: this.calculateCost(AI_MODELS.CLAUDE_3_HAIKU, estimatedTokens) * (1 - cacheHitRate),
        rationale: 'High cache hit rate allows for cheaper model usage',
        priority: 1,
      };
    }

    // Vision tasks require specific models
    if (requiresVision) {
      return {
        provider: AIProvider.GEMINI,
        model: AI_MODELS.GEMINI_PRO_VISION,
        estimatedCost: this.calculateCost(AI_MODELS.GEMINI_PRO_VISION, estimatedTokens),
        rationale: 'Vision capabilities required',
        priority: 1,
      };
    }

    // Route based on operation type and complexity
    const complexity = this.getComplexityLevel(estimatedTokens);
    
    switch (operationType) {
      case AIOperationType.TAX_ANALYSIS:
      case AIOperationType.TAX_OPTIMIZATION:
      case AIOperationType.COMPLIANCE_CHECK:
        // High accuracy required - use best model
        return {
          provider: AIProvider.ANTHROPIC,
          model: AI_MODELS.CLAUDE_4_SONNET,
          estimatedCost: this.calculateCost(AI_MODELS.CLAUDE_4_SONNET, estimatedTokens),
          rationale: 'Tax compliance requires highest accuracy',
          priority: 1,
        };

      case AIOperationType.EXPENSE_CATEGORIZATION:
        // Simple task - use fast, cheap model
        return {
          provider: AIProvider.ANTHROPIC,
          model: AI_MODELS.CLAUDE_3_HAIKU,
          estimatedCost: this.calculateCost(AI_MODELS.CLAUDE_3_HAIKU, estimatedTokens),
          rationale: 'Simple categorization task',
          priority: 1,
        };

      case AIOperationType.FINANCIAL_ADVICE:
      case AIOperationType.BUDGET_PREDICTION:
        // Medium complexity - balance cost and quality
        if (complexity === 'simple' || complexity === 'medium') {
          return {
            provider: AIProvider.OPENROUTER,
            model: AI_MODELS.GPT_3_5_TURBO,
            estimatedCost: this.calculateCost(AI_MODELS.GPT_3_5_TURBO, estimatedTokens),
            rationale: 'Medium complexity task, optimizing for cost',
            priority: 2,
          };
        } else {
          return {
            provider: AIProvider.OPENROUTER,
            model: AI_MODELS.CLAUDE_3_SONNET,
            estimatedCost: this.calculateCost(AI_MODELS.CLAUDE_3_SONNET, estimatedTokens),
            rationale: 'Complex financial analysis via secondary provider',
            priority: 2,
          };
        }

      default:
        // Default to cost-effective option
        return {
          provider: AIProvider.OPENROUTER,
          model: AI_MODELS.GPT_3_5_TURBO,
          estimatedCost: this.calculateCost(AI_MODELS.GPT_3_5_TURBO, estimatedTokens),
          rationale: 'Default cost-optimized routing',
          priority: 3,
        };
    }
  }

  /**
   * Calculate cache hit rate for optimization decisions
   */
  private static async getCacheHitRate(operationType: AIOperationType): Promise<number> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const stats = await prisma.aICache.aggregate({
      where: {
        operationType,
        createdAt: { gte: oneWeekAgo },
      },
      _sum: { hitCount: true },
      _count: true,
    });

    if (!stats._count || stats._count === 0) return 0;
    
    const totalRequests = stats._count + (stats._sum.hitCount || 0);
    return (stats._sum.hitCount || 0) / totalRequests;
  }

  /**
   * Determine complexity level based on token count
   */
  private static getComplexityLevel(tokens: number): string {
    if (tokens < this.COMPLEXITY_THRESHOLDS.simple) return 'simple';
    if (tokens < this.COMPLEXITY_THRESHOLDS.medium) return 'medium';
    if (tokens < this.COMPLEXITY_THRESHOLDS.complex) return 'complex';
    return 'veryComplex';
  }

  /**
   * Calculate estimated cost for a model and token count
   */
  private static calculateCost(model: string, estimatedTokens: number): number {
    const costs = MODEL_COSTS[model as keyof typeof MODEL_COSTS];
    if (!costs) return 0;

    // Assume 70% input, 30% output for estimation
    const inputTokens = estimatedTokens * 0.7;
    const outputTokens = estimatedTokens * 0.3;

    return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
  }

  /**
   * Monitor and optimize costs across all users
   */
  static async generateCostReport(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<{
    totalCost: number;
    byProvider: Record<string, number>;
    byOperation: Record<string, number>;
    topUsers: Array<{ userId: string; cost: number }>;
    recommendations: string[];
  }> {
    const where = {
      createdAt: { gte: startDate, lte: endDate },
      ...(userId && { userId }),
    };

    const usage = await prisma.aIUsageTracking.findMany({ where });

    // Aggregate costs
    const totalCost = usage.reduce((sum, u) => sum + (u.costUsd || 0), 0);
    
    const byProvider = usage.reduce((acc, u) => {
      acc[u.provider] = (acc[u.provider] || 0) + (u.costUsd || 0);
      return acc;
    }, {} as Record<string, number>);

    const byOperation = usage.reduce((acc, u) => {
      acc[u.operationType] = (acc[u.operationType] || 0) + (u.costUsd || 0);
      return acc;
    }, {} as Record<string, number>);

    // Get top users by cost
    const userCosts = usage.reduce((acc, u) => {
      if (u.userId) {
        acc[u.userId] = (acc[u.userId] || 0) + (u.costUsd || 0);
      }
      return acc;
    }, {} as Record<string, number>);

    const topUsers = Object.entries(userCosts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([userId, cost]) => ({ userId, cost }));

    // Generate recommendations
    const recommendations = this.generateCostRecommendations(
      totalCost,
      byProvider,
      byOperation,
      usage
    );

    return {
      totalCost,
      byProvider,
      byOperation,
      topUsers,
      recommendations,
    };
  }

  /**
   * Generate cost optimization recommendations
   */
  private static generateCostRecommendations(
    totalCost: number,
    byProvider: Record<string, number>,
    byOperation: Record<string, number>,
    usage: any[]
  ): string[] {
    const recommendations: string[] = [];

    // Check for expensive operations
    const expensiveOps = Object.entries(byOperation)
      .filter(([, cost]) => cost > totalCost * 0.3)
      .map(([op]) => op);

    if (expensiveOps.length > 0) {
      recommendations.push(
        `Consider implementing more aggressive caching for ${expensiveOps.join(', ')} operations`
      );
    }

    // Check provider distribution
    const anthropicPercentage = (byProvider['anthropic'] || 0) / totalCost;
    if (anthropicPercentage > 0.8) {
      recommendations.push(
        'Heavy reliance on Anthropic - consider using OpenRouter for non-critical tasks'
      );
    }

    // Check failure rate
    const failureRate = usage.filter(u => !u.success).length / usage.length;
    if (failureRate > 0.1) {
      recommendations.push(
        `High failure rate (${(failureRate * 100).toFixed(1)}%) - implement better error handling`
      );
    }

    // Check for repeated queries
    const avgCacheHit = usage.reduce((sum, u) => sum + (u.cacheHit ? 1 : 0), 0) / usage.length;
    if (avgCacheHit < 0.2) {
      recommendations.push(
        'Low cache utilization - implement query normalization for better caching'
      );
    }

    return recommendations;
  }

  /**
   * Implement usage quota management
   */
  static async checkUserQuota(
    userId: string,
    estimatedCost: number
  ): Promise<{
    allowed: boolean;
    currentUsage: number;
    limit: number;
    resetDate: Date;
  }> {
    // Get current month usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usage = await prisma.aIUsageTracking.aggregate({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
      },
      _sum: { costUsd: true },
    });

    const currentUsage = usage._sum.costUsd || 0;
    
    // Get user's subscription tier (simplified)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    // Set limits based on subscription
    const limits: Record<string, number> = {
      free: 5.0,      // $5 USD per month
      smart: 50.0,    // $50 USD per month
      pro: 200.0,     // $200 USD per month
    };

    const plan = user?.subscription?.plan || 'free';
    const limit = limits[plan] || limits.free;

    const resetDate = new Date(startOfMonth);
    resetDate.setMonth(resetDate.getMonth() + 1);

    return {
      allowed: currentUsage + estimatedCost <= limit,
      currentUsage,
      limit,
      resetDate,
    };
  }
}

/**
 * Rate limiting implementation
 */
export class AIRateLimiter {
  private static WINDOW_SIZE_MS = 60000; // 1 minute
  private static requests = new Map<string, number[]>();

  static async checkRateLimit(
    provider: AIProvider,
    userId: string
  ): Promise<{
    allowed: boolean;
    retryAfter?: number;
  }> {
    const key = `${provider}:${userId}`;
    const now = Date.now();
    const windowStart = now - this.WINDOW_SIZE_MS;

    // Get existing requests
    let userRequests = this.requests.get(key) || [];
    
    // Filter out old requests
    userRequests = userRequests.filter(timestamp => timestamp > windowStart);
    
    // Get rate limit for provider
    const limits = {
      [AIProvider.ANTHROPIC]: 50,
      [AIProvider.OPENROUTER]: 60,
      [AIProvider.GEMINI]: 60,
    };

    const limit = limits[provider] || 50;

    if (userRequests.length >= limit) {
      const oldestRequest = Math.min(...userRequests);
      const retryAfter = Math.ceil((oldestRequest + this.WINDOW_SIZE_MS - now) / 1000);
      
      return {
        allowed: false,
        retryAfter,
      };
    }

    // Add current request
    userRequests.push(now);
    this.requests.set(key, userRequests);

    return { allowed: true };
  }

  /**
   * Clean up old rate limit data
   */
  static cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.WINDOW_SIZE_MS;

    this.requests.forEach((timestamps, key) => {
      const filtered = timestamps.filter(t => t > windowStart);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    });
  }
}

// Run cleanup every minute
setInterval(() => AIRateLimiter.cleanup(), 60000);