import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateAuditReport, exportAuditReportToCSV } from '@/lib/services/auditReports';
import { z } from 'zod';
import { FinancialOperation } from '@prisma/client';

// Validation schema
const generateReportSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  userId: z.string().uuid().optional(),
  operationType: z.nativeEnum(FinancialOperation).optional(),
  resourceType: z.string().optional(),
  success: z.boolean().optional(),
  includeDetails: z.boolean().optional(),
  format: z.enum(['json', 'csv']).optional().default('json')
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
  
  // Check if user has admin role
  if (session.user.role !== 'ADMIN' && session.user.role !== 'ACCOUNTANT') {
    return res.status(403).json({ error: 'Forbidden: Admin or Accountant access required' });
  }
  
  try {
    // Validate request body
    const validatedData = generateReportSchema.parse(req.body);
    
    // Generate the report
    const report = await generateAuditReport({
      startDate: new Date(validatedData.startDate),
      endDate: new Date(validatedData.endDate),
      userId: validatedData.userId,
      operationType: validatedData.operationType,
      resourceType: validatedData.resourceType,
      success: validatedData.success,
      includeDetails: validatedData.includeDetails
    });
    
    // Return in requested format
    if (validatedData.format === 'csv') {
      const csv = exportAuditReportToCSV(report.entries);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 
        `attachment; filename=audit-report-${new Date().toISOString().split('T')[0]}.csv`);
      
      return res.status(200).send(csv);
    }
    
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
    
    console.error('Audit report generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate audit report'
    });
  }
}