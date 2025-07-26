import { NextApiRequest, NextApiResponse } from 'next';
import { createMocks, RequestMethod, MockRequest, MockResponse } from 'node-mocks-http';
import { Session } from 'next-auth';
import jwt from 'jsonwebtoken';

export interface ApiTestContext {
  req: MockRequest<NextApiRequest>;
  res: MockResponse<NextApiResponse>;
}

export interface ApiTestOptions {
  method?: RequestMethod;
  headers?: Record<string, string>;
  query?: Record<string, string | string[]>;
  body?: any;
  session?: Session | null;
  cookies?: Record<string, string>;
}

export class ApiTestHelper {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create mock API context for testing
   */
  createContext(options: ApiTestOptions = {}): ApiTestContext {
    const {
      method = 'GET',
      headers = {},
      query = {},
      body = {},
      session = null,
      cookies = {},
    } = options;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method,
      headers: { ...this.defaultHeaders, ...headers },
      query,
      body,
      cookies,
    });

    // Add session to request if provided
    if (session) {
      (req as any).session = session;
    }

    return { req, res };
  }

  /**
   * Create authenticated context with JWT token
   */
  createAuthenticatedContext(userId: string, options: ApiTestOptions = {}): ApiTestContext {
    const token = this.generateTestToken(userId);

    return this.createContext({
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
      session: {
        user: {
          id: userId,
          email: `user-${userId}@example.com`,
          name: `User ${userId}`,
          role: 'USER',
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  }

  /**
   * Generate test JWT token
   */
  generateTestToken(userId: string, expiresIn = '1h'): string {
    const secret = process.env.NEXTAUTH_SECRET || 'test-secret';

    return jwt.sign(
      {
        sub: userId,
        email: `user-${userId}@example.com`,
        role: 'USER',
        iat: Math.floor(Date.now() / 1000),
      },
      secret,
      { expiresIn },
    );
  }

  /**
   * Make API request and return parsed response
   */
  async makeRequest<T = any>(
    handler: Function,
    options: ApiTestOptions = {},
  ): Promise<{
    status: number;
    data: T;
    headers: Record<string, string | string[]>;
  }> {
    const { req, res } = this.createContext(options);

    await handler(req, res);

    const data = res._getJSONData();
    const status = res._getStatusCode();
    const headers = res._getHeaders();

    return { status, data, headers };
  }

  /**
   * Make authenticated API request
   */
  async makeAuthenticatedRequest<T = any>(
    handler: Function,
    userId: string,
    options: ApiTestOptions = {},
  ): Promise<{
    status: number;
    data: T;
    headers: Record<string, string | string[]>;
  }> {
    const { req, res } = this.createAuthenticatedContext(userId, options);

    await handler(req, res);

    const data = res._getJSONData();
    const status = res._getStatusCode();
    const headers = res._getHeaders();

    return { status, data, headers };
  }

  /**
   * Assert successful response
   */
  expectSuccess<T = any>(response: { status: number; data: any }, expectedStatus = 200): T {
    expect(response.status).toBe(expectedStatus);
    expect(response.data).toBeDefined();
    expect(response.data.error).toBeUndefined();
    return response.data as T;
  }

  /**
   * Assert error response
   */
  expectError(
    response: { status: number; data: any },
    expectedStatus: number,
    expectedMessage?: string,
  ): void {
    expect(response.status).toBe(expectedStatus);
    expect(response.data.error).toBeDefined();

    if (expectedMessage) {
      expect(response.data.error).toContain(expectedMessage);
    }
  }

  /**
   * Assert validation error
   */
  expectValidationError(response: { status: number; data: any }, field?: string): void {
    expect(response.status).toBe(400);
    expect(response.data.error).toBeDefined();

    if (field && response.data.errors) {
      expect(response.data.errors[field]).toBeDefined();
    }
  }

  /**
   * Assert unauthorized response
   */
  expectUnauthorized(response: { status: number; data: any }): void {
    expect(response.status).toBe(401);
    expect(response.data.error).toContain('Unauthorized');
  }

  /**
   * Assert forbidden response
   */
  expectForbidden(response: { status: number; data: any }): void {
    expect(response.status).toBe(403);
    expect(response.data.error).toContain('Forbidden');
  }

  /**
   * Create multipart form data for file uploads
   */
  createFormData(fields: Record<string, any>, files?: Record<string, Buffer>): any {
    const FormData = require('form-data');
    const form = new FormData();

    // Add fields
    Object.entries(fields).forEach(([key, value]) => {
      form.append(key, value);
    });

    // Add files
    if (files) {
      Object.entries(files).forEach(([fieldName, buffer]) => {
        form.append(fieldName, buffer, {
          filename: `test-${fieldName}.jpg`,
          contentType: 'image/jpeg',
        });
      });
    }

    return form;
  }

  /**
   * Simulate webhook request
   */
  createWebhookContext(
    payload: any,
    signature: string,
    options: ApiTestOptions = {},
  ): ApiTestContext {
    return this.createContext({
      ...options,
      method: 'POST',
      headers: {
        ...options.headers,
        'stripe-signature': signature,
        'content-type': 'application/json',
      },
      body: payload,
    });
  }

  /**
   * Wait for async operations
   */
  async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error('Timeout waiting for condition');
  }
}

// Export singleton instance
export const apiTest = new ApiTestHelper();

// Export convenience functions
export const createApiContext = (options?: ApiTestOptions) => apiTest.createContext(options);

export const createAuthenticatedApiContext = (userId: string, options?: ApiTestOptions) =>
  apiTest.createAuthenticatedContext(userId, options);

export const makeApiRequest = <T = any>(handler: Function, options?: ApiTestOptions) =>
  apiTest.makeRequest<T>(handler, options);

export const makeAuthenticatedApiRequest = <T = any>(
  handler: Function,
  userId: string,
  options?: ApiTestOptions,
) => apiTest.makeAuthenticatedRequest<T>(handler, userId, options);
