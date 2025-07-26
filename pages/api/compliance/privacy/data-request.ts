import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrivacyComplianceService } from '@/lib/services/compliance';
import { DataRequestType } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

// Validation schemas
const createDataRequestSchema = z.object({
  requestType: z.nativeEnum(DataRequestType),
  requestDetails: z.any().optional(),
  verificationMethod: z.string().optional(),
});

const processDataRequestSchema = z.object({
  requestId: z.string().uuid(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  switch (req.method) {
    case 'POST':
      // Check if this is a process request (admin only)
      if (req.body.requestId) {
        if (!['ADMIN', 'SUPPORT'].includes(session.user.role)) {
          return apiResponse.forbidden(res, { error: 'Forbidden - Admin access required' });
        }
        return handleProcessRequest(req, res, session.user.id);
      }
      // Otherwise, create new request
      return handleCreateRequest(req, res, session.user.id);
    default:
      return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }
}

async function handleCreateRequest(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const validatedData = createDataRequestSchema.parse(req.body);

    const result = await PrivacyComplianceService.createDataRequest({
      userId,
      requestType: validatedData.requestType,
      requestDetails: validatedData.requestDetails,
      verificationMethod: validatedData.verificationMethod || 'email',
    });

    if (!result.success) {
      return apiResponse.error(res, {
        error: 'Failed to create data request',
      });
    }

    return apiResponse.created(res, {
      success: true,
      data: {
        requestId: result.requestId,
        message: 'Your data request has been received and will be processed within 30 days.',
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return apiResponse.error(res, {
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Error creating data request:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to create data request',
    });
  }
}

async function handleProcessRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  processedBy: string,
) {
  try {
    const validatedData = processDataRequestSchema.parse(req.body);

    const result = await PrivacyComplianceService.processDataRequest(
      validatedData.requestId,
      processedBy,
    );

    if (!result.success) {
      return apiResponse.error(res, {
        error: 'Failed to process data request',
      });
    }

    return apiResponse.success(res, {
      success: true,
      data: {
        message: 'Data request processed successfully',
        exportUrl: result.exportUrl,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return apiResponse.error(res, {
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Error processing data request:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to process data request',
    });
  }
}
