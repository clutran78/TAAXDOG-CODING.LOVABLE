import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateMonthlyComplianceReport } from '@/lib/services/auditReports';
import { z } from 'zod';

// Validation schema
const monthlyReportSchema = z.object({
  year: z.number().min(2020).max(2100),
  month: z.number().min(1).max(12)
});

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
  
  // Check if user has admin role
  if (session.user.role !== 'ADMIN' && session.user.role !== 'ACCOUNTANT') {
    return res.status(403).json({ error: 'Forbidden: Admin or Accountant access required' });
  }
  
  try {
    // Validate query parameters
    const validatedData = monthlyReportSchema.parse({
      year: parseInt(req.query.year as string),
      month: parseInt(req.query.month as string)
    });
    
    // Generate the monthly compliance report
    const report = await generateMonthlyComplianceReport(
      validatedData.year,
      validatedData.month
    );
    
    return res.status(200).json({
      success: true,
      data: report
    });
    
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    
    console.error('Monthly compliance report error:', error);
    return res.status(500).json({
      error: 'Failed to generate monthly compliance report'
    });
  }
}