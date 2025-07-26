import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import winston from 'winston';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

// Define proper types for client errors
interface ClientError {
  userId?: string;
  error: {
    message: string;
    stack?: string;
    name?: string;
    code?: string;
  };
  userAgent: string;
  timestamp: number;
  url: string;
  serverTimestamp: Date;
  batchSize?: number;
}

// Constants for validation and sanitization
const MAX_MESSAGE_LENGTH = 1000;
const MAX_STACK_LENGTH = 5000;
const MAX_URL_LENGTH = 2000;
const MAX_USER_AGENT_LENGTH = 500;

// Configure logger for client errors
const errorLogger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.File({ filename: 'logs/client-errors.log' })],
});

// Store client errors in memory
// TODO: Replace this in-memory store with a persistent database solution for production use.
// Consider using PostgreSQL with Prisma or a dedicated error tracking service like Sentry.
const clientErrorStore: ClientError[] = [];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.id;

    // Validate request body
    const { errors, userAgent, timestamp, url, batchSize } = req.body;

    // Check for required fields
    if (!errors || !Array.isArray(errors) || errors.length === 0) {
      return apiResponse.error(res, {
        error: 'Missing or invalid errors field. Expected non-empty array.',
      });
    }

    if (!userAgent || typeof userAgent !== 'string') {
      return apiResponse.error(res, {
        error: 'Missing or invalid userAgent field. Expected string.',
      });
    }

    if (!url || typeof url !== 'string') {
      return apiResponse.error(res, {
        error: 'Missing or invalid url field. Expected string.',
      });
    }

    if (timestamp && typeof timestamp !== 'number') {
      return apiResponse.error(res, {
        error: 'Invalid timestamp field. Expected number.',
      });
    }

    // Sanitize user agent and URL
    const sanitizedUserAgent = userAgent.substring(0, MAX_USER_AGENT_LENGTH);
    const sanitizedUrl = url.substring(0, MAX_URL_LENGTH);

    // Process each error in the batch
    const processedErrors: ClientError[] = [];

    for (const error of errors) {
      // Validate individual error structure
      if (!error || typeof error !== 'object') {
        continue;
      }

      // Sanitize error message and stack
      const sanitizedError = {
        message: error.message
          ? String(error.message).substring(0, MAX_MESSAGE_LENGTH)
          : 'Unknown error',
        stack: error.stack ? String(error.stack).substring(0, MAX_STACK_LENGTH) : undefined,
        name: error.name ? String(error.name).substring(0, 100) : undefined,
        code: error.code ? String(error.code).substring(0, 50) : undefined,
      };

      const errorData: ClientError = {
        userId,
        error: sanitizedError,
        userAgent: sanitizedUserAgent,
        timestamp: timestamp || Date.now(),
        url: sanitizedUrl,
        serverTimestamp: new Date(),
        batchSize,
      };

      processedErrors.push(errorData);
    }

    // Store errors
    clientErrorStore.push(...processedErrors);

    // Keep only last 500 errors
    while (clientErrorStore.length > 500) {
      clientErrorStore.shift();
    }

    // Log batch to file
    errorLogger.error('Client error batch received', {
      batchSize: processedErrors.length,
      userId,
      url: sanitizedUrl,
      errors: processedErrors,
    });

    // Check for critical errors in the batch
    const criticalErrors = processedErrors.filter(
      (err) =>
        err.error.message.includes('Critical') ||
        err.error.message.includes('Fatal') ||
        err.error.message.includes('CRITICAL') ||
        err.error.message.includes('FATAL'),
    );

    if (criticalErrors.length > 0) {
      // TODO: Send alerts for critical errors
      // - Send to monitoring service (e.g., Sentry, DataDog)
      // - Send email notification to support team
      // - Create incident in PagerDuty or similar
      errorLogger.error('CRITICAL ERRORS DETECTED', {
        count: criticalErrors.length,
        errors: criticalErrors,
      });
    }

    return apiResponse.success(res, {
      success: true,
      processed: processedErrors.length,
      received: errors.length,
    });
  } catch (error) {
    logger.error('Error storing client error:', error);
    return apiResponse.internalError(res, { error: 'Failed to store error' });
  }
}

export { clientErrorStore };
