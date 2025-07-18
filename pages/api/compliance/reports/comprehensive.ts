import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  APRAComplianceService, 
  GSTComplianceService,
  PrivacyComplianceService 
} from '@/lib/services/compliance';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schema
const reportSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  includeAML: z.boolean().default(true),
  includePrivacy: z.boolean().default(true),
  includeAPRA: z.boolean().default(true),
  includeGST: z.boolean().default(true),
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

  // Only admin can generate comprehensive reports
  if (session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  try {
    const validatedData = reportSchema.parse(req.body);
    const startDate = new Date(validatedData.startDate);
    const endDate = new Date(validatedData.endDate);

    const report: any = {
      reportPeriod: { startDate, endDate },
      generatedAt: new Date(),
      generatedBy: session.user.id,
    };

    // AML/CTF Compliance
    if (validatedData.includeAML) {
      const amlMonitoring = await prisma.aMLTransactionMonitoring.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      report.amlCompliance = {
        totalAlerts: amlMonitoring.length,
        highRiskAlerts: amlMonitoring.filter(m => m.riskScore.toNumber() >= 0.75).length,
        pendingReview: amlMonitoring.filter(m => m.requiresReview && !m.reviewedAt).length,
        reportedToAUSTRAC: amlMonitoring.filter(m => m.reportedToAUSTRAC).length,
        falsePositives: amlMonitoring.filter(m => m.falsePositive).length,
        averageRiskScore: amlMonitoring.reduce((sum, m) => sum + m.riskScore.toNumber(), 0) / amlMonitoring.length || 0,
      };
    }

    // Privacy Act Compliance
    if (validatedData.includePrivacy) {
      const consents = await prisma.privacyConsent.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const dataRequests = await prisma.dataAccessRequest.findMany({
        where: {
          requestDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Expire old consents
      const expiredCount = await PrivacyComplianceService.expireOldConsents();

      report.privacyCompliance = {
        newConsents: consents,
        expiredConsents: expiredCount,
        dataAccessRequests: dataRequests.length,
        pendingRequests: dataRequests.filter(r => r.requestStatus === 'PENDING').length,
        completedRequests: dataRequests.filter(r => r.requestStatus === 'COMPLETED').length,
        averageProcessingTime: this.calculateAverageProcessingTime(dataRequests),
      };
    }

    // APRA Compliance
    if (validatedData.includeAPRA) {
      const apraReport = await APRAComplianceService.generateComplianceReport(startDate, endDate);
      report.apraCompliance = apraReport;
    }

    // GST Compliance
    if (validatedData.includeGST) {
      const gstTransactions = await prisma.gSTTransactionDetail.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const gstTotal = await prisma.gSTTransactionDetail.aggregate({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: {
          gstAmount: true,
        },
      });

      report.gstCompliance = {
        totalTransactions: gstTransactions,
        totalGSTCollected: gstTotal._sum.gstAmount?.toNumber() || 0,
        complianceCheck: await GSTComplianceService.checkCompliance(session.user.id),
      };
    }

    // Save report generation audit
    await prisma.financialAuditLog.create({
      data: {
        userId: session.user.id,
        operationType: 'COMPLIANCE_REPORT_GENERATED',
        resourceType: 'COMPLIANCE_REPORT',
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || '127.0.0.1',
        currentData: {
          reportType: 'COMPREHENSIVE',
          period: { startDate, endDate },
          includedSections: {
            aml: validatedData.includeAML,
            privacy: validatedData.includePrivacy,
            apra: validatedData.includeAPRA,
            gst: validatedData.includeGST,
          },
        },
        success: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: report,
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Error generating compliance report:', error);
    return res.status(500).json({
      error: 'Failed to generate compliance report',
    });
  }
}

function calculateAverageProcessingTime(requests: any[]): number {
  const completedRequests = requests.filter(r => r.completedAt);
  if (completedRequests.length === 0) return 0;

  const totalTime = completedRequests.reduce((sum, request) => {
    const processingTime = request.completedAt.getTime() - request.requestDate.getTime();
    return sum + processingTime;
  }, 0);

  return totalTime / completedRequests.length / (1000 * 60 * 60 * 24); // Convert to days
}