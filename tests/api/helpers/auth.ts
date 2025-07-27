import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import jwt from 'jsonwebtoken';
import { mockData } from '../fixtures/mockData';

/**
 * Mock NextAuth session for testing
 */
export function mockSession(user: any = mockData.users.regular) {
  const session = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'USER',
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  // Mock getServerSession to return our session
  (getServerSession as jest.Mock).mockResolvedValue(session);

  return session;
}

/**
 * Mock no session (unauthenticated)
 */
export function mockNoSession() {
  (getServerSession as jest.Mock).mockResolvedValue(null);
}

/**
 * Create authenticated request object
 */
export function createAuthenticatedRequest(
  method: string = 'GET',
  body?: any,
  query?: any,
  headers?: any,
  user: any = mockData.users.regular,
): NextApiRequest {
  const req = createMockRequest(method, body, query, headers);

  // Add authenticated user info
  (req as any).userId = user.id;
  (req as any).userRole = user.role || 'USER';
  (req as any).session = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'USER',
    },
  };

  return req;
}

/**
 * Create mock request object
 */
export function createMockRequest(
  method: string = 'GET',
  body?: any,
  query?: any,
  headers?: any,
): NextApiRequest {
  return {
    method,
    body: body || {},
    query: query || {},
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Jest Test Agent',
      ...headers,
    },
    cookies: {},
    env: {},
  } as unknown as NextApiRequest;
}

/**
 * Create mock response object
 */
export function createMockResponse(): NextApiResponse & {
  _getStatusCode: () => number;
  _getData: () => any;
  _getHeaders: () => any;
} {
  let statusCode = 200;
  let data: any = null;
  let headers: Record<string, string> = {};

  const res = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (payload: any) => {
      data = payload;
      return res;
    },
    send: (payload: any) => {
      data = payload;
      return res;
    },
    end: () => res,
    setHeader: (key: string, value: string) => {
      headers[key.toLowerCase()] = value;
      return res;
    },
    getHeader: (key: string) => headers[key.toLowerCase()],
    removeHeader: (key: string) => {
      delete headers[key.toLowerCase()];
      return res;
    },
    writeHead: (code: number, h?: any) => {
      statusCode = code;
      if (h) {
        headers = { ...headers, ...h };
      }
      return res;
    },
    // Test helpers
    _getStatusCode: () => statusCode,
    _getData: () => data,
    _getHeaders: () => headers,
  } as any;

  return res;
}

/**
 * Generate JWT token for testing
 */
export function generateTestToken(payload: any = {}, expiresIn: string = '1h'): string {
  const secret = process.env.NEXTAUTH_SECRET || 'test-secret';
  return jwt.sign(
    {
      sub: payload.userId || mockData.users.regular.id,
      email: payload.email || mockData.users.regular.email,
      role: payload.role || 'USER',
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    { expiresIn },
  );
}

/**
 * Test different authentication scenarios
 */
export const authScenarios = {
  authenticated: () => mockSession(mockData.users.regular),
  admin: () => mockSession(mockData.users.admin),
  business: () => mockSession(mockData.users.business),
  unauthenticated: () => mockNoSession(),
  suspended: () => mockSession(mockData.users.suspended),
};

/**
 * Helper to test authentication requirement
 */
export async function testAuthRequired(handler: Function, method: string = 'GET'): Promise<void> {
  mockNoSession();
  const req = createMockRequest(method);
  const res = createMockResponse();

  await handler(req, res);

  expect(res._getStatusCode()).toBe(401);
  expect(res._getData()).toMatchObject({
    error: expect.stringContaining('Unauthorized'),
  });
}

/**
 * Helper to test role-based access
 */
export async function testRoleRequired(
  handler: Function,
  requiredRole: string,
  method: string = 'GET',
): Promise<void> {
  // Test with regular user (insufficient role)
  mockSession(mockData.users.regular);
  const req = createAuthenticatedRequest(method, null, null, null, mockData.users.regular);
  const res = createMockResponse();

  await handler(req, res);

  expect(res._getStatusCode()).toBe(403);
  expect(res._getData()).toMatchObject({
    error: expect.stringContaining('Forbidden'),
  });
}

/**
 * Helper to test rate limiting
 */
export async function testRateLimit(handler: Function, maxRequests: number = 10): Promise<void> {
  mockSession();

  // Make requests up to the limit
  for (let i = 0; i < maxRequests; i++) {
    const req = createAuthenticatedRequest();
    const res = createMockResponse();
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
  }

  // Next request should be rate limited
  const req = createAuthenticatedRequest();
  const res = createMockResponse();
  await handler(req, res);

  expect(res._getStatusCode()).toBe(429);
  expect(res._getData()).toMatchObject({
    error: expect.stringContaining('Too many requests'),
  });
}
