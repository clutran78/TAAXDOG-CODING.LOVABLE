import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrivacyComplianceService } from '@/lib/services/compliance';
import { DataRequestType } from '@prisma/client';
import { z } from 'zod';

// Validation schemas
const createDataRequestSchema = z.object({
  requestType: z.nativeEnum(DataRequestType),
  requestDetails: z.any().optional(),
  verificationMethod: z.string().optional(),
});

const processDataRequestSchema = z.object({
  requestId: z.string().uuid(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  switch (req.method) {
    case 'POST':
      // Check if this is a process request (admin only)
      if (req.body.requestId) {
        if (!['ADMIN', 'SUPPORT'].includes(session.user.role)) {
          return res.status(403).json({ error: 'Forbidden - Admin access required' });
        }
        return handleProcessRequest(req, res, session.user.id);
      }
      // Otherwise, create new request
      return handleCreateRequest(req, res, session.user.id);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleCreateRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  try {
    const validatedData = createDataRequestSchema.parse(req.body);

    const result = await PrivacyComplianceService.createDataRequest({
      userId,
      requestType: validatedData.requestType,
      requestDetails: validatedData.requestDetails,
      verificationMethod: validatedData.verificationMethod || 'email',
    });

    if (!result.success) {
      return res.status(400).json({
        error: 'Failed to create data request',
      });
    }

    return res.status(201).json({
      success: true,
      data: { 
        requestId: result.requestId,
        message: 'Your data request has been received and will be processed within 30 days.',
      },
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Error creating data request:', error);
    return res.status(500).json({
      error: 'Failed to create data request',
    });
  }
}

async function handleProcessRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  processedBy: string
) {
  try {
    const validatedData = processDataRequestSchema.parse(req.body);

    const result = await PrivacyComplianceService.processDataRequest(
      validatedData.requestId,
      processedBy
    );

    if (!result.success) {
      return res.status(400).json({
        error: 'Failed to process data request',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        message: 'Data request processed successfully',
        exportUrl: result.exportUrl,
      },
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Error processing data request:', error);
    return res.status(500).json({
      error: 'Failed to process data request',
    });
  }
}