import { BaseAIProvider } from '../base-provider';
import { AIMessage, AIResponse, AIProvider } from '../types';

interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterProvider extends BaseAIProvider {
  private baseURL = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(apiKey: string, model = 'anthropic/claude-3.5-sonnet') {
    super({
      provider: AIProvider.OPENROUTER,
      apiKey,
      model,
      maxTokens: 4096,
      temperature: 0.7,
    });
  }

  async sendMessage(messages: AIMessage[]): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const response = await this.retryWithBackoff(async () => {
        const res = await fetch(this.baseURL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://taxreturnpro.com.au',
            'X-Title': 'TAAX Dog Tax Assistant',
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw this.createError(
            error.error?.message || 'OpenRouter API error',
            res.status,
            res.status === 429 || res.status >= 500,
          );
        }

        return res.json() as Promise<OpenRouterResponse>;
      });

      const responseTimeMs = Date.now() - startTime;

      // Extract tokens and content
      const tokensInput = response.usage?.prompt_tokens || 0;
      const tokensOutput = response.usage?.completion_tokens || 0;
      const totalTokens = response.usage?.total_tokens || 0;
      const content = response.choices[0]?.message?.content || '';

      // Calculate cost
      const cost = this.estimateCost(tokensInput, tokensOutput);

      await this.recordSuccess();

      return {
        content,
        provider: AIProvider.OPENROUTER,
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
      throw error;
    }
  }

  estimateCost(tokensInput: number, tokensOutput: number): number {
    // OpenRouter pricing varies by model
    // Claude 3.5 Sonnet via OpenRouter (approximate)
    // Input: $3 per million tokens
    // Output: $15 per million tokens
    let inputRate = 3;
    let outputRate = 15;

    // Adjust rates based on model
    if (this.config.model.includes('gpt-4')) {
      inputRate = 30;
      outputRate = 60;
    } else if (this.config.model.includes('gpt-3.5')) {
      inputRate = 0.5;
      outputRate = 1.5;
    }

    const inputCost = (tokensInput / 1_000_000) * inputRate;
    const outputCost = (tokensOutput / 1_000_000) * outputRate;

    return Number((inputCost + outputCost).toFixed(6));
  }
}
