import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GSTComplianceService } from '@/lib/services/compliance';
import { z } from 'zod';

// Validation schema
const generateBASReportSchema = z.object({
  taxPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$|^\d{4}-Q[1-4]$/),
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
    const validatedData = generateBASReportSchema.parse(req.body);

    const report = await GSTComplianceService.generateBASReport(
      session.user.id,
      validatedData.taxPeriod
    );

    return res.status(200).json({
      success: true,
      data: {
        report,
        message: 'BAS report generated successfully',
        taxPeriod: validatedData.taxPeriod,
      },
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Error generating BAS report:', error);
    return res.status(500).json({
      error: 'Failed to generate BAS report',
    });
  }
}