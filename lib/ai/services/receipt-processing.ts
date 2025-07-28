import { GeminiProvider } from '../providers/gemini';
import { getAIConfig } from '../../config';
import { AIOperationType, AI_PROVIDERS, AUSTRALIAN_TAX_CONFIG } from '../config';
import { AIService } from '../ai-service';
import prisma from '../../prisma';
import { logger } from '@/lib/logger';

export interface ReceiptData {
  merchantName: string;
  abn?: string;
  totalAmount: number;
  gstAmount?: number;
  date: Date;
  lineItems: ReceiptLineItem[];
  paymentMethod?: string;
  taxInvoiceNumber?: string;
  confidence: number;
  isGstCompliant: boolean;
}

export interface ReceiptLineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice: number;
  gstIncluded?: boolean;
  category?: string;
}

export interface ProcessReceiptOptions {
  imageData: string; // Base64 encoded image
  mimeType?: string;
  userId?: string;
  businessId?: string;
  additionalContext?: string;
}

export class ReceiptProcessingService {
  private gemini: GeminiProvider;
  private aiService: AIService;

  constructor() {
    const geminiConfig = AI_PROVIDERS.tertiary;
    this.gemini = new GeminiProvider(geminiConfig.apiKey, 'gemini-pro-vision');
    this.aiService = new AIService();
  }

  async processReceipt(options: ProcessReceiptOptions): Promise<ReceiptData> {
    const { imageData, mimeType = 'image/jpeg', userId, businessId, additionalContext } = options;

    // Generate cache key
    const cacheKey = `receipt:${Buffer.from(imageData).toString('base64').substring(0, 32)}`;

    // Check cache first
    const cached = await this.checkCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Create prompt for Gemini
    const prompt = this.createReceiptPrompt(additionalContext);

    try {
      // Process image with Gemini
      const response = await this.gemini.processImage(imageData, prompt);

      // Parse the response
      const receiptData = this.parseReceiptResponse(response.content);

      // Validate and enhance with Australian tax categories
      const enhancedData = await this.enhanceWithTaxCategories(receiptData);

      // Track usage
      if (userId || businessId) {
        await this.trackUsage({
          userId,
          businessId,
          operationType: AIOperationType.RECEIPT_SCANNING,
          provider: response.provider,
          model: response.model,
          tokensUsed: response.tokensUsed.total,
          cost: response.cost,
          responseTimeMs: response.responseTimeMs,
          success: true,
        });
      }

      // Cache the response
      await this.saveToCache(cacheKey, enhancedData, response.cost);

      return enhancedData;
    } catch (error) {
      // Track failure
      if (userId || businessId) {
        await this.trackUsage({
          userId,
          businessId,
          operationType: AIOperationType.RECEIPT_SCANNING,
          provider: 'gemini',
          model: 'gemini-pro-vision',
          tokensUsed: 0,
          cost: 0,
          responseTimeMs: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      throw error;
    }
  }

  private createReceiptPrompt(additionalContext?: string): string {
    return `You are an advanced receipt analysis system specialized in Australian receipts. Extract and return the following information in JSON format:

{
  "merchantName": "string",
  "abn": "string or null (Australian Business Number if present)",
  "totalAmount": number,
  "gstAmount": number or null,
  "date": "ISO date string",
  "lineItems": [
    {
      "description": "string",
      "quantity": number or null,
      "unitPrice": number or null,
      "totalPrice": number,
      "gstIncluded": boolean
    }
  ],
  "paymentMethod": "string or null",
  "taxInvoiceNumber": "string or null",
  "confidence": number (0-1),
  "isGstCompliant": boolean
}

Important considerations:
1. Australian GST is 10% and may be included in prices or shown separately
2. Look for ABN (11-digit number) on the receipt
3. Tax invoices must show "Tax Invoice", ABN, and GST amount for amounts over $82.50
4. Format all amounts in AUD with 2 decimal places
5. If GST is not itemized but receipt shows "GST included", calculate GST as totalAmount / 11
6. Set isGstCompliant to true if receipt meets ATO tax invoice requirements
7. Confidence score should reflect the clarity and completeness of the receipt

${additionalContext ? `Additional context: ${additionalContext}` : ''}

Analyze the receipt image and provide the extracted data.`;
  }

  private parseReceiptResponse(response: string): ReceiptData {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const data = JSON.parse(jsonMatch[0]);

      // Validate and transform data
      return {
        merchantName: data.merchantName || 'Unknown Merchant',
        abn: this.validateABN(data.abn),
        totalAmount: parseFloat(data.totalAmount) || 0,
        gstAmount: data.gstAmount ? parseFloat(data.gstAmount) : undefined,
        date: new Date(data.date),
        lineItems: this.parseLineItems(data.lineItems || []),
        paymentMethod: data.paymentMethod,
        taxInvoiceNumber: data.taxInvoiceNumber,
        confidence: parseFloat(data.confidence) || 0.5,
        isGstCompliant: Boolean(data.isGstCompliant),
      };
    } catch (error) {
      throw new Error(
        `Failed to parse receipt response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private parseLineItems(items: any[]): ReceiptLineItem[] {
    return items.map((item) => ({
      description: item.description || 'Unknown Item',
      quantity: item.quantity ? parseInt(item.quantity) : undefined,
      unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : undefined,
      totalPrice: parseFloat(item.totalPrice) || 0,
      gstIncluded: Boolean(item.gstIncluded),
    }));
  }

  private validateABN(abn: string | null): string | undefined {
    if (!abn) return undefined;

    // Remove spaces and validate format
    const cleanABN = abn.replace(/\s/g, '');
    if (/^\d{11}$/.test(cleanABN)) {
      // Could add ABN checksum validation here
      return cleanABN;
    }

    return undefined;
  }

  private async enhanceWithTaxCategories(receiptData: ReceiptData): Promise<ReceiptData> {
    // Use Australian tax categories from config
    const taxCategories = {
      'office supplies': AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[9], // Office Supplies
      stationery: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[9], // Office Supplies
      computer: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[4], // Equipment and Software
      software: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[4], // Equipment and Software
      fuel: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[0], // Motor Vehicle Expenses
      parking: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[0], // Motor Vehicle Expenses
      taxi: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[1], // Travel and Accommodation
      uber: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[1], // Travel and Accommodation
      accommodation: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[1], // Travel and Accommodation
      meal: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[2], // Meals and Entertainment
      coffee: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[2], // Meals and Entertainment
      restaurant: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[2], // Meals and Entertainment
      phone: 'Phone and internet',
      internet: 'Phone and internet',
      insurance: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[6], // Insurance
      rent: 'Rent expenses',
      electricity: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[10], // Utilities
      gas: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[10], // Utilities
      water: AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES[10], // Utilities
    };

    // Enhance line items with categories
    const enhancedLineItems = receiptData.lineItems.map((item) => {
      const lowerDesc = item.description.toLowerCase();
      let category: string | undefined;

      for (const [keyword, cat] of Object.entries(taxCategories)) {
        if (lowerDesc.includes(keyword)) {
          category = cat;
          break;
        }
      }

      return { ...item, category };
    });

    // Calculate GST using Australian GST rate
    let gstAmount = receiptData.gstAmount;
    if (!gstAmount && receiptData.isGstCompliant) {
      // Calculate GST using Australian rate (10%)
      gstAmount =
        (receiptData.totalAmount * AUSTRALIAN_TAX_CONFIG.GST_RATE) /
        (1 + AUSTRALIAN_TAX_CONFIG.GST_RATE);
    }

    return {
      ...receiptData,
      gstAmount,
      lineItems: enhancedLineItems,
    };
  }

  async detectDuplicateReceipt(
    receiptData: ReceiptData,
    userId: string,
    timeWindowDays: number = 7,
  ): Promise<boolean> {
    try {
      // Check for similar receipts within the time window
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeWindowDays);

      const similarReceipts = await prisma.receipt.findMany({
        where: {
          userId,
          merchant: receiptData.merchantName,
          totalAmount: {
            gte: receiptData.totalAmount * 0.99, // Allow 1% variance
            lte: receiptData.totalAmount * 1.01,
          },
          date: {
            gte: new Date(receiptData.date.getTime() - 24 * 60 * 60 * 1000), // Same day
            lte: new Date(receiptData.date.getTime() + 24 * 60 * 60 * 1000),
          },
          createdAt: {
            gte: startDate,
          },
          deletedAt: null,
        },
        select: {
          id: true,
          merchant: true,
          totalAmount: true,
          date: true,
        },
      });

      return similarReceipts.length > 0;
    } catch (error) {
      logger.error('Duplicate detection error:', error);
      return false;
    }
  }

  validateReceiptData(data: ReceiptData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.merchantName || data.merchantName === 'Unknown Merchant') {
      errors.push('Merchant name could not be identified');
    }

    if (data.totalAmount <= 0) {
      errors.push('Total amount must be greater than zero');
    }

    if (data.gstAmount && data.gstAmount > data.totalAmount) {
      errors.push('GST amount cannot exceed total amount');
    }

    if (data.confidence < 0.5) {
      errors.push('Receipt quality is too low for accurate processing');
    }

    if (data.isGstCompliant && data.totalAmount > 82.5 && !data.abn) {
      errors.push('Tax invoice over $82.50 requires ABN');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async checkCache(cacheKey: string): Promise<ReceiptData | null> {
    try {
      const cached = await prisma.aICache.findFirst({
        where: {
          cacheKey: cacheKey,
          expiresAt: { gt: new Date() },
        },
      });

      if (cached) {
        // Update hit count
        await prisma.aICache.update({
          where: { id: cached.id },
          data: { hitCount: { increment: 1 } },
        });

        if (typeof cached.response === 'string') {
          return JSON.parse(cached.response);
        }
        return null;
      }
    } catch (error) {
      logger.error('Cache check error:', error);
    }

    return null;
  }

  private async saveToCache(cacheKey: string, data: ReceiptData, cost: number): Promise<void> {
    try {
      // Cache for 7 days for receipts
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.aICache.create({
        data: {
          cacheKey: cacheKey,
          inputHash: cacheKey,
          response: JSON.stringify(data),
          expiresAt,
          provider: 'gemini',
          model: 'gemini-pro-vision',
          operationType: AIOperationType.RECEIPT_SCANNING,
        },
      });
    } catch (error) {
      logger.error('Cache save error:', error);
    }
  }

  private async trackUsage(data: {
    userId?: string;
    businessId?: string;
    operationType: string;
    provider: string;
    model: string;
    tokensUsed: number;
    cost: number;
    responseTimeMs: number;
    success: boolean;
    error?: string;
  }): Promise<void> {
    try {
      // Only track usage if we have a valid userId
      if (!data.userId) {
        return;
      }

      await prisma.aIUsageTracking.create({
        data: {
          userId: data.userId,
          operationType: data.operationType,
          provider: data.provider,
          model: data.model,
          tokensInput: 0,
          tokensOutput: data.tokensUsed,
          costUsd: data.cost,
          responseTimeMs: data.responseTimeMs,
          success: data.success,
          errorMessage: data.error || undefined,
        },
      });
    } catch (error) {
      logger.error('Usage tracking error:', error);
    }
  }
}

// Export singleton instance
export const receiptProcessor = new ReceiptProcessingService();
