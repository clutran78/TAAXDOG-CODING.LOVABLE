import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrivacyComplianceService } from '@/lib/services/compliance';
import { ConsentType } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

// Validation schemas
const recordConsentSchema = z.object({
  consentType: z.nativeEnum(ConsentType),
  purposes: z.array(z.string()),
  dataCategories: z.array(z.string()),
  thirdParties: z.array(z.string()).optional(),
  expiryDays: z.number().positive().optional(),
});

const withdrawConsentSchema = z.object({
  consentType: z.nativeEnum(ConsentType),
  reason: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  switch (req.method) {
    case 'GET':
      return handleGetConsents(req, res, session.user.id);
    case 'POST':
      return handleRecordConsent(req, res, session.user.id);
    case 'DELETE':
      return handleWithdrawConsent(req, res, session.user.id);
    default:
      return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }
}

async function handleGetConsents(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const consentHistory = await PrivacyComplianceService.getConsentHistory(userId);

    return apiResponse.success(res, {
      success: true,
      data: consentHistory,
    });
  } catch (error) {
    logger.error('Error fetching consent history:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to fetch consent history',
    });
  }
}

async function handleRecordConsent(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const validatedData = recordConsentSchema.parse(req.body);

    // Get client IP address
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const result = await PrivacyComplianceService.recordConsent({
      userId,
      consentType: validatedData.consentType,
      purposes: validatedData.purposes,
      dataCategories: validatedData.dataCategories,
      thirdParties: validatedData.thirdParties,
      expiryDays: validatedData.expiryDays,
      ipAddress,
      userAgent: req.headers['user-agent'],
    });

    if (!result.success) {
      return apiResponse.error(res, {
        error: 'Failed to record consent',
      });
    }

    return apiResponse.created(res, {
      success: true,
      data: { consentId: result.consentId },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return apiResponse.error(res, {
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Error recording consent:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to record consent',
    });
  }
}

async function handleWithdrawConsent(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const validatedData = withdrawConsentSchema.parse(req.body);

    const result = await PrivacyComplianceService.withdrawConsent(
      userId,
      validatedData.consentType,
      validatedData.reason,
    );

    if (!result.success) {
      return apiResponse.error(res, {
        error: 'Failed to withdraw consent',
      });
    }

    return apiResponse.success(res, {
      success: true,
      message: 'Consent withdrawn successfully',
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return apiResponse.error(res, {
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Error withdrawing consent:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to withdraw consent',
    });
  }
}
