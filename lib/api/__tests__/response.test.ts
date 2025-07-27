import { NextApiResponse } from 'next';
import { apiResponse, ApiResponseHelper, isApiSuccessResponse, isApiErrorResponse, createApiError } from '../response';

// Mock NextApiResponse
const mockResponse = (): NextApiResponse => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  };
  return res;
};

describe('API Response Utilities', () => {
  let res: NextApiResponse;

  beforeEach(() => {
    res = mockResponse();
    jest.clearAllMocks();
  });

  describe('ApiResponseHelper', () => {
    describe('success', () => {
      it('sends success response with default status code', () => {
        const data = { user: { id: '123', name: 'Test' } };
        
        ApiResponseHelper.success(res, data);
        
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data,
          message: undefined,
          metadata: undefined,
          timestamp: expect.any(String),
        });
      });

      it('sends success response with custom status code and metadata', () => {
        const data = { result: 'success' };
        const metadata = { version: '1.0', requestId: 'req-123' };
        
        ApiResponseHelper.success(res, data, 'Operation successful', 201, metadata);
        
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data,
          message: 'Operation successful',
          metadata,
          timestamp: expect.any(String),
        });
      });
    });

    describe('error', () => {
      it('sends error response with default status code', () => {
        ApiResponseHelper.error(res, 'Something went wrong');
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Something went wrong',
          message: 'Something went wrong',
          details: undefined,
          code: undefined,
          timestamp: expect.any(String),
        });
      });

      it('sends error response with details and code', () => {
        const details = { field: 'email', reason: 'invalid format' };
        
        ApiResponseHelper.error(res, 'Validation failed', 422, details, 'VALIDATION_ERROR');
        
        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Validation failed',
          message: 'Validation failed',
          details,
          code: 'VALIDATION_ERROR',
          timestamp: expect.any(String),
        });
      });

      it('logs server errors', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        ApiResponseHelper.error(res, 'Internal error', 500, { stack: 'error stack' });
        
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('paginated', () => {
      it('sends paginated response with correct pagination metadata', () => {
        const data = [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
        ];
        
        ApiResponseHelper.paginated(res, data, 2, 10, 25);
        
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data,
          message: undefined,
          pagination: {
            page: 2,
            limit: 10,
            total: 25,
            pages: 3,
            hasNext: true,
            hasPrev: true,
          },
          timestamp: expect.any(String),
        });
      });

      it('calculates pagination correctly for first page', () => {
        const data = ['item1', 'item2'];
        
        ApiResponseHelper.paginated(res, data, 1, 5, 10);
        
        const response = (res.json as jest.Mock).mock.calls[0][0];
        expect(response.pagination).toEqual({
          page: 1,
          limit: 5,
          total: 10,
          pages: 2,
          hasNext: true,
          hasPrev: false,
        });
      });
    });

    describe('noContent', () => {
      it('sends 204 no content response', () => {
        ApiResponseHelper.noContent(res);
        
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.end).toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
      });
    });

    describe('created', () => {
      it('sends 201 created response', () => {
        const data = { id: '123', name: 'New Resource' };
        
        ApiResponseHelper.created(res, data);
        
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data,
          message: 'Resource created successfully',
          metadata: undefined,
          timestamp: expect.any(String),
        });
      });
    });

    describe('unauthorized', () => {
      it('sends 401 unauthorized response', () => {
        ApiResponseHelper.unauthorized(res);
        
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Unauthorized',
          message: 'Unauthorized',
          details: undefined,
          code: 'UNAUTHORIZED',
          timestamp: expect.any(String),
        });
      });
    });

    describe('forbidden', () => {
      it('sends 403 forbidden response', () => {
        ApiResponseHelper.forbidden(res, 'Insufficient permissions');
        
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Insufficient permissions',
          message: 'Insufficient permissions',
          details: undefined,
          code: 'FORBIDDEN',
          timestamp: expect.any(String),
        });
      });
    });

    describe('notFound', () => {
      it('sends 404 not found response', () => {
        ApiResponseHelper.notFound(res, 'User');
        
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'User not found',
          message: 'User not found',
          details: undefined,
          code: 'NOT_FOUND',
          timestamp: expect.any(String),
        });
      });
    });

    describe('validationError', () => {
      it('sends 422 validation error response', () => {
        const errors = [
          { field: 'email', message: 'Invalid email format' },
          { field: 'password', message: 'Too short' },
        ];
        
        ApiResponseHelper.validationError(res, errors);
        
        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Validation failed',
          message: 'Validation failed',
          details: errors,
          code: 'VALIDATION_ERROR',
          timestamp: expect.any(String),
        });
      });
    });

    describe('methodNotAllowed', () => {
      it('sends 405 method not allowed response with Allow header', () => {
        ApiResponseHelper.methodNotAllowed(res, ['GET', 'POST']);
        
        expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET, POST');
        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Method not allowed',
          message: 'Method not allowed',
          details: { allowedMethods: ['GET', 'POST'] },
          code: 'METHOD_NOT_ALLOWED',
          timestamp: expect.any(String),
        });
      });
    });

    describe('rateLimitExceeded', () => {
      it('sends 429 rate limit exceeded response', () => {
        ApiResponseHelper.rateLimitExceeded(res);
        
        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Too many requests',
          message: 'Too many requests',
          details: { retryAfter: undefined },
          code: 'RATE_LIMIT_EXCEEDED',
          timestamp: expect.any(String),
        });
      });

      it('sets Retry-After header when provided', () => {
        ApiResponseHelper.rateLimitExceeded(res, 60);
        
        expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
      });
    });

    describe('internalError', () => {
      it('sends 500 internal error response', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        ApiResponseHelper.internalError(res, new Error('Database connection failed'));
        
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error',
          message: 'Internal server error',
          details: expect.any(Error), // In dev mode
          code: 'INTERNAL_ERROR',
          timestamp: expect.any(String),
        });
        
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('hides error details in production', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        
        ApiResponseHelper.internalError(res, new Error('Secret error'));
        
        const response = (res.json as jest.Mock).mock.calls[0][0];
        expect(response.details).toBeUndefined();
        
        process.env.NODE_ENV = originalEnv;
      });
    });

    describe('handleError', () => {
      it('handles errors based on message content', () => {
        const unauthorizedError = new Error('Unauthorized access');
        ApiResponseHelper.handleError(res, unauthorizedError);
        expect(res.status).toHaveBeenCalledWith(401);

        jest.clearAllMocks();
        const forbiddenError = new Error('Forbidden resource');
        ApiResponseHelper.handleError(res, forbiddenError);
        expect(res.status).toHaveBeenCalledWith(403);

        jest.clearAllMocks();
        const notFoundError = new Error('Not found');
        ApiResponseHelper.handleError(res, notFoundError);
        expect(res.status).toHaveBeenCalledWith(404);

        jest.clearAllMocks();
        const validationError = new Error('Validation failed');
        ApiResponseHelper.handleError(res, validationError);
        expect(res.status).toHaveBeenCalledWith(422);
      });

      it('defaults to internal error for unknown errors', () => {
        ApiResponseHelper.handleError(res, 'Unknown error');
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe('Type Guards', () => {
    it('isApiSuccessResponse correctly identifies success responses', () => {
      const successResponse = {
        success: true as const,
        data: { id: '123' },
        timestamp: new Date().toISOString(),
      };
      
      const errorResponse = {
        success: false as const,
        error: 'Error',
        message: 'Error',
        timestamp: new Date().toISOString(),
      };
      
      expect(isApiSuccessResponse(successResponse)).toBe(true);
      expect(isApiSuccessResponse(errorResponse)).toBe(false);
    });

    it('isApiErrorResponse correctly identifies error responses', () => {
      const successResponse = {
        success: true as const,
        data: { id: '123' },
        timestamp: new Date().toISOString(),
      };
      
      const errorResponse = {
        success: false as const,
        error: 'Error',
        message: 'Error',
        timestamp: new Date().toISOString(),
      };
      
      expect(isApiErrorResponse(successResponse)).toBe(false);
      expect(isApiErrorResponse(errorResponse)).toBe(true);
    });
  });

  describe('createApiError', () => {
    it('creates consistent error objects', () => {
      const error = createApiError('Validation failed', 'VALIDATION_ERROR', { field: 'email' });
      
      expect(error).toEqual({
        success: false,
        error: 'Validation failed',
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: { field: 'email' },
        timestamp: expect.any(String),
      });
    });
  });

  describe('apiResponse alias', () => {
    it('exports apiResponse as alias for ApiResponseHelper', () => {
      expect(apiResponse).toBe(ApiResponseHelper);
    });
  });
});