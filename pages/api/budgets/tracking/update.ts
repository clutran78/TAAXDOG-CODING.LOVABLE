import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { updateBudgetTracking } from '../../../../lib/budget-tracking';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { month, year } = req.body;
    
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    // Update budget tracking for the specified month
    await updateBudgetTracking(session.user.id, month, year);
    
    res.status(200).json({
      success: true,
      message: `Budget tracking updated for ${month}/${year}`,
    });
  } catch (error) {
    console.error('Update tracking error:', error);
    res.status(500).json({ error: 'Failed to update budget tracking' });
  }
}