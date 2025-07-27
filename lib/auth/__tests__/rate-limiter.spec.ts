import { RateLimiter, createRateLimiter } from '../rate-limiter';
import { NextApiRequest, NextApiResponse } from 'next';
import { createMockApiContext } from '@/tests/utils/api-mocks';

// Mock Redis
jest.mock('@/lib/services/cache/redis', () => ({
  redis: {
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
  },
}));

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  const mockRedis = require('@/lib/services/cache/redis').redis;

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimiter = new RateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 10,
      keyPrefix: 'test',
    });
  });

  describe('checkLimit', () => {
    it('allows requests within limit', async () => {
      mockRedis.incr.mockResolvedValueOnce(5); // 5th request

      const result = await rateLimiter.checkLimit('user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.resetAt).toBeDefined();
    });

    it('blocks requests exceeding limit', async () => {
      mockRedis.incr.mockResolvedValueOnce(11); // 11th request (over limit of 10)

      const result = await rateLimiter.checkLimit('user-123');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('sets expiration on first request', async () => {
      mockRedis.incr.mockResolvedValueOnce(1); // First request

      await rateLimiter.checkLimit('user-123');

      expect(mockRedis.expire).toHaveBeenCalledWith(
        'test:user-123',
        60, // 60 seconds
      );
    });

    it('uses IP address as key when provided', async () => {
      mockRedis.incr.mockResolvedValueOnce(1);

      await rateLimiter.checkLimit('192.168.1.1', 'ip');

      expect(mockRedis.incr).toHaveBeenCalledWith('test:ip:192.168.1.1');
    });

    it('handles Redis errors gracefully', async () => {
      mockRedis.incr.mockRejectedValueOnce(new Error('Redis error'));

      const result = await rateLimiter.checkLimit('user-123');

      // Should allow request on error (fail open)
      expect(result.allowed).toBe(true);
      expect(result.error).toBe('Rate limit check failed');
    });

    it('respects custom limits for specific operations', async () => {
      const customLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5, // Lower limit
        keyPrefix: 'api-heavy',
      });

      mockRedis.incr.mockResolvedValueOnce(6);

      const result = await customLimiter.checkLimit('user-123');

      expect(result.allowed).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets rate limit for identifier', async () => {
      mockRedis.del.mockResolvedValueOnce(1);

      const result = await rateLimiter.reset('user-123');

      expect(mockRedis.del).toHaveBeenCalledWith('test:user-123');
      expect(result).toBe(true);
    });

    it('handles reset errors', async () => {
      mockRedis.del.mockRejectedValueOnce(new Error('Redis error'));

      const result = await rateLimiter.reset('user-123');

      expect(result).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('returns current rate limit status', async () => {
      mockRedis.incr.mockResolvedValueOnce(3);
      mockRedis.ttl.mockResolvedValueOnce(45); // 45 seconds remaining

      const status = await rateLimiter.getStatus('user-123');

      expect(status).toEqual({
        current: 3,
        limit: 10,
        remaining: 7,
        resetIn: 45,
      });
    });

    it('handles missing key', async () => {
      mockRedis.incr.mockResolvedValueOnce(0);
      mockRedis.ttl.mockResolvedValueOnce(-1); // Key doesn't exist

      const status = await rateLimiter.getStatus('new-user');

      expect(status.current).toBe(0);
      expect(status.remaining).toBe(10);
    });
  });
});

describe('createRateLimiter middleware', () => {
  const mockRedis = require('@/lib/services/cache/redis').redis;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows requests within rate limit', async () => {
    mockRedis.incr.mockResolvedValueOnce(5);

    const middleware = createRateLimiter({ maxRequests: 10 });
    const { req, res } = createMockApiContext(
      'POST',
      {},
      {},
      {
        'x-forwarded-for': '192.168.1.1',
      },
    );

    const next = jest.fn();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '5');
  });

  it('blocks requests exceeding rate limit', async () => {
    mockRedis.incr.mockResolvedValueOnce(11);

    const middleware = createRateLimiter({ maxRequests: 10 });
    const { req, res } = createMockApiContext('POST');

    const next = jest.fn();
    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res._getJSONData()).toEqual({
      error: 'Too many requests, please try again later',
    });
  });

  it('uses custom error message', async () => {
    mockRedis.incr.mockResolvedValueOnce(11);

    const middleware = createRateLimiter({
      maxRequests: 10,
      message: 'Custom rate limit message',
    });
    const { req, res } = createMockApiContext('POST');

    const next = jest.fn();
    await middleware(req, res, next);

    expect(res._getJSONData()).toEqual({
      error: 'Custom rate limit message',
    });
  });

  it('extracts IP from various headers', async () => {
    mockRedis.incr.mockResolvedValueOnce(1);

    const middleware = createRateLimiter({ maxRequests: 10 });

    // Test X-Forwarded-For
    const { req: req1 } = createMockApiContext(
      'GET',
      {},
      {},
      {
        'x-forwarded-for': '10.0.0.1, 192.168.1.1',
      },
    );
    await middleware(req1, {} as any, jest.fn());
    expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringContaining('10.0.0.1'));

    // Test X-Real-IP
    jest.clearAllMocks();
    mockRedis.incr.mockResolvedValueOnce(1);
    const { req: req2 } = createMockApiContext(
      'GET',
      {},
      {},
      {
        'x-real-ip': '172.16.0.1',
      },
    );
    await middleware(req2, {} as any, jest.fn());
    expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringContaining('172.16.0.1'));
  });

  it('uses authenticated user ID when available', async () => {
    mockRedis.incr.mockResolvedValueOnce(1);

    const middleware = createRateLimiter({ maxRequests: 10 });
    const { req, res } = createMockApiContext('POST');

    // Add authenticated user to request
    (req as any).user = { id: 'user-123' };

    const next = jest.fn();
    await middleware(req, res, next);

    expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringContaining('user:user-123'));
  });

  it('skips rate limiting for whitelisted IPs', async () => {
    const middleware = createRateLimiter({
      maxRequests: 10,
      skipSuccessfulRequests: false,
      skip: (req) => req.headers['x-forwarded-for'] === '127.0.0.1',
    });

    const { req, res } = createMockApiContext(
      'POST',
      {},
      {},
      {
        'x-forwarded-for': '127.0.0.1',
      },
    );

    const next = jest.fn();
    await middleware(req, res, next);

    expect(mockRedis.incr).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('handles different rate limits for different endpoints', async () => {
    // Login endpoint - stricter limit
    const loginLimiter = createRateLimiter({
      maxRequests: 5,
      windowMs: 300000, // 5 minutes
      keyPrefix: 'login',
    });

    // API endpoint - normal limit
    const apiLimiter = createRateLimiter({
      maxRequests: 100,
      windowMs: 60000, // 1 minute
      keyPrefix: 'api',
    });

    mockRedis.incr.mockResolvedValueOnce(6); // Over login limit
    const { req: loginReq, res: loginRes } = createMockApiContext('POST');
    await loginLimiter(loginReq, loginRes, jest.fn());
    expect(loginRes.statusCode).toBe(429);

    jest.clearAllMocks();
    mockRedis.incr.mockResolvedValueOnce(6); // Under API limit
    const { req: apiReq, res: apiRes } = createMockApiContext('GET');
    const apiNext = jest.fn();
    await apiLimiter(apiReq, apiRes, apiNext);
    expect(apiNext).toHaveBeenCalled();
  });
});
