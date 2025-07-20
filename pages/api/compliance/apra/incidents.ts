import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { APRAComplianceService } from '@/lib/services/compliance';
import { IncidentType, IncidentSeverity, IncidentStatus } from '@prisma/client';
import { z } from 'zod';
import { withRateLimit } from '@/lib/middleware/rateLimiter';

// Validation schemas
const createIncidentSchema = z.object({
  incidentType: z.nativeEnum(IncidentType),
  severity: z.nativeEnum(IncidentSeverity),
  title: z.string().min(1).max(500),
  description: z.string(),
  affectedSystems: z.array(z.string()),
  dataCompromised: z.boolean(),
  immediateActions: z.any().optional(),
});

const updateIncidentSchema = z.object({
  incidentId: z.string().uuid(),
  status: z.nativeEnum(IncidentStatus),
  rootCause: z.string().optional(),
  remediation: z.any().optional(),
  preventiveMeasures: z.any().optional(),
  affectedUsers: z.number().optional(),
  financialImpact: z.number().optional(),
});

const submitToAPRASchema = z.object({
  incidentId: z.string().uuid(),
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Only admin and support roles can manage incidents
  if (!['ADMIN', 'SUPPORT'].includes(session.user.role)) {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  switch (req.method) {
    case 'POST':
      // Check if this is an update or submit request
      if (req.body.incidentId && req.body.status) {
        return handleUpdateIncident(req, res);
      } else if (req.body.incidentId && !req.body.status) {
        return handleSubmitToAPRA(req, res);
      }
      // Otherwise, create new incident
      return handleCreateIncident(req, res, session.user.id);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleCreateIncident(
  req: NextApiRequest,
  res: NextApiResponse,
  reportedBy: string
) {
  try {
    const validatedData = createIncidentSchema.parse(req.body);

    const result = await APRAComplianceService.createIncidentReport(
      {
        incidentType: validatedData.incidentType,
        severity: validatedData.severity,
        title: validatedData.title,
        description: validatedData.description,
        affectedSystems: validatedData.affectedSystems,
        dataCompromised: validatedData.dataCompromised,
        immediateActions: validatedData.immediateActions,
      },
      reportedBy
    );

    if (!result.success) {
      return res.status(400).json({
        error: 'Failed to create incident report',
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        incidentId: result.incidentId,
        message: validatedData.severity === IncidentSeverity.CRITICAL 
          ? 'Critical incident reported. Immediate action protocols activated.'
          : 'Incident report created successfully.',
      },
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Error creating incident:', error instanceof Error ? error.message : 'Unknown error occurred');
    return res.status(500).json({
      error: 'Failed to create incident report',
    });
  }
}

async function handleUpdateIncident(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const validatedData = updateIncidentSchema.parse(req.body);

    await APRAComplianceService.updateIncidentStatus(
      validatedData.incidentId,
      validatedData.status,
      {
        rootCause: validatedData.rootCause,
        remediation: validatedData.remediation,
        preventiveMeasures: validatedData.preventiveMeasures,
        affectedUsers: validatedData.affectedUsers,
        financialImpact: validatedData.financialImpact,
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Incident updated successfully',
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Error updating incident:', error instanceof Error ? error.message : 'Unknown error occurred');
    return res.status(500).json({
      error: 'Failed to update incident',
    });
  }
}

async function handleSubmitToAPRA(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const validatedData = submitToAPRASchema.parse(req.body);

    const result = await APRAComplianceService.submitToAPRA(validatedData.incidentId);

    if (!result.success) {
      return res.status(400).json({
        error: 'Failed to submit to APRA',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        reference: result.reference,
        message: 'Incident successfully reported to APRA',
      },
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Error submitting to APRA:', error instanceof Error ? error.message : 'Unknown error occurred');
    return res.status(500).json({
      error: 'Failed to submit to APRA',
    });
  }
}

// Export the handler wrapped with rate limiting
export default withRateLimit(handler, 'compliance');