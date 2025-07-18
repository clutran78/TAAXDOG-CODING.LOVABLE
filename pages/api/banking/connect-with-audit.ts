import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient, FinancialOperation } from '@prisma/client';
import { createAuditLog } from '@/lib/services/auditLogger';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schema
const connectBankSchema = z.object({
  institutionId: z.string(),
  institutionName: z.string(),
  consentId: z.string()
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
  
  try {
    // Validate request body
    const validatedData = connectBankSchema.parse(req.body);
    
    // Here you would typically:
    // 1. Call BASIQ API to create connection
    // 2. Store connection details in database
    // For this example, we'll simulate the connection
    
    const bankConnection = {
      id: 'conn_' + Math.random().toString(36).substr(2, 9),
      userId: session.user.id,
      institutionId: validatedData.institutionId,
      institutionName: validatedData.institutionName,
      consentId: validatedData.consentId,
      status: 'connected',
      connectedAt: new Date()
    };
    
    // Create audit log for bank connection
    await createAuditLog({
      userId: session.user.id,
      operationType: FinancialOperation.BANK_CONNECT,
      resourceType: 'BankConnection',
      resourceId: bankConnection.id,
      currentData: {
        institutionId: validatedData.institutionId,
        institutionName: validatedData.institutionName,
        // Don't log sensitive consent details
        consentProvided: true
      },
      success: true
    }, {
      request: req,
      sessionId: session.user.id
    });
    
    return res.status(200).json({
      success: true,
      data: {
        connectionId: bankConnection.id,
        institution: bankConnection.institutionName,
        status: bankConnection.status
      }
    });
    
  } catch (error: any) {
    // Log the failure without exposing sensitive data
    await createAuditLog({
      userId: session.user.id,
      operationType: FinancialOperation.BANK_CONNECT,
      resourceType: 'BankConnection',
      currentData: {
        institutionId: req.body.institutionId,
        // Don't log sensitive data in error cases
        attemptedConnection: true
      },
      success: false,
      errorMessage: error.message
    }, {
      request: req,
      sessionId: session.user.id
    });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    
    console.error('Bank connection error:', error);
    return res.status(500).json({
      error: 'Failed to connect bank account'
    });
  }
}