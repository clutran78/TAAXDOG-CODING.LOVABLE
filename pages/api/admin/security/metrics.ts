import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/db/unifiedMonitoredPrisma';
import { subHours, subDays } from 'date-fns';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Calculate metrics
    const now = new Date();
    const oneHourAgo = subHours(now, 1);
    const oneDayAgo = subDays(now, 1);
    const oneWeekAgo = subDays(now, 7);

    // Get failed login attempts
    const failedLogins = await prisma.auditLog.count({
      where: {
        action: 'login.failed',
        createdAt: { gte: oneHourAgo }
      }
    });

    // Get suspicious activities
    const suspiciousActivities = await prisma.auditLog.count({
      where: {
        OR: [
          { action: { contains: 'suspicious' } },
          { action: { contains: 'denied' } },
          { action: { contains: 'blocked' } }
        ],
        createdAt: { gte: oneHourAgo }
      }
    });

    // Get recent security events
    const recentEvents = await prisma.auditLog.findMany({
      where: {
        OR: [
          { action: { contains: 'security' } },
          { action: { contains: 'login' } },
          { action: { contains: 'denied' } },
          { action: { contains: 'export' } }
        ],
        createdAt: { gte: oneHourAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        action: true,
        userId: true,
        ipAddress: true,
        details: true,
        createdAt: true
      }
    });

    // Calculate vulnerabilities (mock data for now)
    const vulnerabilities = {
      critical: 0,
      high: 0,
      medium: 2,
      low: 5
    };

    // Check for users without 2FA (vulnerability)
    const usersWithout2FA = await prisma.user.count({
      where: {
        twoFactorEnabled: false,
        role: { in: ['ADMIN', 'ACCOUNTANT'] }
      }
    });

    if (usersWithout2FA > 0) {
      vulnerabilities.high += 1;
    }

    // Check for old sessions
    const oldSessions = await prisma.session.count({
      where: {
        createdAt: { lt: subDays(now, 30) },
        expires: { gt: now }
      }
    });

    if (oldSessions > 0) {
      vulnerabilities.medium += 1;
    }

    // Calculate active threats
    const activeThreats = await prisma.auditLog.count({
      where: {
        action: { contains: 'threat' },
        createdAt: { gte: oneDayAgo }
      }
    });

    // Calculate security score
    let securityScore = 100;
    securityScore -= vulnerabilities.critical * 20;
    securityScore -= vulnerabilities.high * 10;
    securityScore -= vulnerabilities.medium * 5;
    securityScore -= vulnerabilities.low * 2;
    securityScore -= Math.min(failedLogins * 2, 20);
    securityScore -= Math.min(suspiciousActivities * 3, 30);
    securityScore = Math.max(securityScore, 0);

    // Determine overall status
    let overallStatus: 'secure' | 'at_risk' | 'vulnerable';
    if (securityScore >= 90) {
      overallStatus = 'secure';
    } else if (securityScore >= 70) {
      overallStatus = 'at_risk';
    } else {
      overallStatus = 'vulnerable';
    }

    // Get compliance scores (mock data)
    const compliance = [
      {
        framework: 'Australian Privacy Act',
        score: 92,
        status: 'compliant'
      },
      {
        framework: 'Financial Security',
        score: 88,
        status: 'compliant'
      },
      {
        framework: 'Data Residency',
        score: 100,
        status: 'compliant'
      }
    ];

    // Generate recommendations
    const recommendations = [];
    
    if (usersWithout2FA > 0) {
      recommendations.push(`Enable 2FA for ${usersWithout2FA} privileged users`);
    }
    
    if (failedLogins > 10) {
      recommendations.push('Investigate high number of failed login attempts');
    }
    
    if (suspiciousActivities > 5) {
      recommendations.push('Review and address suspicious activities');
    }
    
    if (oldSessions > 0) {
      recommendations.push(`Clean up ${oldSessions} expired sessions`);
    }
    
    if (vulnerabilities.critical > 0) {
      recommendations.push('Address critical vulnerabilities immediately');
    }

    // Format recent events
    const formattedEvents = recentEvents.map(event => ({
      id: event.id,
      timestamp: event.createdAt.toISOString(),
      type: event.action.split('.')[0],
      severity: determineSeverity(event.action),
      description: formatEventDescription(event.action, event.details as any),
      user: event.userId,
      ipAddress: event.ipAddress
    }));

    const metrics = {
      timestamp: now.toISOString(),
      overallStatus,
      securityScore,
      activeThreats,
      failedLogins,
      suspiciousActivities,
      vulnerabilities,
      recentEvents: formattedEvents,
      compliance,
      recommendations
    };

    res.status(200).json(metrics);
  } catch (error) {
    console.error('Error fetching security metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function determineSeverity(action: string): string {
  if (action.includes('critical') || action.includes('breach')) return 'critical';
  if (action.includes('failed') || action.includes('denied')) return 'high';
  if (action.includes('warning') || action.includes('suspicious')) return 'medium';
  return 'low';
}

function formatEventDescription(action: string, details: any): string {
  const actionParts = action.split('.');
  
  switch (actionParts[0]) {
    case 'login':
      if (actionParts[1] === 'failed') {
        return `Failed login attempt${details?.email ? ` for ${details.email}` : ''}`;
      }
      if (actionParts[1] === 'success') {
        return `Successful login${details?.newLocation ? ' from new location' : ''}`;
      }
      break;
    case 'access':
      if (actionParts[1] === 'denied') {
        return `Access denied to ${details?.resource || 'resource'}`;
      }
      break;
    case 'data':
      if (actionParts[1] === 'export') {
        return `Data export: ${details?.recordCount || 0} records`;
      }
      break;
    case 'security':
      return details?.description || 'Security event detected';
  }
  
  return action.replace(/\./g, ' ').replace(/_/g, ' ');
}