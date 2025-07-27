import { NextApiRequest, NextApiResponse } from 'next';
import { createMocks, RequestMethod } from 'node-mocks-http';

export type ApiRequest = NextApiRequest & ReturnType<typeof createMocks>['req'];
export type ApiResponse = NextApiResponse & ReturnType<typeof createMocks>['res'];

// Helper to create mock API request/response
export function createMockApiContext(
  method: RequestMethod = 'GET',
  body?: any,
  query?: any,
  headers?: any,
) {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method,
    body,
    query,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  return { req: req as ApiRequest, res: res as ApiResponse };
}

// Mock authenticated request
export function createAuthenticatedRequest(
  userId: string,
  method: RequestMethod = 'GET',
  body?: any,
  query?: any,
) {
  return createMockApiContext(method, body, query, {
    authorization: `Bearer mock-token-${userId}`,
  });
}

// Common API response assertions
export const apiAssertions = {
  expectSuccess: (res: ApiResponse, statusCode = 200) => {
    expect(res.statusCode).toBe(statusCode);
    const data = res._getJSONData();
    expect(data).toBeDefined();
    return data;
  },

  expectError: (res: ApiResponse, statusCode: number, message?: string) => {
    expect(res.statusCode).toBe(statusCode);
    const data = res._getJSONData();
    expect(data.error).toBeDefined();
    if (message) {
      expect(data.error).toContain(message);
    }
    return data;
  },

  expectValidationError: (res: ApiResponse, field?: string) => {
    expect(res.statusCode).toBe(400);
    const data = res._getJSONData();
    expect(data.error).toBeDefined();
    if (field) {
      expect(data.errors).toBeDefined();
      expect(data.errors[field]).toBeDefined();
    }
    return data;
  },

  expectUnauthorized: (res: ApiResponse) => {
    expect(res.statusCode).toBe(401);
    const data = res._getJSONData();
    expect(data.error).toContain('Unauthorized');
    return data;
  },

  expectForbidden: (res: ApiResponse) => {
    expect(res.statusCode).toBe(403);
    const data = res._getJSONData();
    expect(data.error).toContain('Forbidden');
    return data;
  },
};
