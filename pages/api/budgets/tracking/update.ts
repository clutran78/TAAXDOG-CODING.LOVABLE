import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { updateBudgetTracking } from '../../../../lib/budget-tracking';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return apiResponse.error(res, { error: 'Month and year are required' });
    }

    // Update budget tracking for the specified month
    await updateBudgetTracking(session.user.id, month, year);

    apiResponse.success(res, {
      success: true,
      message: `Budget tracking updated for ${month}/${year}`,
    });
  } catch (error) {
    logger.error('Update tracking error:', error);
    apiResponse.internalError(res, { error: 'Failed to update budget tracking' });
  }
}
