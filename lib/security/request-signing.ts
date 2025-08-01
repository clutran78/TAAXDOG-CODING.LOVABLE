import crypto from 'crypto';
import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '../utils/logger';

interface SignedRequest {
  signature: string;
  timestamp: number;
  nonce: string;
  userId: string;
  payload: any;
}

interface SignatureOptions {
  maxAge?: number; // Maximum age of request in milliseconds (default: 5 minutes)
  requireNonce?: boolean; // Require nonce to prevent replay attacks (default: true)
  algorithm?: string; // Hash algorithm (default: 'sha256')
}

export class RequestSigner {
  private static instance: RequestSigner;
  private readonly usedNonces: Map<string, number> = new Map();
  private readonly NONCE_CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private readonly DEFAULT_MAX_AGE = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    // Cleanup old nonces periodically
    setInterval(() => this.cleanupNonces(), this.NONCE_CLEANUP_INTERVAL);
  }

  public static getInstance(): RequestSigner {
    if (!RequestSigner.instance) {
      RequestSigner.instance = new RequestSigner();
    }
    return RequestSigner.instance;
  }

  /**
   * Generate a signature for a request
   */
  public generateSignature(
    userId: string,
    payload: any,
    secret: string,
    options: SignatureOptions = {},
  ): SignedRequest {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');
    const algorithm = options.algorithm || 'sha256';

    // Create canonical string for signing
    const canonicalString = this.createCanonicalString({
      userId,
      payload,
      timestamp,
      nonce,
    });

    // Generate signature
    const signature = crypto.createHmac(algorithm, secret).update(canonicalString).digest('hex');

    return {
      signature,
      timestamp,
      nonce,
      userId,
      payload,
    };
  }

  /**
   * Verify a signed request
   */
  public verifySignature(
    request: SignedRequest,
    secret: string,
    options: SignatureOptions = {},
  ): { valid: boolean; error?: string } {
    const maxAge = options.maxAge || this.DEFAULT_MAX_AGE;
    const requireNonce = options.requireNonce !== false;
    const algorithm = options.algorithm || 'sha256';

    // Check timestamp
    const now = Date.now();
    if (now - request.timestamp > maxAge) {
      return { valid: false, error: 'Request expired' };
    }

    // Check nonce if required
    if (requireNonce) {
      if (this.usedNonces.has(request.nonce)) {
        return { valid: false, error: 'Nonce already used' };
      }
      // Store nonce
      this.usedNonces.set(request.nonce, now);
    }

    // Recreate canonical string
    const canonicalString = this.createCanonicalString({
      userId: request.userId,
      payload: request.payload,
      timestamp: request.timestamp,
      nonce: request.nonce,
    });

    // Verify signature
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(canonicalString)
      .digest('hex');

    const valid = crypto.timingSafeEqual(
      Buffer.from(request.signature),
      Buffer.from(expectedSignature),
    );

    if (!valid) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true };
  }

  /**
   * Create canonical string for signing
   */
  private createCanonicalString(data: {
    userId: string;
    payload: any;
    timestamp: number;
    nonce: string;
  }): string {
    // Sort payload keys for consistent ordering
    const sortedPayload = this.sortObject(data.payload);

    return [data.userId, data.timestamp, data.nonce, JSON.stringify(sortedPayload)].join(':');
  }

  /**
   * Sort object keys recursively
   */
  private sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortObject(item));
    }

    const sorted: any = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sorted[key] = this.sortObject(obj[key]);
    }

    return sorted;
  }

  /**
   * Cleanup old nonces
   */
  private cleanupNonces() {
    const now = Date.now();
    const maxAge = this.DEFAULT_MAX_AGE * 2; // Keep nonces for twice the max age

    this.usedNonces.forEach((timestamp, nonce) => {
      if (now - timestamp > maxAge) {
        this.usedNonces.delete(nonce);
      }
    });

    logger.info('Cleaned up expired nonces', {
      remaining: this.usedNonces.size,
    });
  }

  /**
   * Get signing secret for user
   */
  public async getUserSigningSecret(userId: string): Promise<string> {
    // In production, this should fetch from database
    // For now, derive from user ID and app secret
    const appSecret = process.env.SIGNING_SECRET || 'default-secret';

    return crypto.createHash('sha256').update(`${appSecret}:${userId}`).digest('hex');
  }
}

/**
 * Middleware to verify signed requests
 */
export function withRequestSigning(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  options: SignatureOptions = {},
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const signer = RequestSigner.getInstance();

    // Extract signature headers
    const signature = req.headers['x-signature'] as string;
    const timestamp = parseInt(req.headers['x-timestamp'] as string);
    const nonce = req.headers['x-nonce'] as string;
    const userId = req.headers['x-user-id'] as string;

    if (!signature || !timestamp || !nonce || !userId) {
      return res.status(401).json({
        error: 'Missing signature headers',
        required: ['x-signature', 'x-timestamp', 'x-nonce', 'x-user-id'],
      });
    }

    try {
      // Get user's signing secret
      const secret = await signer.getUserSigningSecret(userId);

      // Verify signature
      const signedRequest: SignedRequest = {
        signature,
        timestamp,
        nonce,
        userId,
        payload: req.body,
      };

      const result = signer.verifySignature(signedRequest, secret, options);

      if (!result.valid) {
        logger.warn('Invalid request signature', {
          userId,
          error: result.error,
          endpoint: req.url,
        });

        return res.status(401).json({
          error: 'Invalid request signature',
          details: result.error,
        });
      }

      // Add verified user ID to request
      (req as any).verifiedUserId = userId;

      // Continue to handler
      await handler(req, res);
    } catch (error) {
      logger.error('Request signing error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        endpoint: req.url,
      });

      return res.status(500).json({
        error: 'Request verification failed',
      });
    }
  };
}

/**
 * Client-side helper to sign requests
 */
export class RequestSignerClient {
  constructor(
    private userId: string,
    private secret: string,
    private options: SignatureOptions = {},
  ) {}

  /**
   * Sign a request
   */
  public async signRequest(
    method: string,
    url: string,
    payload?: any,
  ): Promise<{
    headers: Record<string, string>;
    body?: string;
  }> {
    const signer = RequestSigner.getInstance();
    const signed = signer.generateSignature(this.userId, payload || {}, this.secret, this.options);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Signature': signed.signature,
      'X-Timestamp': signed.timestamp.toString(),
      'X-Nonce': signed.nonce,
      'X-User-ID': signed.userId,
    };

    return {
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    };
  }

  /**
   * Make a signed fetch request
   */
  public async fetch(
    url: string,
    options: RequestInit & { payload?: any } = {},
  ): Promise<Response> {
    const { payload, ...fetchOptions } = options;
    const signed = await this.signRequest(options.method || 'GET', url, payload);

    return fetch(url, {
      ...fetchOptions,
      headers: {
        ...fetchOptions.headers,
        ...signed.headers,
      },
      body: signed.body,
    });
  }
}

// Export singleton instance
export const requestSigner = RequestSigner.getInstance();
