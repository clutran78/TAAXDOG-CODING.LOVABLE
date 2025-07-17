import type { NextApiRequest, NextApiResponse } from "next";
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { getServerSession } from "next-auth";
import { authOptions, logAuthEvent } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  switch (req.method) {
    case "GET":
      return getSessions(req, res, session.user.id);
    case "DELETE":
      return revokeSessions(req, res, session.user.id);
    default:
      return res.status(405).json({ message: "Method not allowed" });
  }
}

// Get all active sessions
async function getSessions(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    // Get all sessions for the user
    const sessions = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.session.findMany({
      where: {
        userId,
        expires: { gt: new Date();
    }) }, // Only active sessions
      },
      select: {
        id: true,
        sessionToken: true,
        expires: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get recent login history from audit logs
    const recentLogins = await req.rlsContext.execute(async () => {
      return await req.rlsContext.execute(async () => {
      return await prismaWithRLS.auditLog.findMany({
      where: {
        userId,
        event: 'LOGIN_SUCCESS',
        createdAt: { gt: new Date(Date.now();
    });
    }) - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    // Parse user agents for better display
    const sessionsWithDetails = sessions.map(session => {
      const isCurrentSession = req.cookies['next-auth.session-token'] === session.sessionToken ||
                              req.cookies['__Secure-next-auth.session-token'] === session.sessionToken;
      
      return {
        id: session.id,
        expires: session.expires,
        createdAt: session.createdAt,
        isCurrent: isCurrentSession,
      };
    });

    const loginHistory = recentLogins.map(login => {
      const userAgent = login.userAgent || '';
      const device = getDeviceFromUserAgent(userAgent);
      const browser = getBrowserFromUserAgent(userAgent);
      
      return {
        id: login.id,
        ipAddress: login.ipAddress,
        device,
        browser,
        location: 'Australia', // In production, use IP geolocation
        timestamp: login.createdAt,
      };
    });

    res.status(200).json({
      activeSessions: sessionsWithDetails,
      loginHistory,
      sessionCount: sessions.length,
    });
  } catch (error) {
    console.error("Get sessions error:", error);
    res.status(500).json({ message: "Failed to retrieve sessions" });
  }
}

// Revoke sessions
async function revokeSessions(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const { sessionId, revokeAll } = req.body;

    if (revokeAll) {
      // Revoke all sessions except current
      const currentToken = req.cookies['next-auth.session-token'] || 
                          req.cookies['__Secure-next-auth.session-token'];
      
      await req.rlsContext.execute(async () => {
      return await prismaWithRLS.session.deleteMany({
        where: {
          userId,
          sessionToken: { not: currentToken || '' },
        },
      });
    });

      await logAuthEvent({
        event: "SESSION_EXPIRED",
        userId,
        success: true,
        metadata: {
          action: "revoke_all_sessions",
          excludedCurrent: true,
        },
        req,
      });

      return res.status(200).json({
        message: "All other sessions have been revoked",
        revokedCount: -1, // Indicates all sessions
      });
    }

    if (sessionId) {
      // Revoke specific session
      const session = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.session.findFirst({
        where: {
          id: sessionId,
          userId,
        },
      });
    });

      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Don't allow revoking current session
      const currentToken = req.cookies['next-auth.session-token'] || 
                          req.cookies['__Secure-next-auth.session-token'];
      
      if (session.sessionToken === currentToken) {
        return res.status(400).json({ 
          message: "Cannot revoke current session. Use logout instead." 
        });
      }

      await req.rlsContext.execute(async () => {
      return await prismaWithRLS.session.delete({
        where: { id: sessionId },
      });
    });

      await logAuthEvent({
        event: "SESSION_EXPIRED",
        userId,
        success: true,
        metadata: {
          action: "revoke_session",
          sessionId,
        },
        req,
      });

      return res.status(200).json({
        message: "Session revoked successfully",
        revokedSessionId: sessionId,
      });
    }

    return res.status(400).json({ message: "No session specified to revoke" });
  } catch (error) {
    console.error("Revoke sessions error:", error);
    res.status(500).json({ message: "Failed to revoke sessions" });
  }
}

// Helper functions
function getDeviceFromUserAgent(userAgent: string): string {
  if (/mobile/i.test(userAgent)) {
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS Device';
    if (/android/i.test(userAgent)) return 'Android Device';
    return 'Mobile Device';
  }
  if (/tablet/i.test(userAgent)) return 'Tablet';
  if (/macintosh/i.test(userAgent)) return 'Mac';
  if (/windows/i.test(userAgent)) return 'Windows PC';
  if (/linux/i.test(userAgent)) return 'Linux';
  return 'Unknown Device';
}

function getBrowserFromUserAgent(userAgent: string): string {
  if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) return 'Chrome';
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
  if (/firefox/i.test(userAgent)) return 'Firefox';
  if (/edg/i.test(userAgent)) return 'Edge';
  if (/opera|opr/i.test(userAgent)) return 'Opera';
  return 'Unknown Browser';
}

// Security check endpoint - check for suspicious activity
export async function checkSecurity(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const userId = session.user.id;
    
    // Check for suspicious activities
    const suspiciousActivities = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.auditLog.findMany({
      where: {
        userId,
        event: 'SUSPICIOUS_ACTIVITY',
        createdAt: { gt: new Date(Date.now();
    }) - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      },
      select: {
        id: true,
        ipAddress: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Check for failed login attempts
    const failedLogins = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.auditLog.count({
      where: {
        userId,
        event: 'LOGIN_FAILED',
        createdAt: { gt: new Date(Date.now();
    }) - 24 * 60 * 60 * 1000) }, // Last 24 hours
      },
    });

    // Check for new device logins
    const recentNewDevices = await prismaWithRLS.auditLog.findMany({
      where: {
        userId,
        event: 'LOGIN_SUCCESS',
        createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: {
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
      distinct: ['ipAddress'],
      orderBy: {
        createdAt: 'desc',
      },
    });

    const securityStatus = {
      suspicious: suspiciousActivities.length > 0,
      failedLoginAttempts: failedLogins,
      newDevices: recentNewDevices.length,
      recommendations: [] as string[],
    };

    // Add recommendations
    if (failedLogins > 5) {
      securityStatus.recommendations.push("Multiple failed login attempts detected. Consider changing your password.");
    }

    if (recentNewDevices.length > 3) {
      securityStatus.recommendations.push("Multiple new devices detected. Review your active sessions.");
    }

    const user = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    });

    if (!user?.twoFactorEnabled) {
      securityStatus.recommendations.push("Enable two-factor authentication for enhanced security.");
    }

    res.status(200).json({
      securityStatus,
      suspiciousActivities: suspiciousActivities.map(activity => ({
        id: activity.id,
        type: activity.metadata?.type || 'Unknown',
        ipAddress: activity.ipAddress,
        timestamp: activity.createdAt,
      })),
    });
  } catch (error) {
    console.error("Security check error:", error);
    res.status(500).json({ message: "Failed to check security status" });
  }
}