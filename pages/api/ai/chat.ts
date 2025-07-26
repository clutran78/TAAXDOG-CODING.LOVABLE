import { NextApiRequest, NextApiResponse } from 'next';
import { AIService } from '../../../lib/ai/ai-service';
import { AIOperationType, SYSTEM_PROMPTS } from '../../../lib/ai/config';
import { prisma } from '../../../lib/prisma';
import { authMiddleware, AuthenticatedRequest } from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { sanitizers, addSecurityHeaders, sanitizedSchemas } from '../../../lib/security/sanitizer';
import { getClientIp } from 'request-ip';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import {
  sendSuccess,
  sendUnauthorized,
  sendValidationError,
  sendMethodNotAllowed,
  sendInternalError,
  ERROR_CODES,
} from '@/lib/api/response';

// Validation schema for chat requests
const ChatRequestSchema = z.object({
  message: sanitizedSchemas.basicFormat
    .min(1, 'Message is required')
    .max(4000, 'Message must be less than 4000 characters'),
  sessionId: z.string().uuid('Invalid session ID format').optional(),
  operationType: z.nativeEnum(AIOperationType).default(AIOperationType.FINANCIAL_ADVICE),
  context: z.record(z.any()).optional(),
});

/**
 * AI Chat API endpoint with enhanced security
 * Handles POST (send message) operations
 * Uses authentication middleware to ensure data isolation
 */
async function chatHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, ['POST']);
  }

  const userId = req.userId;
  const clientIp = getClientIp(req) || 'unknown';

  try {
    // Validate userId exists
    if (!userId) {
      return apiResponse.unauthorized(res, 'User ID not found in authenticated request');
    }

    // Validate and sanitize input data
    const validationResult = ChatRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return apiResponse.validationError(res, errors, {
        message: 'Invalid input data',
      });
    }

    const { message, sessionId, operationType, context } = validationResult.data;

    // Log AI chat access for audit
    await prisma.auditLog
      .create({
        data: {
          event: 'AI_CHAT_ACCESS',
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            operationType,
            sessionId: sessionId || 'new',
            messageLength: message.length,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err););

    // Initialize AI service with multi-provider support
    const aiService = new AIService();

    // Generate or use existing session ID
    const currentSessionId = sessionId || uuidv4();

    // Prepare messages with system prompt
    const systemPrompt = getSystemPromptForOperation(operationType);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }, // Already sanitized
    ];

    // Add context if provided (ensure no sensitive data leakage)
    if (context) {
      // Filter out sensitive fields from context
      const { password, apiKey, secret, ...safeContext } = context;
      messages.splice(1, 0, {
        role: 'system',
        content: `Additional context: ${JSON.stringify(safeContext)}`,
      });
    }

    // Send message using multi-provider AI service with failover
    const response = await aiService.sendMessage(
      messages,
      userId,
      operationType as AIOperationType,
      currentSessionId,
      true, // enable caching
    );

    // Log successful AI response
    await prisma.auditLog
      .create({
        data: {
          event: 'AI_CHAT_RESPONSE',
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            sessionId: currentSessionId,
            provider: response.provider,
            model: response.model,
            tokensUsed: response.tokensUsed,
            cost: response.cost,
            cached: response.cost === 0,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err););

    // Set security headers
    res.setHeader('Cache-Control', 'private, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return apiResponse.success(
      res,
      {
        sessionId: currentSessionId,
        response: response.content,
        provider: response.provider,
        model: response.model,
        tokensUsed: response.tokensUsed,
        cost: response.cost,
        responseTimeMs: response.responseTimeMs,
        cached: response.cost === 0,
      },
      {
        meta: {
          requestId: (req as any).requestId,
          processingTime: response.responseTimeMs,
        },
      },
    );
  } catch (error) {
    logger.error('AI chat error:', error, { userId });

    // Log error
    await prisma.auditLog
      .create({
        data: {
          event: 'AI_CHAT_ERROR',
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err););

    return apiResponse.internalError(res, error, {
      message: 'Unable to process your request. Please try again.',
      includeDetails: process.env.NODE_ENV === 'development',
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

// Export with authentication and rate limiting middleware
export default withSessionRateLimit(authMiddleware.authenticated(chatHandler), {
  window: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute (AI is expensive)
});
