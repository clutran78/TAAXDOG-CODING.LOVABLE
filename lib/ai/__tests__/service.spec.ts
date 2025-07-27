import { AIService } from '../service';
import { AIOperation } from '@/lib/types/ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Mock the AI provider SDKs
jest.mock('@anthropic-ai/sdk');
jest.mock('openai');
jest.mock('@google/generative-ai');

// Mock Redis client
jest.mock('@/lib/services/cache/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

describe('AIService', () => {
  let aiService: AIService;
  const mockAnthropicCreate = jest.fn();
  const mockOpenAICreate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Anthropic mock
    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(
      () =>
        ({
          messages: {
            create: mockAnthropicCreate,
          },
        }) as any,
    );

    // Setup OpenAI mock
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: mockOpenAICreate,
            },
          },
        }) as any,
    );

    aiService = new AIService();
  });

  describe('processRequest', () => {
    it('successfully processes a tax analysis request', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'Based on your income, you can claim these deductions...' }],
      });

      const result = await aiService.processRequest(
        'What tax deductions can I claim?',
        AIOperation.TAX_ANALYSIS,
      );

      expect(result.success).toBe(true);
      expect(result.data).toContain('deductions');
      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.stringContaining('claude'),
          max_tokens: expect.any(Number),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('What tax deductions can I claim?'),
            }),
          ]),
        }),
      );
    });

    it('includes Australian tax context in system prompt', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'Tax response' }],
      });

      await aiService.processRequest('Tax question', AIOperation.TAX_ANALYSIS);

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Australian tax'),
            }),
          ]),
        }),
      );
    });

    it('falls back to OpenRouter when Anthropic fails', async () => {
      mockAnthropicCreate.mockRejectedValueOnce(new Error('Anthropic API error'));
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OpenRouter response' } }],
      });

      const result = await aiService.processRequest('Test prompt', AIOperation.GENERAL_QUERY);

      expect(result.success).toBe(true);
      expect(result.data).toBe('OpenRouter response');
      expect(mockOpenAICreate).toHaveBeenCalled();
    });

    it('returns cached response when available', async () => {
      const cachedResponse = {
        success: true,
        data: 'Cached response',
        cached: true,
        provider: 'cache',
      };

      const redis = require('@/lib/services/cache/redis').redis;
      redis.get.mockResolvedValueOnce(JSON.stringify(cachedResponse));

      const result = await aiService.processRequest('Cached query', AIOperation.GENERAL_QUERY);

      expect(result.cached).toBe(true);
      expect(result.data).toBe('Cached response');
      expect(mockAnthropicCreate).not.toHaveBeenCalled();
    });

    it('caches successful responses', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'New response to cache' }],
      });

      const redis = require('@/lib/services/cache/redis').redis;
      redis.get.mockResolvedValueOnce(null);

      await aiService.processRequest('New query', AIOperation.GENERAL_QUERY);

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('ai_response:'),
        expect.any(String),
        'EX',
        86400, // 24 hours
      );
    });

    it('handles all provider failures gracefully', async () => {
      mockAnthropicCreate.mockRejectedValueOnce(new Error('Anthropic failed'));
      mockOpenAICreate.mockRejectedValueOnce(new Error('OpenRouter failed'));

      const result = await aiService.processRequest('Test prompt', AIOperation.GENERAL_QUERY);

      expect(result.success).toBe(false);
      expect(result.error).toContain('All AI providers failed');
    });

    it('respects rate limits per provider', async () => {
      // Simulate rate limit by making multiple requests
      const promises = [];
      for (let i = 0; i < 15; i++) {
        mockAnthropicCreate.mockResolvedValueOnce({
          content: [{ text: `Response ${i}` }],
        });
        promises.push(aiService.processRequest(`Query ${i}`, AIOperation.GENERAL_QUERY));
      }

      const results = await Promise.all(promises);

      // Some requests should have been rate limited
      const rateLimited = results.filter((r) => !r.success && r.error?.includes('rate limit'));
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('tracks token usage and costs', async () => {
      const mockUsage = {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      };

      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'Response with usage' }],
        usage: mockUsage,
      });

      const result = await aiService.processRequest('Test prompt', AIOperation.GENERAL_QUERY);

      expect(result.usage).toEqual(mockUsage);
      expect(result.cost).toBeGreaterThan(0);
    });

    it('selects appropriate model based on operation', async () => {
      // Tax analysis should use more capable model
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'Tax response' }],
      });

      await aiService.processRequest('Complex tax question', AIOperation.TAX_ANALYSIS);

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-opus-20240229', // More capable model for tax
        }),
      );

      // General query can use faster model
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'General response' }],
      });

      await aiService.processRequest('Simple question', AIOperation.GENERAL_QUERY);

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-haiku-20240307', // Faster model for general
        }),
      );
    });

    it('validates input prompt length', async () => {
      const veryLongPrompt = 'x'.repeat(100000); // 100k characters

      const result = await aiService.processRequest(veryLongPrompt, AIOperation.GENERAL_QUERY);

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });

    it('sanitizes sensitive information from prompts', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'Sanitized response' }],
      });

      await aiService.processRequest(
        'My TFN is 123-456-789 and my credit card is 4111-1111-1111-1111',
        AIOperation.GENERAL_QUERY,
      );

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.not.stringContaining('123-456-789'),
            }),
          ]),
        }),
      );
    });
  });

  describe('processReceiptImage', () => {
    it('extracts receipt data from image', async () => {
      const mockReceiptData = {
        merchant: 'Test Store',
        total: 99.99,
        date: '2024-01-15',
        items: [
          { name: 'Item 1', price: 49.99 },
          { name: 'Item 2', price: 50.0 },
        ],
      };

      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: JSON.stringify(mockReceiptData) }],
      });

      const result = await aiService.processReceiptImage('base64imagedata', 'image/jpeg');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockReceiptData);
    });

    it('validates image format', async () => {
      const result = await aiService.processReceiptImage('base64data', 'image/invalid');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported image format');
    });

    it('handles malformed receipt data gracefully', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'Not valid JSON' }],
      });

      const result = await aiService.processReceiptImage('base64imagedata', 'image/jpeg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse receipt data');
    });
  });

  describe('generateInsights', () => {
    it('generates financial insights from transaction data', async () => {
      const mockTransactions = [
        { category: 'FOOD', amount: 50, date: '2024-01-01' },
        { category: 'TRANSPORT', amount: 30, date: '2024-01-02' },
      ];

      mockAnthropicCreate.mockResolvedValueOnce({
        content: [
          {
            text: JSON.stringify({
              insights: ['You spend most on food', 'Consider meal planning'],
              recommendations: ['Set a food budget'],
            }),
          },
        ],
      });

      const result = await aiService.generateInsights(mockTransactions);

      expect(result.success).toBe(true);
      expect(result.data.insights).toBeInstanceOf(Array);
      expect(result.data.recommendations).toBeInstanceOf(Array);
    });

    it('handles empty transaction data', async () => {
      const result = await aiService.generateInsights([]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No transaction data');
    });
  });
});
