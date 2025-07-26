import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateMonthlyComplianceReport } from '@/lib/services/auditReports';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

// Validation schema
const monthlyReportSchema = z.object({
  year: z.number().min(2020).max(2100),
  month: z.number().min(1).max(12),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  // Check if user has admin role
  if (session.user.role !== 'ADMIN' && session.user.role !== 'ACCOUNTANT') {
    return apiResponse.forbidden(res, { error: 'Forbidden: Admin or Accountant access required' });
  }

  try {
    // Validate query parameters
    const validatedData = monthlyReportSchema.parse({
      year: parseInt(req.query.year as string),
      month: parseInt(req.query.month as string),
    });

    // Generate the monthly compliance report
    const report = await generateMonthlyComplianceReport(validatedData.year, validatedData.month);

    return apiResponse.success(res, {
      success: true,
      data: report,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return apiResponse.error(res, {
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Monthly compliance report error:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to generate monthly compliance report',
    });
  }
}
