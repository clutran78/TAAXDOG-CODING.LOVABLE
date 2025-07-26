import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AMLMonitoringService } from '@/lib/services/compliance';
import { createAuditLog } from '@/lib/services/auditLogger';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

// Validation schema
const monitorTransactionSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('AUD'),
  transactionId: z.string().uuid().optional(),
  transactionDate: z.string().datetime(),
  merchantName: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  try {
    // Validate request body
    const validatedData = monitorTransactionSchema.parse(req.body);

    // Monitor the transaction
    const assessment = await AMLMonitoringService.monitorTransaction({
      userId: session.user.id,
      amount: validatedData.amount,
      currency: validatedData.currency,
      transactionId: validatedData.transactionId,
      transactionDate: new Date(validatedData.transactionDate),
      merchantName: validatedData.merchantName,
      category: validatedData.category,
      description: validatedData.description,
    });

    // Create audit log for high-risk transactions
    if (assessment.requiresReview) {
      await createAuditLog(
        {
          userId: session.user.id,
          operationType: 'AML_TRANSACTION_FLAGGED',
          resourceType: 'AML_MONITORING',
          resourceId: validatedData.transactionId,
          currentData: {
            assessment,
            transaction: validatedData,
          },
          amount: validatedData.amount,
          currency: validatedData.currency,
          success: true,
        },
        {
          request: req,
          sessionId: session.user.id,
        },
      );
    }

    return apiResponse.success(res, {
      success: true,
      data: assessment,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return apiResponse.error(res, {
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('AML monitoring error:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to monitor transaction',
    });
  }
}
