import { getAIConfig } from '../config';

// AI Provider types
export enum AIProvider {
  ANTHROPIC = 'anthropic',
  OPENROUTER = 'openrouter',
  GEMINI = 'gemini',
}

// AI Provider Configuration Interface
export interface AIProviderConfig {
  name: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
  priority: number;
}

export interface AIProviderHierarchy {
  primary: AIProviderConfig;
  secondary: AIProviderConfig;
  tertiary: AIProviderConfig;
}

// Provider hierarchy configuration with exact API keys
export const AI_PROVIDERS: AIProviderHierarchy = {
  primary: {
    name: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY || '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',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-sonnet-20240229',
    maxRetries: 3,
    timeoutMs: 30000,
    priority: 1
  },
  secondary: {
    name: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY || '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',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-3.5-sonnet',
    maxRetries: 3,
    timeoutMs: 30000,
    priority: 2
  },
  tertiary: {
    name: 'gemini',
    apiKey: process.env.GEMINI_API_KEY || 'AIzaSyADSKfEEx1WISywXTw7V1CHqjM72bn7kEY',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-pro',
    maxRetries: 3,
    timeoutMs: 30000,
    priority: 3
  }
};

// AI Feature to Provider Mapping
export const AI_FEATURE_PROVIDERS = {
  TAX_CONSULTATION: 'anthropic',
  RECEIPT_PROCESSING: 'gemini',
  FINANCIAL_INSIGHTS: 'anthropic',
  BUDGET_PREDICTION: 'anthropic',
  CONVERSATION_MANAGEMENT: 'anthropic',
  REPORT_COMMENTARY: 'anthropic',
  KNOWLEDGE_BASE: 'anthropic'
} as const;

// Model configurations
export const AI_MODELS = {
  // Anthropic models
  CLAUDE_4_SONNET: 'claude-3-5-sonnet-20241022', // Claude 4 Sonnet (latest)
  CLAUDE_3_OPUS: 'claude-3-opus-20240229',
  CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
  
  // OpenRouter models (via OpenRouter)
  GPT_4_TURBO: 'openai/gpt-4-turbo-preview',
  GPT_3_5_TURBO: 'openai/gpt-3.5-turbo',
  MIXTRAL_8X7B: 'mistralai/mixtral-8x7b-instruct',
  
  // Gemini models
  GEMINI_PRO: 'gemini-pro',
  GEMINI_PRO_VISION: 'gemini-pro-vision',
} as const;

// Cost tracking (USD per 1K tokens)
export const MODEL_COSTS = {
  [AI_MODELS.CLAUDE_4_SONNET]: { input: 0.003, output: 0.015 }, // Claude 4 Sonnet pricing
  [AI_MODELS.CLAUDE_3_OPUS]: { input: 0.015, output: 0.075 },
  [AI_MODELS.CLAUDE_3_SONNET]: { input: 0.003, output: 0.015 },
  [AI_MODELS.CLAUDE_3_HAIKU]: { input: 0.00025, output: 0.00125 },
  [AI_MODELS.GPT_4_TURBO]: { input: 0.01, output: 0.03 },
  [AI_MODELS.GPT_3_5_TURBO]: { input: 0.0005, output: 0.0015 },
  [AI_MODELS.MIXTRAL_8X7B]: { input: 0.0006, output: 0.0006 },
  [AI_MODELS.GEMINI_PRO]: { input: 0.00025, output: 0.0005 },
  [AI_MODELS.GEMINI_PRO_VISION]: { input: 0.00025, output: 0.0005 },
} as const;

// AI operation types
export enum AIOperationType {
  TAX_ANALYSIS = 'tax_analysis',
  RECEIPT_SCANNING = 'receipt_scanning',
  DOCUMENT_EXTRACTION = 'document_extraction',
  FINANCIAL_ADVICE = 'financial_advice',
  BUDGET_PREDICTION = 'budget_prediction',
  EXPENSE_CATEGORIZATION = 'expense_categorization',
  TAX_OPTIMIZATION = 'tax_optimization',
  COMPLIANCE_CHECK = 'compliance_check',
}

// Model selection for operations (following AI provider hierarchy)
export const OPERATION_MODELS = {
  [AIOperationType.TAX_ANALYSIS]: AI_MODELS.CLAUDE_4_SONNET, // Primary: Anthropic
  [AIOperationType.RECEIPT_SCANNING]: AI_MODELS.GEMINI_PRO_VISION, // Tertiary: Gemini for OCR
  [AIOperationType.DOCUMENT_EXTRACTION]: AI_MODELS.GEMINI_PRO_VISION, // Tertiary: Gemini for OCR
  [AIOperationType.FINANCIAL_ADVICE]: AI_MODELS.CLAUDE_4_SONNET, // Primary: Anthropic
  [AIOperationType.BUDGET_PREDICTION]: AI_MODELS.CLAUDE_3_SONNET, // Secondary: via OpenRouter
  [AIOperationType.EXPENSE_CATEGORIZATION]: AI_MODELS.CLAUDE_3_HAIKU, // Fast categorization
  [AIOperationType.TAX_OPTIMIZATION]: AI_MODELS.CLAUDE_4_SONNET, // Primary: Anthropic
  [AIOperationType.COMPLIANCE_CHECK]: AI_MODELS.CLAUDE_4_SONNET, // Primary: Anthropic
} as const;

// Rate limiting configuration
export const AI_RATE_LIMITS = {
  [AIProvider.ANTHROPIC]: {
    requestsPerMinute: 50,
    tokensPerMinute: 40000,
    maxRetries: 3,
    retryDelay: 1000, // ms
  },
  [AIProvider.OPENROUTER]: {
    requestsPerMinute: 60,
    tokensPerMinute: 90000,
    maxRetries: 3,
    retryDelay: 1000,
  },
  [AIProvider.GEMINI]: {
    requestsPerMinute: 60,
    tokensPerMinute: 60000,
    maxRetries: 3,
    retryDelay: 1000,
  },
} as const;

// API endpoints
export const AI_ENDPOINTS = {
  [AIProvider.ANTHROPIC]: 'https://api.anthropic.com/v1/messages',
  [AIProvider.OPENROUTER]: 'https://openrouter.ai/api/v1/chat/completions',
  [AIProvider.GEMINI]: 'https://generativelanguage.googleapis.com/v1beta/models',
} as const;

// System prompts for Australian tax context
export const SYSTEM_PROMPTS = {
  TAX_ASSISTANT: `You are an expert Australian tax assistant specialized in helping individuals and small businesses with their tax obligations. You have deep knowledge of:
- Australian Tax Office (ATO) regulations and compliance
- GST calculations and reporting
- Tax deductions and allowable expenses
- Australian tax residency rules
- Small business tax concessions
- Superannuation and tax implications
Always provide advice based on current Australian tax law and recommend consulting a registered tax agent for complex matters.`,
  
  RECEIPT_ANALYZER: `You are an advanced receipt analysis system specialized in Australian receipts. Extract and return:
- Merchant name and ABN (if present)
- Total amount (including GST)
- GST amount (if itemized)
- Date of purchase
- Individual line items with prices
- Payment method
- Tax invoice number (if present)
Format all amounts in AUD and identify if the receipt is GST-compliant.`,
  
  FINANCIAL_ADVISOR: `You are a certified Australian financial advisor providing guidance on:
- Personal budgeting and savings strategies
- Investment options suitable for Australian residents
- Superannuation optimization
- Tax-effective investment structures
- Risk management and insurance
Always comply with ASIC regulations and recommend seeking professional financial advice for personal circumstances.`,
} as const;

// Australian Tax Compliance Configuration
export const AUSTRALIAN_TAX_CONFIG = {
  GST_RATE: 0.10,
  TAX_YEAR_START: '07-01',
  TAX_YEAR_END: '06-30',
  ATO_COMPLIANCE_REQUIRED: true,
  CURRENCY: 'AUD',
  BUSINESS_EXPENSE_CATEGORIES: [
    'Motor Vehicle Expenses',
    'Travel and Accommodation',
    'Meals and Entertainment',
    'Home Office Expenses',
    'Equipment and Software',
    'Professional Development',
    'Insurance',
    'Legal and Professional Fees',
    'Marketing and Advertising',
    'Office Supplies',
    'Utilities',
    'Interest and Bank Charges',
    'Repairs and Maintenance',
    'Depreciation'
  ],
  DEDUCTION_LIMITS: {
    HOME_OFFICE_SHORTCUT: 0.80,
    MEAL_ENTERTAINMENT: 0.50,
    TRAVEL_ALLOWANCE: 200
  }
};

// AI Cost Optimization Configuration
export const AI_COST_OPTIMIZATION = {
  CACHE_DURATION_MS: 300000, // 5 minutes
  RATE_LIMITS: {
    anthropic: { requests: 100, window: 60000 },
    openrouter: { requests: 200, window: 60000 },
    gemini: { requests: 60, window: 60000 }
  },
  CIRCUIT_BREAKER: {
    failureThreshold: 5,
    recoveryTimeMs: 30000,
    monitoringWindowMs: 60000
  }
};

// Get AI configuration for a specific provider
export function getProviderConfig(provider: AIProvider) {
  const config = getAIConfig();
  
  switch (provider) {
    case AIProvider.ANTHROPIC:
      return {
        apiKey: config.anthropic.apiKey,
        endpoint: AI_ENDPOINTS[provider],
        rateLimit: AI_RATE_LIMITS[provider],
      };
    case AIProvider.OPENROUTER:
      return {
        apiKey: config.openrouter.apiKey,
        endpoint: AI_ENDPOINTS[provider],
        rateLimit: AI_RATE_LIMITS[provider],
      };
    case AIProvider.GEMINI:
      return {
        apiKey: config.gemini.apiKey,
        endpoint: AI_ENDPOINTS[provider],
        rateLimit: AI_RATE_LIMITS[provider],
      };
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

// Get provider configuration from hierarchy
export function getProviderFromHierarchy(priority: 'primary' | 'secondary' | 'tertiary'): AIProviderConfig {
  return AI_PROVIDERS[priority];
}

// Calculate cost for token usage
export function calculateTokenCost(
  model: keyof typeof MODEL_COSTS,
  inputTokens: number,
  outputTokens: number,
): number {
  const costs = MODEL_COSTS[model];
  if (!costs) {
    console.warn(`No cost data for model: ${model}`);
    return 0;
  }
  
  const inputCost = (inputTokens / 1000) * costs.input;
  const outputCost = (outputTokens / 1000) * costs.output;
  
  return Number((inputCost + outputCost).toFixed(6));
}

// Get the best model for an operation
export function getModelForOperation(operation: AIOperationType): string {
  return OPERATION_MODELS[operation] || AI_MODELS.CLAUDE_3_HAIKU;
}

// Determine provider from model name
export function getProviderFromModel(model: string): AIProvider {
  if (model.includes('claude')) {
    return AIProvider.ANTHROPIC;
  } else if (model.includes('gpt') || model.includes('mixtral')) {
    return AIProvider.OPENROUTER;
  } else if (model.includes('gemini')) {
    return AIProvider.GEMINI;
  }
  
  throw new Error(`Cannot determine provider for model: ${model}`);
}