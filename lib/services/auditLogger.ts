import { PrismaClient, FinancialOperation } from '@prisma/client';
import { createHash } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextApiRequest } from 'next';

const prisma = new PrismaClient();

export interface AuditLogData {
  userId: string;
  operationType: FinancialOperation;
  resourceType: string;
  resourceId?: string;
  previousData?: any;
  currentData?: any;
  amount?: number;
  gstAmount?: number;
  currency?: string;
  success?: boolean;
  errorMessage?: string;
}

export interface AuditContext {
  request?: NextApiRequest;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Calculate Australian tax year from a date
 */
function getAustralianTaxYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Australian tax year runs from July 1 to June 30
  if (month >= 6) { // July (6) onwards
    return `${year}/${year + 1}`;
  } else {
    return `${year - 1}/${year}`;
  }
}

/**
 * Calculate changed fields between two objects
 */
function calculateChangedFields(previousData: any, currentData: any): string[] {
  if (!previousData || !currentData) return [];
  
  const changes: string[] = [];
  const allKeys = new Set([
    ...Object.keys(previousData),
    ...Object.keys(currentData)
  ]);
  
  for (const key of allKeys) {
    if (JSON.stringify(previousData[key]) !== JSON.stringify(currentData[key])) {
      changes.push(key);
    }
  }
  
  return changes;
}

/**
 * Generate hash for audit log integrity
 */
async function generateAuditHash(data: any, previousHash?: string): Promise<string> {
  const content = JSON.stringify({
    ...data,
    previousHash: previousHash || null,
    timestamp: new Date().toISOString()
  });
  
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Extract IP address from request
 */
function extractIpAddress(request?: NextApiRequest): string {
  if (!request) return 'system';
  
  // Check various headers for IP address
  const forwarded = request.headers['x-forwarded-for'];
  const realIp = request.headers['x-real-ip'];
  const cloudflareIp = request.headers['cf-connecting-ip'];
  
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  
  if (cloudflareIp) {
    return Array.isArray(cloudflareIp) ? cloudflareIp[0] : cloudflareIp;
  }
  
  return request.socket?.remoteAddress || 'unknown';
}

/**
 * Create a financial audit log entry
 */
export async function createAuditLog(
  data: AuditLogData,
  context: AuditContext = {}
): Promise<void> {
  try {
    // Get the latest audit log to maintain hash chain
    const lastAuditLog = await prisma.financialAuditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { hashChain: true }
    });
    
    // Calculate changed fields if both previous and current data exist
    const changedFields = calculateChangedFields(data.previousData, data.currentData);
    
    // Generate hash for this audit entry
    const auditData = {
      userId: data.userId,
      sessionId: context.sessionId || null,
      operationType: data.operationType,
      resourceType: data.resourceType,
      resourceId: data.resourceId || null,
      ipAddress: context.ipAddress || extractIpAddress(context.request),
      userAgent: context.userAgent || context.request?.headers['user-agent'] || null,
      httpMethod: context.request?.method || null,
      endpoint: context.request?.url || null,
      previousData: data.previousData || null,
      currentData: data.currentData || null,
      changedFields,
      amount: data.amount || null,
      gstAmount: data.gstAmount || null,
      currency: data.currency || 'AUD',
      taxYear: getAustralianTaxYear(),
      success: data.success !== false,
      errorMessage: data.errorMessage || null,
      previousHash: lastAuditLog?.hashChain || null
    };
    
    const hashChain = await generateAuditHash(auditData, lastAuditLog?.hashChain);
    
    // Create the audit log entry
    await prisma.financialAuditLog.create({
      data: {
        ...auditData,
        hashChain
      }
    });
  } catch (error) {
    // Log to console but don't throw - audit logging should not break the main operation
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Audit log middleware for API routes
 */
export function withAuditLogging(
  operationType: FinancialOperation,
  resourceType: string
) {
  return function (handler: any) {
    return async (req: NextApiRequest, res: any) => {
      const session = await getServerSession(req, res, authOptions);
      const startTime = Date.now();
      
      // Capture request data
      const context: AuditContext = {
        request: req,
        sessionId: session?.user?.id,
        ipAddress: extractIpAddress(req),
        userAgent: req.headers['user-agent'] as string
      };
      
      // Store original json method
      const originalJson = res.json;
      let responseData: any;
      let success = true;
      let errorMessage: string | undefined;
      
      // Override json method to capture response
      res.json = function (data: any) {
        responseData = data;
        success = res.statusCode < 400;
        
        if (!success && data?.error) {
          errorMessage = data.error;
        }
        
        return originalJson.call(this, data);
      };
      
      try {
        // Call the actual handler
        await handler(req, res);
        
        // Create audit log after response
        if (session?.user?.id) {
          await createAuditLog({
            userId: session.user.id,
            operationType,
            resourceType,
            currentData: responseData,
            success,
            errorMessage
          }, context);
        }
      } catch (error: any) {
        // Log the error
        if (session?.user?.id) {
          await createAuditLog({
            userId: session.user.id,
            operationType,
            resourceType,
            success: false,
            errorMessage: error.message
          }, context);
        }
        
        throw error;
      }
    };
  };
}

/**
 * Verify audit log integrity
 */
export async function verifyAuditLogIntegrity(
  startDate?: Date,
  endDate?: Date
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  const logs = await prisma.financialAuditLog.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { createdAt: 'asc' }
  });
  
  let previousHash: string | null = null;
  
  for (const log of logs) {
    // Verify hash chain
    if (log.previousHash !== previousHash) {
      errors.push(`Hash chain broken at log ${log.id}`);
    }
    
    // Recalculate hash and verify
    const expectedHash = await generateAuditHash({
      userId: log.userId,
      sessionId: log.sessionId,
      operationType: log.operationType,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      httpMethod: log.httpMethod,
      endpoint: log.endpoint,
      previousData: log.previousData,
      currentData: log.currentData,
      changedFields: log.changedFields,
      amount: log.amount,
      gstAmount: log.gstAmount,
      currency: log.currency,
      taxYear: log.taxYear,
      success: log.success,
      errorMessage: log.errorMessage,
      previousHash: log.previousHash
    }, previousHash || undefined);
    
    if (expectedHash !== log.hashChain) {
      errors.push(`Hash mismatch at log ${log.id}`);
    }
    
    previousHash = log.hashChain;
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Clean up old audit logs (keeping 7 years as per Australian requirements)
 */
export async function cleanupOldAuditLogs(): Promise<number> {
  const sevenYearsAgo = new Date();
  sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);
  
  // Archive logs before deletion (in production, this would export to long-term storage)
  const logsToDelete = await prisma.financialAuditLog.findMany({
    where: {
      createdAt: {
        lt: sevenYearsAgo
      }
    }
  });
  
  if (logsToDelete.length > 0) {
    // In production, export these logs to long-term storage here
    console.log(`Archiving ${logsToDelete.length} audit logs older than 7 years`);
    
    // Delete the logs
    const result = await prisma.financialAuditLog.deleteMany({
      where: {
        createdAt: {
          lt: sevenYearsAgo
        }
      }
    });
    
    return result.count;
  }
  
  return 0;
}