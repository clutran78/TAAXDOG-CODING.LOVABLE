import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { getClientIP } from './auth-utils';
import { AuthEvent, Role } from '@prisma/client';
import type { Session } from 'next-auth';
import { addDays, addHours, addMinutes, differenceInMinutes } from 'date-fns';

// Session configuration constants
const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const SESSION_ABSOLUTE_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry
const SESSION_WARNING_THRESHOLD = 2 * 60 * 1000; // 2 minutes warning
const MAX_CONCURRENT_SESSIONS = 5; // Maximum sessions per user
const SUSPICIOUS_ACTIVITY_THRESHOLD = 10; // Failed attempts before flagging

// Session types
export enum SessionType {
  WEB = 'WEB',
  MOBILE = 'MOBILE',
  API = 'API',
  ADMIN = 'ADMIN',
}

// Session status
export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  IDLE = 'IDLE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
  LOCKED = 'LOCKED',
}

// Session activity types
export enum SessionActivity {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  REFRESH = 'REFRESH',
  ACTIVITY = 'ACTIVITY',
  TIMEOUT = 'TIMEOUT',
  SECURITY_LOCKOUT = 'SECURITY_LOCKOUT',
}

// Session data interface
export interface SessionData {
  id: string;
  userId: string;
  sessionToken: string;
  type: SessionType;
  status: SessionStatus;
  ipAddress: string;
  userAgent: string;
  deviceInfo?: {
    browser?: string;
    os?: string;
    device?: string;
  };
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  refreshToken?: string;
  refreshExpiresAt?: Date;
  metadata?: Record<string, any>;
}

// Session activity log interface
export interface SessionActivityLog {
  sessionId: string;
  activity: SessionActivity;
  timestamp: Date;
  ipAddress: string;
  details?: Record<string, any>;
}

// Session manager class
export class SessionManager {
  private static instance: SessionManager;
  private activeSessions: Map<string, SessionData> = new Map();
  private sessionTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    // Initialize session cleanup interval
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 1000); // Run every minute
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // Create new session
  public async createSession(
    userId: string,
    req: NextApiRequest,
    options: {
      type?: SessionType;
      rememberMe?: boolean;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<SessionData> {
    const sessionId = crypto.randomUUID();
    const sessionToken = this.generateSessionToken();
    const ipAddress = getClientIP(req) || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Check concurrent sessions
    await this.enforceSessionLimits(userId);

    // Calculate expiry times
    const now = new Date();
    const expiresAt = options.rememberMe
      ? addDays(now, 30) // 30 days for "remember me"
      : addHours(now, 8); // 8 hours default

    const sessionData: SessionData = {
      id: sessionId,
      userId,
      sessionToken,
      type: options.type || SessionType.WEB,
      status: SessionStatus.ACTIVE,
      ipAddress,
      userAgent,
      deviceInfo: this.parseUserAgent(userAgent),
      createdAt: now,
      lastActivityAt: now,
      expiresAt,
      metadata: options.metadata,
    };

    // Generate refresh token if needed
    if (options.type === SessionType.API || options.rememberMe) {
      sessionData.refreshToken = this.generateRefreshToken();
      sessionData.refreshExpiresAt = addDays(now, 30);
    }

    // Store session in database
    await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        sessionToken,
        expires: expiresAt,
        data: JSON.stringify({
          type: sessionData.type,
          status: sessionData.status,
          ipAddress,
          userAgent,
          deviceInfo: sessionData.deviceInfo,
          metadata: sessionData.metadata,
        }),
      },
    });

    // Store in memory cache
    this.activeSessions.set(sessionId, sessionData);

    // Set up session timer
    this.setupSessionTimer(sessionId);

    // Log session creation
    await this.logSessionActivity(sessionId, SessionActivity.LOGIN, ipAddress, {
      type: sessionData.type,
      rememberMe: options.rememberMe,
    });

    logger.info('Session created', {
      sessionId,
      userId,
      type: sessionData.type,
      ipAddress,
    });

    return sessionData;
  }

  // Get session by ID
  public async getSession(sessionId: string): Promise<SessionData | null> {
    // Check memory cache first
    let session = this.activeSessions.get(sessionId);

    if (!session) {
      // Load from database
      const dbSession = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: true },
      });

      if (!dbSession) {
        return null;
      }

      // Parse session data
      const data = JSON.parse(dbSession.data || '{}');
      session = {
        id: dbSession.id,
        userId: dbSession.userId,
        sessionToken: dbSession.sessionToken,
        type: data.type || SessionType.WEB,
        status: data.status || SessionStatus.ACTIVE,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        deviceInfo: data.deviceInfo,
        createdAt: dbSession.createdAt,
        lastActivityAt: data.lastActivityAt || dbSession.createdAt,
        expiresAt: dbSession.expires,
        refreshToken: data.refreshToken,
        refreshExpiresAt: data.refreshExpiresAt ? new Date(data.refreshExpiresAt) : undefined,
        metadata: data.metadata,
      };

      // Cache it
      this.activeSessions.set(sessionId, session);
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      await this.terminateSession(sessionId, SessionActivity.TIMEOUT);
      return null;
    }

    // Check idle timeout
    const idleTime = Date.now() - session.lastActivityAt.getTime();
    if (idleTime > SESSION_IDLE_TIMEOUT) {
      session.status = SessionStatus.IDLE;
    }

    return session;
  }

  // Update session activity
  public async updateSessionActivity(sessionId: string, req: NextApiRequest): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const now = new Date();
    const ipAddress = getClientIP(req) || 'unknown';

    // Check for IP change (potential session hijacking)
    if (session.ipAddress !== ipAddress) {
      logger.warn('Session IP address changed', {
        sessionId,
        originalIP: session.ipAddress,
        newIP: ipAddress,
      });

      // Log suspicious activity
      await this.logSuspiciousActivity(session.userId, 'IP_CHANGE', {
        sessionId,
        originalIP: session.ipAddress,
        newIP: ipAddress,
      });
    }

    // Update session
    session.lastActivityAt = now;
    session.status = SessionStatus.ACTIVE;

    // Update in database
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        data: JSON.stringify({
          ...JSON.parse(
            (await prisma.session.findUnique({ where: { id: sessionId } }))?.data || '{}',
          ),
          lastActivityAt: now,
          status: SessionStatus.ACTIVE,
        }),
      },
    });

    // Update cache
    this.activeSessions.set(sessionId, session);

    // Reset timer
    this.setupSessionTimer(sessionId);

    // Log activity
    await this.logSessionActivity(sessionId, SessionActivity.ACTIVITY, ipAddress);
  }

  // Refresh session
  public async refreshSession(
    sessionId: string,
    refreshToken: string,
    req: NextApiRequest,
  ): Promise<SessionData | null> {
    const session = await this.getSession(sessionId);
    if (!session || !session.refreshToken) {
      return null;
    }

    // Validate refresh token
    if (session.refreshToken !== refreshToken) {
      logger.warn('Invalid refresh token attempt', { sessionId });
      await this.logSuspiciousActivity(session.userId, 'INVALID_REFRESH_TOKEN', { sessionId });
      return null;
    }

    // Check refresh token expiry
    if (session.refreshExpiresAt && session.refreshExpiresAt < new Date()) {
      await this.terminateSession(sessionId, SessionActivity.TIMEOUT);
      return null;
    }

    // Generate new tokens
    const now = new Date();
    session.sessionToken = this.generateSessionToken();
    session.refreshToken = this.generateRefreshToken();
    session.expiresAt = addHours(now, 8);
    session.refreshExpiresAt = addDays(now, 30);
    session.lastActivityAt = now;
    session.status = SessionStatus.ACTIVE;

    // Update database
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        sessionToken: session.sessionToken,
        expires: session.expiresAt,
        data: JSON.stringify({
          ...JSON.parse(
            (await prisma.session.findUnique({ where: { id: sessionId } }))?.data || '{}',
          ),
          refreshToken: session.refreshToken,
          refreshExpiresAt: session.refreshExpiresAt,
          lastActivityAt: now,
          status: SessionStatus.ACTIVE,
        }),
      },
    });

    // Update cache
    this.activeSessions.set(sessionId, session);

    // Reset timer
    this.setupSessionTimer(sessionId);

    // Log refresh
    const ipAddress = getClientIP(req) || 'unknown';
    await this.logSessionActivity(sessionId, SessionActivity.REFRESH, ipAddress);

    logger.info('Session refreshed', { sessionId, userId: session.userId });

    return session;
  }

  // Terminate session
  public async terminateSession(
    sessionId: string,
    reason: SessionActivity = SessionActivity.LOGOUT,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    // Clear timer
    const timer = this.sessionTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.sessionTimers.delete(sessionId);
    }

    // Remove from cache
    this.activeSessions.delete(sessionId);

    // Delete from database
    await prisma.session
      .delete({
        where: { id: sessionId },
      })
      .catch((error) => {
        // Log the error for troubleshooting
        logger.error('Failed to delete session from database', {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Session might already be deleted or other database issues
      });

    // Log termination
    await this.logSessionActivity(sessionId, reason, session.ipAddress, {
      duration: Date.now() - session.createdAt.getTime(),
    });

    logger.info('Session terminated', {
      sessionId,
      userId: session.userId,
      reason,
    });
  }

  // Terminate all user sessions
  public async terminateAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
    const sessions = await prisma.session.findMany({
      where: { userId },
    });

    for (const session of sessions) {
      if (session.id !== exceptSessionId) {
        await this.terminateSession(session.id, SessionActivity.SECURITY_LOCKOUT);
      }
    }

    logger.info('All user sessions terminated', { userId, exceptSessionId });
  }

  // Get user sessions
  public async getUserSessions(userId: string): Promise<SessionData[]> {
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((session) => {
      const data = JSON.parse(session.data || '{}');
      return {
        id: session.id,
        userId: session.userId,
        sessionToken: session.sessionToken,
        type: data.type || SessionType.WEB,
        status: data.status || SessionStatus.ACTIVE,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        deviceInfo: data.deviceInfo,
        createdAt: session.createdAt,
        lastActivityAt: data.lastActivityAt || session.createdAt,
        expiresAt: session.expires,
        metadata: data.metadata,
      };
    });
  }

  // Check if session needs refresh
  public needsRefresh(session: SessionData): boolean {
    const timeToExpiry = session.expiresAt.getTime() - Date.now();
    return timeToExpiry < SESSION_REFRESH_THRESHOLD;
  }

  // Check if session is about to expire
  public isAboutToExpire(session: SessionData): boolean {
    const timeToExpiry = session.expiresAt.getTime() - Date.now();
    return timeToExpiry < SESSION_WARNING_THRESHOLD;
  }

  // Validate session
  public async validateSession(
    sessionToken: string,
    req: NextApiRequest,
  ): Promise<{ valid: boolean; session?: SessionData; error?: string }> {
    try {
      // Find session by token
      const dbSession = await prisma.session.findFirst({
        where: { sessionToken },
        include: { user: true },
      });

      if (!dbSession) {
        return { valid: false, error: 'Session not found' };
      }

      const session = await this.getSession(dbSession.id);
      if (!session) {
        return { valid: false, error: 'Session expired' };
      }

      // Check user status
      if (dbSession.user.lockedUntil && dbSession.user.lockedUntil > new Date()) {
        await this.terminateSession(session.id, SessionActivity.SECURITY_LOCKOUT);
        return { valid: false, error: 'Account locked' };
      }

      // Validate IP if strict mode
      const currentIP = getClientIP(req) || 'unknown';
      if (session.metadata?.strictIPValidation && session.ipAddress !== currentIP) {
        logger.warn('Session IP validation failed', {
          sessionId: session.id,
          expectedIP: session.ipAddress,
          actualIP: currentIP,
        });
        return { valid: false, error: 'IP validation failed' };
      }

      // Update activity
      await this.updateSessionActivity(session.id, req);

      return { valid: true, session };
    } catch (error) {
      logger.error('Session validation error', { error });
      return { valid: false, error: 'Validation error' };
    }
  }

  // Private methods
  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private parseUserAgent(userAgent: string): Record<string, string> {
    // Simple user agent parsing (consider using a library for production)
    const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
    const osMatch = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/);

    return {
      browser: browserMatch?.[1] || 'Unknown',
      os: osMatch?.[1] || 'Unknown',
      device: userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
    };
  }

  private async enforceSessionLimits(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);

    if (sessions.length >= MAX_CONCURRENT_SESSIONS) {
      // Terminate oldest session
      const oldestSession = sessions[sessions.length - 1];
      await this.terminateSession(oldestSession.id, SessionActivity.SECURITY_LOCKOUT);

      logger.info('Session limit enforced', {
        userId,
        terminatedSessionId: oldestSession.id,
      });
    }
  }

  private setupSessionTimer(sessionId: string): void {
    // Clear existing timer
    const existingTimer = this.sessionTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer for idle timeout
    const timer = setTimeout(async () => {
      const session = await this.getSession(sessionId);
      if (session) {
        const idleTime = Date.now() - session.lastActivityAt.getTime();
        if (idleTime >= SESSION_IDLE_TIMEOUT) {
          await this.terminateSession(sessionId, SessionActivity.TIMEOUT);
        }
      }
    }, SESSION_IDLE_TIMEOUT);

    this.sessionTimers.set(sessionId, timer);
  }

  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const expiredSessions = await prisma.session.deleteMany({
        where: {
          expires: {
            lt: new Date(),
          },
        },
      });

      if (expiredSessions.count > 0) {
        logger.info('Expired sessions cleaned up', { count: expiredSessions.count });
      }
    } catch (error) {
      logger.error('Session cleanup error', { error });
    }
  }

  private async logSessionActivity(
    sessionId: string,
    activity: SessionActivity,
    ipAddress: string,
    details?: Record<string, any>,
  ): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) return;

      await prisma.auditLog.create({
        data: {
          event: this.mapActivityToAuthEvent(activity),
          userId: session.userId,
          ipAddress,
          userAgent: session.userAgent,
          success: true,
          metadata: {
            sessionId,
            activity,
            ...details,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to log session activity', { error, sessionId, activity });
    }
  }

  private async logSuspiciousActivity(
    userId: string,
    type: string,
    details: Record<string, any>,
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          event: AuthEvent.SUSPICIOUS_ACTIVITY,
          userId,
          ipAddress: details.ipAddress || 'unknown',
          userAgent: details.userAgent || 'unknown',
          success: false,
          metadata: {
            type,
            ...details,
          },
        },
      });

      // Check if we need to lock the account
      const recentSuspiciousCount = await prisma.auditLog.count({
        where: {
          userId,
          event: AuthEvent.SUSPICIOUS_ACTIVITY,
          createdAt: {
            gte: addHours(new Date(), -1),
          },
        },
      });

      if (recentSuspiciousCount >= SUSPICIOUS_ACTIVITY_THRESHOLD) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            lockedUntil: addHours(new Date(), 24),
          },
        });

        await this.terminateAllUserSessions(userId);

        logger.warn('User account locked due to suspicious activity', {
          userId,
          suspiciousCount: recentSuspiciousCount,
        });
      }
    } catch (error) {
      logger.error('Failed to log suspicious activity', { error, userId, type });
    }
  }

  private mapActivityToAuthEvent(activity: SessionActivity): AuthEvent {
    switch (activity) {
      case SessionActivity.LOGIN:
        return AuthEvent.LOGIN;
      case SessionActivity.LOGOUT:
        return AuthEvent.LOGOUT;
      case SessionActivity.REFRESH:
        return AuthEvent.TOKEN_REFRESH;
      case SessionActivity.TIMEOUT:
        return AuthEvent.SESSION_TIMEOUT;
      case SessionActivity.SECURITY_LOCKOUT:
        return AuthEvent.ACCOUNT_LOCKED;
      default:
        return AuthEvent.SESSION_ACTIVITY;
    }
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();

// Middleware helper
export async function withSessionValidation(
  req: NextApiRequest,
  res: NextApiResponse,
  handler: (session: SessionData) => Promise<void>,
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get detailed session data
  const sessionData = await sessionManager.getSession(session.id);

  if (!sessionData) {
    return res.status(401).json({ error: 'Session expired' });
  }

  // Check if refresh needed
  if (sessionManager.needsRefresh(sessionData)) {
    res.setHeader('X-Session-Refresh-Needed', 'true');
  }

  // Check if about to expire
  if (sessionManager.isAboutToExpire(sessionData)) {
    res.setHeader('X-Session-Expiry-Warning', 'true');
    res.setHeader(
      'X-Session-Expires-In',
      Math.floor((sessionData.expiresAt.getTime() - Date.now()) / 1000).toString(),
    );
  }

  await handler(sessionData);
}
