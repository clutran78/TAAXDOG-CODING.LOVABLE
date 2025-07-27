/**
 * AI service type definitions
 */

import { MoneyAmount } from './financial';
import { TransactionCategory, TaxCategory } from './transactions';
import { GoalCategory } from './goals';

// AI operation types
export enum AIOperation {
  TAX_ANALYSIS = 'TAX_ANALYSIS',
  EXPENSE_CATEGORIZATION = 'EXPENSE_CATEGORIZATION',
  RECEIPT_SCANNING = 'RECEIPT_SCANNING',
  FINANCIAL_INSIGHTS = 'FINANCIAL_INSIGHTS',
  BUDGET_RECOMMENDATIONS = 'BUDGET_RECOMMENDATIONS',
  GOAL_PLANNING = 'GOAL_PLANNING',
  CASH_FLOW_PREDICTION = 'CASH_FLOW_PREDICTION',
  SAVINGS_OPPORTUNITIES = 'SAVINGS_OPPORTUNITIES',
  CHAT_SUPPORT = 'CHAT_SUPPORT',
}

// AI provider
export enum AIProvider {
  ANTHROPIC = 'ANTHROPIC',
  OPENAI = 'OPENAI',
  GOOGLE = 'GOOGLE',
  OPENROUTER = 'OPENROUTER',
}

// AI model types
export enum AIModel {
  // Anthropic models
  CLAUDE_3_OPUS = 'claude-3-opus',
  CLAUDE_3_SONNET = 'claude-3-sonnet',
  CLAUDE_3_HAIKU = 'claude-3-haiku',

  // OpenAI models
  GPT_4_TURBO = 'gpt-4-turbo',
  GPT_4 = 'gpt-4',
  GPT_35_TURBO = 'gpt-3.5-turbo',

  // Google models
  GEMINI_PRO = 'gemini-pro',
  GEMINI_PRO_VISION = 'gemini-pro-vision',
}

// AI request/response
export interface AIRequest {
  id: string;
  userId: string;
  operation: AIOperation;

  // Model selection
  provider: AIProvider;
  model: AIModel;

  // Request data
  prompt?: string;
  context?: Record<string, unknown>;
  imageUrl?: string;

  // Response
  response?: AIResponse;

  // Usage tracking
  tokensUsed?: number;
  cost?: number;
  duration?: number; // milliseconds

  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;

  // Caching
  cacheKey?: string;
  cachedResponse?: boolean;

  createdAt: Date;
  completedAt?: Date;
}

// AI response based on operation type
export type AIResponse =
  | TaxAnalysisResponse
  | CategorizationResponse
  | ReceiptScanResponse
  | InsightsResponse
  | RecommendationsResponse
  | ChatResponse;

// Tax analysis response
export interface TaxAnalysisResponse {
  type: 'TAX_ANALYSIS';

  summary: {
    totalDeductions: MoneyAmount;
    estimatedRefund: MoneyAmount;
    taxableIncome: MoneyAmount;
    effectiveTaxRate: number;
  };

  deductions: Array<{
    category: TaxCategory;
    amount: MoneyAmount;
    count: number;
    items: Array<{
      description: string;
      amount: MoneyAmount;
      date: Date;
      confidence: number;
    }>;
  }>;

  opportunities: Array<{
    title: string;
    description: string;
    potentialSaving: MoneyAmount;
    effort: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;

  warnings: string[];
  recommendations: string[];
}

// Expense categorization response
export interface CategorizationResponse {
  type: 'EXPENSE_CATEGORIZATION';

  transactionId: string;
  suggestedCategory: TransactionCategory;
  confidence: number;

  taxCategory?: TaxCategory;
  isBusinessExpense: boolean;

  reasoning?: string;
  alternativeCategories?: Array<{
    category: TransactionCategory;
    confidence: number;
  }>;
}

// Receipt scan response
export interface ReceiptScanResponse {
  type: 'RECEIPT_SCAN';

  merchant: {
    name: string;
    abn?: string;
    address?: string;
    confidence: number;
  };

  transaction: {
    date: Date;
    totalAmount: MoneyAmount;
    gstAmount?: MoneyAmount;
    paymentMethod?: string;
    receiptNumber?: string;
  };

  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category?: TransactionCategory;
  }>;

  suggestedCategory: TransactionCategory;
  suggestedTaxCategory?: TaxCategory;
  isBusinessExpense: boolean;

  ocrConfidence: number;
  warnings?: string[];
}

// Financial insights response
export interface InsightsResponse {
  type: 'FINANCIAL_INSIGHTS';

  insights: Array<{
    id: string;
    type: 'SPENDING' | 'SAVING' | 'INCOME' | 'CASH_FLOW' | 'TAX';
    title: string;
    description: string;
    impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    priority: 'LOW' | 'MEDIUM' | 'HIGH';

    metrics?: {
      amount?: MoneyAmount;
      percentage?: number;
      trend?: 'UP' | 'DOWN' | 'STABLE';
    };

    actionItems?: string[];
    timeframe?: string;
  }>;

  summary: {
    financialHealth: number; // 0-100
    keyStrengths: string[];
    keyWeaknesses: string[];
    topPriorities: string[];
  };
}

// Budget/Goal recommendations response
export interface RecommendationsResponse {
  type: 'BUDGET_RECOMMENDATIONS' | 'GOAL_PLANNING';

  recommendations: Array<{
    id: string;
    category: TransactionCategory | GoalCategory;

    current: {
      amount: MoneyAmount;
      percentage?: number;
    };

    recommended: {
      amount: MoneyAmount;
      percentage?: number;
    };

    reasoning: string;
    impact: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;

  projections?: {
    savingsIncrease: MoneyAmount;
    timeToGoal?: number; // days
    successProbability?: number; // 0-100
  };

  warnings?: string[];
}

// Chat/conversational response
export interface ChatResponse {
  type: 'CHAT_SUPPORT';

  message: string;

  suggestedActions?: Array<{
    action: string;
    description: string;
    link?: string;
  }>;

  relatedArticles?: Array<{
    title: string;
    url: string;
    relevance: number;
  }>;

  requiresHumanSupport?: boolean;
}

// AI chat conversation
export interface AIConversation {
  id: string;
  userId: string;

  messages: AIMessage[];

  context?: {
    currentPage?: string;
    userIntent?: string;
    sessionData?: Record<string, unknown>;
  };

  status: 'active' | 'resolved' | 'escalated';

  createdAt: Date;
  lastMessageAt: Date;
  resolvedAt?: Date;
}

// AI chat message
export interface AIMessage {
  id: string;
  conversationId: string;

  role: 'user' | 'assistant' | 'system';
  content: string;

  metadata?: {
    intent?: string;
    confidence?: number;
    suggestedActions?: string[];
  };

  timestamp: Date;
}

// AI configuration
export interface AIConfiguration {
  userId: string;

  // Provider preferences
  preferredProvider?: AIProvider;
  fallbackProviders?: AIProvider[];

  // Feature toggles
  enabledOperations: AIOperation[];
  autoCategorizationEnabled: boolean;
  proactiveInsightsEnabled: boolean;

  // Privacy settings
  allowDataForTraining: boolean;
  retentionDays: number;

  // Limits
  monthlyRequestLimit?: number;
  dailyRequestLimit?: number;
}

// AI usage tracking
export interface AIUsageMetrics {
  userId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };

  requestCount: number;
  successCount: number;
  failureCount: number;

  byOperation: Record<
    AIOperation,
    {
      count: number;
      avgDuration: number;
      avgTokens: number;
      totalCost: number;
    }
  >;

  byProvider: Record<
    AIProvider,
    {
      count: number;
      totalTokens: number;
      totalCost: number;
    }
  >;

  insights: {
    mostUsedFeature: AIOperation;
    avgResponseTime: number;
    costSavingsFromCache: number;
    accuracyRate?: number;
  };
}
