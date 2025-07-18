import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { APRAComplianceService } from '@/lib/services/compliance';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Only admin can check data residency
  if (session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  try {
    const residencyCheck = await APRAComplianceService.checkDataResidency();
    const businessContinuity = await APRAComplianceService.verifyBusinessContinuity();
    const systemHealth = await APRAComplianceService.monitorSystemHealth();

    return res.status(200).json({
      success: true,
      data: {
        dataResidency: residencyCheck,
        businessContinuity,
        systemHealth,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Error checking data residency:', error);
    return res.status(500).json({
      error: 'Failed to check data residency',
    });
  }
}