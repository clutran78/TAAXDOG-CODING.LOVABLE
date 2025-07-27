import { NextApiHandler } from 'next';
import { createMockRequest, createMockResponse } from './auth';

/**
 * Test API endpoint helper
 */
export class ApiTester {
  private handler: NextApiHandler;

  constructor(handler: NextApiHandler) {
    this.handler = handler;
  }

  /**
   * Test GET request
   */
  async get(query?: any, headers?: any) {
    const req = createMockRequest('GET', null, query, headers);
    const res = createMockResponse();
    await this.handler(req, res);
    return {
      status: res._getStatusCode(),
      data: res._getData(),
      headers: res._getHeaders(),
    };
  }

  /**
   * Test POST request
   */
  async post(body?: any, headers?: any) {
    const req = createMockRequest('POST', body, null, headers);
    const res = createMockResponse();
    await this.handler(req, res);
    return {
      status: res._getStatusCode(),
      data: res._getData(),
      headers: res._getHeaders(),
    };
  }

  /**
   * Test PUT request
   */
  async put(body?: any, headers?: any) {
    const req = createMockRequest('PUT', body, null, headers);
    const res = createMockResponse();
    await this.handler(req, res);
    return {
      status: res._getStatusCode(),
      data: res._getData(),
      headers: res._getHeaders(),
    };
  }

  /**
   * Test PATCH request
   */
  async patch(body?: any, query?: any, headers?: any) {
    const req = createMockRequest('PATCH', body, query, headers);
    const res = createMockResponse();
    await this.handler(req, res);
    return {
      status: res._getStatusCode(),
      data: res._getData(),
      headers: res._getHeaders(),
    };
  }

  /**
   * Test DELETE request
   */
  async delete(query?: any, headers?: any) {
    const req = createMockRequest('DELETE', null, query, headers);
    const res = createMockResponse();
    await this.handler(req, res);
    return {
      status: res._getStatusCode(),
      data: res._getData(),
      headers: res._getHeaders(),
    };
  }
}

/**
 * Validate API response structure
 */
export function validateApiResponse(response: any, expectedShape: any) {
  expect(response).toBeDefined();
  expect(response.status).toBeDefined();
  expect(response.data).toBeDefined();

  if (expectedShape) {
    expect(response.data).toMatchObject(expectedShape);
  }
}

/**
 * Validate successful response
 */
export function expectSuccess(response: any, statusCode: number = 200) {
  expect(response.status).toBe(statusCode);
  expect(response.data).toBeDefined();
  if (response.data.success !== undefined) {
    expect(response.data.success).toBe(true);
  }
}

/**
 * Validate error response
 */
export function expectError(response: any, statusCode: number, errorMessage?: string) {
  expect(response.status).toBe(statusCode);
  expect(response.data).toBeDefined();
  expect(response.data.error).toBeDefined();

  if (errorMessage) {
    expect(response.data.error).toContain(errorMessage);
  }
}

/**
 * Validate pagination response
 */
export function expectPagination(response: any, expectedFields: string[] = []) {
  expectSuccess(response);
  expect(response.data.data).toBeDefined();
  expect(response.data.data.pagination).toBeDefined();

  const pagination = response.data.data.pagination;
  expect(pagination).toMatchObject({
    page: expect.any(Number),
    limit: expect.any(Number),
    total: expect.any(Number),
    pages: expect.any(Number),
    hasMore: expect.any(Boolean),
  });

  if (expectedFields.length > 0) {
    expect(response.data.data).toMatchObject(
      expectedFields.reduce((acc, field) => {
        acc[field] = expect.anything();
        return acc;
      }, {}),
    );
  }
}

/**
 * Test CRUD operations for an endpoint
 */
export async function testCrudOperations({
  endpoint,
  createData,
  updateData,
  validateShape,
  beforeEach,
  afterEach,
}: {
  endpoint: string;
  createData: any;
  updateData: any;
  validateShape: any;
  beforeEach?: () => Promise<void>;
  afterEach?: () => Promise<void>;
}) {
  if (beforeEach) await beforeEach();

  let createdId: string;

  // Test CREATE
  describe('CREATE', () => {
    it('should create a new resource', async () => {
      const response = await new ApiTester(require(endpoint).default).post(createData);
      expectSuccess(response, 201);
      expect(response.data.data).toMatchObject(validateShape);
      createdId = response.data.data.id;
      expect(createdId).toBeUUID();
    });

    it('should validate required fields', async () => {
      const response = await new ApiTester(require(endpoint).default).post({});
      expectError(response, 400, 'Validation error');
    });
  });

  // Test READ
  describe('READ', () => {
    it('should get all resources', async () => {
      const response = await new ApiTester(require(endpoint).default).get();
      expectSuccess(response);
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    it('should get a single resource', async () => {
      const response = await new ApiTester(require(`${endpoint}/[id]`).default).get({
        id: createdId,
      });
      expectSuccess(response);
      expect(response.data.data).toMatchObject(validateShape);
      expect(response.data.data.id).toBe(createdId);
    });

    it('should return 404 for non-existent resource', async () => {
      const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const response = await new ApiTester(require(`${endpoint}/[id]`).default).get({ id: fakeId });
      expectError(response, 404);
    });
  });

  // Test UPDATE
  describe('UPDATE', () => {
    it('should update a resource', async () => {
      const response = await new ApiTester(require(`${endpoint}/[id]`).default).patch(updateData, {
        id: createdId,
      });
      expectSuccess(response);
      expect(response.data.data).toMatchObject({
        ...validateShape,
        ...updateData,
      });
    });

    it('should validate update data', async () => {
      const response = await new ApiTester(require(`${endpoint}/[id]`).default).patch(
        { invalidField: 'test' },
        { id: createdId },
      );
      expectError(response, 400);
    });
  });

  // Test DELETE
  describe('DELETE', () => {
    it('should delete a resource', async () => {
      const response = await new ApiTester(require(`${endpoint}/[id]`).default).delete({
        id: createdId,
      });
      expectSuccess(response);
    });

    it('should return 404 when deleting non-existent resource', async () => {
      const response = await new ApiTester(require(`${endpoint}/[id]`).default).delete({
        id: createdId,
      }); // Already deleted
      expectError(response, 404);
    });
  });

  if (afterEach) await afterEach();
}

/**
 * Test security headers
 */
export function expectSecurityHeaders(response: any) {
  const headers = response.headers;
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-xss-protection']).toBe('1; mode=block');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['cache-control']).toContain('no-store');
}

/**
 * Test data isolation
 */
export async function testDataIsolation(handler: NextApiHandler, user1Data: any, user2Data: any) {
  // Create data for user 1
  const req1 = createMockRequest('POST', user1Data);
  (req1 as any).userId = user1Data.userId;
  const res1 = createMockResponse();
  await handler(req1, res1);
  expectSuccess({ status: res1._getStatusCode(), data: res1._getData() });

  // Try to access user 1's data as user 2
  const resourceId = res1._getData().data.id;
  const req2 = createMockRequest('GET', null, { id: resourceId });
  (req2 as any).userId = user2Data.userId;
  const res2 = createMockResponse();
  await handler(req2, res2);

  // Should not be able to access other user's data
  expectError({ status: res2._getStatusCode(), data: res2._getData() }, 404);
}
