export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  responseTimeMs: number;
}

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export enum AIProvider {
  ANTHROPIC = 'anthropic',
  OPENROUTER = 'openrouter',
  GEMINI = 'gemini',
}

export enum AIOperationType {
  TAX_CONSULTATION = 'tax_consultation',
  RECEIPT_PROCESSING = 'receipt_processing',
  FINANCIAL_INSIGHTS = 'financial_insights',
  REPORT_COMMENTARY = 'report_commentary',
  DOCUMENT_ANALYSIS = 'document_analysis',
  CHAT_RESPONSE = 'chat_response',
}

export enum AIInsightType {
  TAX_DEDUCTION = 'tax_deduction',
  TAX_OPTIMIZATION = 'tax_optimization',
  CASH_FLOW = 'cash_flow',
  EXPENSE_PATTERN = 'expense_pattern',
  BUSINESS_PERFORMANCE = 'business_performance',
  COMPLIANCE_RISK = 'compliance_risk',
  SAVINGS_OPPORTUNITY = 'savings_opportunity',
}

export interface TaxCategory {
  code: string;
  name: string;
  description: string;
  deductible: boolean;
}

export interface ProcessedReceipt {
  merchant: string;
  date: Date;
  totalAmount: number;
  gstAmount: number;
  items: {
    description: string;
    amount: number;
    quantity?: number;
  }[];
  category: TaxCategory;
  confidence: number;
  extractedText: string;
}

export interface FinancialInsight {
  type: AIInsightType;
  title: string;
  description: string;
  impact: string;
  recommendations: string[];
  confidence: number;
  dataPoints: Record<string, any>;
  expiresAt?: Date;
}

export interface AIError extends Error {
  provider: AIProvider;
  statusCode?: number;
  retryable: boolean;
}

// Australian Tax Categories (ATO compliant)
export const ATO_TAX_CATEGORIES: Record<string, TaxCategory> = {
  D1: {
    code: 'D1',
    name: 'Work-related car expenses',
    description: 'Car expenses for work purposes',
    deductible: true,
  },
  D2: {
    code: 'D2',
    name: 'Work-related travel expenses',
    description: 'Travel expenses for work (excluding to/from work)',
    deductible: true,
  },
  D3: {
    code: 'D3',
    name: 'Work-related clothing and laundry',
    description: 'Protective clothing, uniforms, occupation-specific clothing',
    deductible: true,
  },
  D4: {
    code: 'D4',
    name: 'Work-related self-education',
    description: 'Courses, conferences, seminars related to current work',
    deductible: true,
  },
  D5: {
    code: 'D5',
    name: 'Other work-related expenses',
    description: 'Tools, equipment, union fees, professional memberships',
    deductible: true,
  },
  D10: {
    code: 'D10',
    name: 'Cost of managing tax affairs',
    description: 'Tax agent fees, tax software',
    deductible: true,
  },
  B1: {
    code: 'B1',
    name: 'Business income',
    description: 'Income from business activities',
    deductible: false,
  },
  B2: {
    code: 'B2',
    name: 'Business expenses',
    description: 'General business operating expenses',
    deductible: true,
  },
  I1: {
    code: 'I1',
    name: 'Interest and dividends',
    description: 'Investment income',
    deductible: false,
  },
  I2: {
    code: 'I2',
    name: 'Investment expenses',
    description: 'Expenses related to earning investment income',
    deductible: true,
  },
  R1: {
    code: 'R1',
    name: 'Rental income',
    description: 'Income from rental properties',
    deductible: false,
  },
  R2: {
    code: 'R2',
    name: 'Rental expenses',
    description: 'Expenses for rental properties',
    deductible: true,
  },
  PERSONAL: {
    code: 'PERSONAL',
    name: 'Personal expenses',
    description: 'Non-deductible personal expenses',
    deductible: false,
  },
};