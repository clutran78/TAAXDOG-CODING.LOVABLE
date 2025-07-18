import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GSTComplianceService } from '@/lib/services/compliance';
import { z } from 'zod';

// Validation schema
const calculateGSTSchema = z.object({
  amount: z.number().positive(),
  category: z.string(),
  isGSTRegistered: z.boolean().default(true),
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
    const validatedData = calculateGSTSchema.parse(req.body);

    const calculation = GSTComplianceService.calculateGST(
      validatedData.amount,
      validatedData.category,
      validatedData.isGSTRegistered
    );

    return res.status(200).json({
      success: true,
      data: calculation,
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Error calculating GST:', error);
    return res.status(500).json({
      error: 'Failed to calculate GST',
    });
  }
}