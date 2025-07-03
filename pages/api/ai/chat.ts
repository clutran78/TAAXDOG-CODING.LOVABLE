import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { AIService } from '../../../lib/ai/ai-service';
import { AIOperationType, SYSTEM_PROMPTS } from '../../../lib/ai/config';
import { prisma } from '../../../lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { 
      message, 
      sessionId, 
      operationType = AIOperationType.FINANCIAL_ADVICE,
      context 
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Initialize AI service with multi-provider support
    const aiService = new AIService();

    // Generate or use existing session ID
    const currentSessionId = sessionId || uuidv4();

    // Prepare messages with system prompt
    const systemPrompt = getSystemPromptForOperation(operationType);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    // Add context if provided
    if (context) {
      messages.splice(1, 0, {
        role: 'system',
        content: `Additional context: ${JSON.stringify(context)}`
      });
    }

    // Send message using multi-provider AI service with failover
    const response = await aiService.sendMessage(
      messages,
      session.user.id,
      operationType as AIOperationType,
      currentSessionId,
      true // enable caching
    );

    res.status(200).json({
      sessionId: currentSessionId,
      response: response.content,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed,
      cost: response.cost,
      responseTimeMs: response.responseTimeMs,
      cached: response.cost === 0
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ 
      error: 'AI chat failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function getSystemPromptForOperation(operationType: string): string {
  const prompts: Record<string, string> = {
    [AIOperationType.TAX_ANALYSIS]: SYSTEM_PROMPTS.TAX_ASSISTANT,
    [AIOperationType.RECEIPT_SCANNING]: SYSTEM_PROMPTS.RECEIPT_ANALYZER,
    [AIOperationType.FINANCIAL_ADVICE]: SYSTEM_PROMPTS.FINANCIAL_ADVISOR,
    [AIOperationType.EXPENSE_CATEGORIZATION]: SYSTEM_PROMPTS.TAX_ASSISTANT,
    [AIOperationType.BUDGET_PREDICTION]: SYSTEM_PROMPTS.FINANCIAL_ADVISOR,
    [AIOperationType.TAX_OPTIMIZATION]: SYSTEM_PROMPTS.TAX_ASSISTANT,
    [AIOperationType.COMPLIANCE_CHECK]: SYSTEM_PROMPTS.TAX_ASSISTANT,
  };

  return prompts[operationType] || SYSTEM_PROMPTS.FINANCIAL_ADVISOR;
}