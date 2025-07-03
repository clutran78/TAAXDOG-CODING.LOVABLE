import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { securityAuditLogger, accessControl, rateLimiter, DataSanitizer } from './security';
import { basiqDB } from './database';

// Security middleware for BASIQ endpoints
export async function withBasiqSecurity(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const startTime = Date.now();
    let responseStatus = 200;
    let responseBody: any = {};
    let error: string | undefined;

    try {
      // Check authentication
      const session = await getServerSession(req, res, authOptions);
      if (!session || !session.user) {
        responseStatus = 401;
        responseBody = { error: 'Unauthorized' };
        return res.status(responseStatus).json(responseBody);
      }

      // Extract request details
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                       req.socket.remoteAddress || 
                       'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Rate limiting
      const endpoint = req.url?.split('?')[0] || 'unknown';
      const rateLimitKey = `basiq:${endpoint}`;
      
      if (!await rateLimiter.checkLimit(session.user.id, rateLimitKey)) {
        responseStatus = 429;
        responseBody = { 
          error: 'Rate limit exceeded',
          retryAfter: 60,
          remaining: rateLimiter.getRemainingRequests(session.user.id, rateLimitKey),
        };
        
        await securityAuditLogger.logSecurityEvent({
          type: 'SUSPICIOUS_ACTIVITY' as any,
          userId: session.user.id,
          action: 'rate_limit_exceeded',
          result: 'failure',
          metadata: { endpoint },
          ipAddress,
          userAgent,
        });
        
        return res.status(responseStatus).json(responseBody);
      }

      // Check consent for banking operations
      const bankingEndpoints = ['/api/basiq/accounts', '/api/basiq/transactions', '/api/basiq/sync'];
      if (bankingEndpoints.some(ep => endpoint.includes(ep))) {
        const hasConsent = await accessControl.hasValidConsent(session.user.id);
        if (!hasConsent) {
          responseStatus = 403;
          responseBody = { error: 'Valid consent required for banking operations' };
          return res.status(responseStatus).json(responseBody);
        }
      }

      // Resource access control
      if (req.method === 'GET' || req.method === 'PUT' || req.method === 'DELETE') {
        const { accountId, transactionId, connectionId } = req.query;
        
        if (accountId && typeof accountId === 'string') {
          const canAccess = await accessControl.canAccessBankAccount(session.user.id, accountId);
          if (!canAccess) {
            responseStatus = 403;
            responseBody = { error: 'Access denied to this account' };
            return res.status(responseStatus).json(responseBody);
          }
        }
        
        if (transactionId && typeof transactionId === 'string') {
          const canAccess = await accessControl.canAccessTransaction(session.user.id, transactionId);
          if (!canAccess) {
            responseStatus = 403;
            responseBody = { error: 'Access denied to this transaction' };
            return res.status(responseStatus).json(responseBody);
          }
        }
      }

      // Sanitize request body
      if (req.body) {
        req.body = DataSanitizer.sanitizeObject(req.body);
      }

      // Add security context to request
      (req as any).securityContext = {
        userId: session.user.id,
        ipAddress,
        userAgent,
        sessionId: (session as any).sessionToken,
      };

      // Call the actual handler
      await handler(req, res);

      // Log successful banking access
      if (res.statusCode === 200 && endpoint.includes('/api/basiq/')) {
        await securityAuditLogger.logBankingAccess(
          session.user.id,
          `${req.method} ${endpoint}`,
          req.query.accountId as string,
          {
            query: req.query,
            body: DataSanitizer.sanitizeObject(req.body),
          }
        );
      }

    } catch (err: any) {
      responseStatus = 500;
      error = DataSanitizer.sanitizeError(err);
      responseBody = { error: 'Internal server error', message: error };
      res.status(responseStatus).json(responseBody);

      // Log error
      await securityAuditLogger.logSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY' as any,
        userId: (req as any).securityContext?.userId,
        action: 'endpoint_error',
        result: 'failure',
        metadata: { 
          endpoint: req.url,
          error: error,
        },
      });
    } finally {
      // Log API call with sanitized data
      const duration = Date.now() - startTime;
      const sanitizedBody = DataSanitizer.sanitizeObject(req.body || {});
      const sanitizedResponse = DataSanitizer.sanitizeObject(responseBody);
      
      if ((req as any).securityContext?.userId) {
        await basiqDB.logAPICall(
          (req as any).securityContext.userId,
          req.url || 'unknown',
          req.method || 'GET',
          sanitizedBody,
          responseStatus,
          sanitizedResponse,
          duration,
          error
        );
      }
    }
  };
}

// Data export security middleware
export async function withDataExportSecurity(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Log data export attempt
    const exportType = req.query.type || 'unknown';
    const filters = {
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      accountId: req.query.accountId,
    };

    await securityAuditLogger.logDataExport(
      session.user.id,
      exportType as string,
      0, // Will be updated by handler
      filters
    );

    // Apply rate limiting for exports
    if (!await rateLimiter.checkLimit(session.user.id, 'data-export')) {
      return res.status(429).json({ 
        error: 'Export rate limit exceeded. Please try again later.',
        retryAfter: 300, // 5 minutes
      });
    }

    await handler(req, res);
  };
}

// Webhook security validation
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}