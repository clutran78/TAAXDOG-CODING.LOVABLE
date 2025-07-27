import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from '../base-provider';
import { AIMessage, AIResponse, AIProvider } from '../types';

export class AnthropicProvider extends BaseAIProvider {
  private client: Anthropic;

  constructor(apiKey: string, model = 'claude-3-sonnet-20240229') {
    super({
      provider: AIProvider.ANTHROPIC,
      apiKey,
      model,
      maxTokens: 4096,
      temperature: 0.7,
    });

    this.client = new Anthropic({
      apiKey,
    });
  }

  async sendMessage(messages: AIMessage[]): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const systemMessage = messages.find((m) => m.role === 'system');
      const userMessages = messages.filter((m) => m.role !== 'system');

      const response = await this.retryWithBackoff(async () => {
        return await this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens || 4096,
          temperature: this.config.temperature || 0.7,
          system: systemMessage?.content,
          messages: userMessages.map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
          })),
        });
      });

      const responseTimeMs = Date.now() - startTime;

      // Calculate tokens (Anthropic provides usage info)
      const tokensInput = response.usage?.input_tokens || 0;
      const tokensOutput = response.usage?.output_tokens || 0;
      const totalTokens = tokensInput + tokensOutput;

      // Calculate cost
      const cost = this.estimateCost(tokensInput, tokensOutput);

      await this.recordSuccess();

      return {
        content: response.content[0].type === 'text' ? response.content[0].text : '',
        provider: AIProvider.ANTHROPIC,
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

      if (error instanceof Anthropic.APIError) {
        throw this.createError(
          error.message,
          error.status,
          error.status === 429 || error.status >= 500,
        );
      }

      throw error;
    }
  }

  estimateCost(tokensInput: number, tokensOutput: number): number {
    // Claude 3 Sonnet pricing (as of 2024)
    // Input: $3 per million tokens
    // Output: $15 per million tokens
    const inputCost = (tokensInput / 1_000_000) * 3;
    const outputCost = (tokensOutput / 1_000_000) * 15;

    return Number((inputCost + outputCost).toFixed(6));
  }
}
