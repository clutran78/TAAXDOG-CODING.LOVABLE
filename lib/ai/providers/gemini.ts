import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAIProvider } from '../base-provider';
import { AIMessage, AIResponse, AIProvider } from '../types';

export class GeminiProvider extends BaseAIProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string, model = 'gemini-pro') {
    super({
      provider: AIProvider.GEMINI,
      apiKey,
      model,
      maxTokens: 4096,
      temperature: 0.7,
    });

    this.client = new GoogleGenerativeAI(apiKey);
  }

  async sendMessage(messages: AIMessage[]): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const model = this.client.getGenerativeModel({
        model: this.config.model,
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
        },
      });

      // Convert messages to Gemini format
      const chat = model.startChat({
        history: messages.slice(0, -1).map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
      });

      const lastMessage = messages[messages.length - 1];
      const result = await this.retryWithBackoff(async () => {
        return await chat.sendMessage(lastMessage.content);
      });

      const response = await result.response;
      const content = response.text();
      const responseTimeMs = Date.now() - startTime;

      // Estimate tokens (Gemini doesn't provide exact counts)
      const tokensInput = this.estimateTokens(messages.map((m) => m.content).join(' '));
      const tokensOutput = this.estimateTokens(content);
      const totalTokens = tokensInput + tokensOutput;

      // Calculate cost
      const cost = this.estimateCost(tokensInput, tokensOutput);

      await this.recordSuccess();

      return {
        content,
        provider: AIProvider.GEMINI,
        model: this.config.model,
        tokensUsed: {
          input: tokensInput,
          output: tokensOutput,
          total: totalTokens,
        },
        cost,
        responseTimeMs,
      };
    } catch (error) {
      await this.recordFailure(error as Error);

      if (error instanceof Error) {
        throw this.createError(
          error.message,
          undefined,
          error.message.includes('429') || error.message.includes('500'),
        );
      }

      throw error;
    }
  }

  async processImage(imageData: string, prompt: string): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const model = this.client.getGenerativeModel({ model: 'gemini-pro-vision' });

      const result = await this.retryWithBackoff(async () => {
        return await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageData,
            },
          },
        ]);
      });

      const response = await result.response;
      const content = response.text();
      const responseTimeMs = Date.now() - startTime;

      // Estimate tokens
      const tokensInput = this.estimateTokens(prompt) + 256; // Add tokens for image
      const tokensOutput = this.estimateTokens(content);
      const totalTokens = tokensInput + tokensOutput;

      // Calculate cost
      const cost = this.estimateCost(tokensInput, tokensOutput);

      await this.recordSuccess();

      return {
        content,
        provider: AIProvider.GEMINI,
        model: 'gemini-pro-vision',
        tokensUsed: {
          input: tokensInput,
          output: tokensOutput,
          total: totalTokens,
        },
        cost,
        responseTimeMs,
      };
    } catch (error) {
      await this.recordFailure(error as Error);
      throw error;
    }
  }

  private estimateTokens(text: string): number {
    // Simple estimation: ~1 token per 4 characters
    return Math.ceil(text.length / 4);
  }

  estimateCost(tokensInput: number, tokensOutput: number): number {
    // Gemini Pro pricing (as of 2024)
    // Input: $0.50 per million tokens
    // Output: $1.50 per million tokens
    const inputCost = (tokensInput / 1_000_000) * 0.5;
    const outputCost = (tokensOutput / 1_000_000) * 1.5;

    return Number((inputCost + outputCost).toFixed(6));
  }
}
