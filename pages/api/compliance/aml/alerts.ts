import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AMLMonitoringService } from '@/lib/services/compliance';
import { z } from 'zod';

// Validation schema for review action
const reviewAlertSchema = z.object({
  monitoringId: z.string().uuid(),
  decision: z.enum(['CLEAR', 'REPORT', 'FALSE_POSITIVE']),
  notes: z.string().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin or support
  if (!['ADMIN', 'SUPPORT'].includes(session.user.role)) {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  switch (req.method) {
    case 'GET':
      return handleGetAlerts(req, res);
    case 'POST':
      return handleReviewAlert(req, res, session.user.id);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetAlerts(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const alerts = await AMLMonitoringService.getPendingAlerts(limit);

    return res.status(200).json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    console.error('Error fetching AML alerts:', error);
    return res.status(500).json({
      error: 'Failed to fetch alerts',
    });
  }
}

async function handleReviewAlert(
  req: NextApiRequest,
  res: NextApiResponse,
  reviewerId: string
) {
  try {
    const validatedData = reviewAlertSchema.parse(req.body);

    await AMLMonitoringService.reviewAlert(
      validatedData.monitoringId,
      reviewerId,
      validatedData.decision,
      validatedData.notes
    );

    // If decision is to report, submit SMR to AUSTRAC
    if (validatedData.decision === 'REPORT') {
      const result = await AMLMonitoringService.submitSMR(
        validatedData.monitoringId,
        { notes: validatedData.notes }
      );

      return res.status(200).json({
        success: true,
        message: 'Alert reviewed and reported',
        reportReference: result.reference,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Alert reviewed successfully',
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Error reviewing alert:', error);
    return res.status(500).json({
      error: 'Failed to review alert',
    });
  }
}