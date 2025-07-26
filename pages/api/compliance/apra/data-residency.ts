import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { APRAComplianceService } from '@/lib/services/compliance';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  // Only admin can check data residency
  if (session.user.role !== 'ADMIN') {
    return apiResponse.forbidden(res, { error: 'Forbidden - Admin access required' });
  }

  try {
    const residencyCheck = await APRAComplianceService.checkDataResidency();
    const businessContinuity = await APRAComplianceService.verifyBusinessContinuity();
    const systemHealth = await APRAComplianceService.monitorSystemHealth();

    return apiResponse.success(res, {
      success: true,
      data: {
        dataResidency: residencyCheck,
        businessContinuity,
        systemHealth,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error checking data residency:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to check data residency',
    });
  }
}
