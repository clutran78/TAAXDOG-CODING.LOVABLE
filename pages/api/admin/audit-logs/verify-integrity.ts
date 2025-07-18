import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { verifyAuditLogIntegrity } from '@/lib/services/auditLogger';
import { z } from 'zod';

// Validation schema
const verifyIntegritySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Check if user has admin role
  if (session.user.role !== 'ADMIN' && session.user.role !== 'ACCOUNTANT') {
    return res.status(403).json({ error: 'Forbidden: Admin or Accountant access required' });
  }
  
  try {
    // Validate request body
    const validatedData = verifyIntegritySchema.parse(req.body);
    
    // Verify audit log integrity
    const result = await verifyAuditLogIntegrity(
      validatedData.startDate ? new Date(validatedData.startDate) : undefined,
      validatedData.endDate ? new Date(validatedData.endDate) : undefined
    );
    
    return res.status(200).json({
      success: true,
      data: {
        integrityValid: result.valid,
        errors: result.errors,
        checkedAt: new Date().toISOString(),
        period: {
          startDate: validatedData.startDate || 'All records',
          endDate: validatedData.endDate || 'All records'
        }
      }
    });
    
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    
    console.error('Audit integrity verification error:', error);
    return res.status(500).json({
      error: 'Failed to verify audit log integrity'
    });
  }
}