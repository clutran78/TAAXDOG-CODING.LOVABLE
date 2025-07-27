/**
 * API-specific type definitions
 */

import { NextApiRequest } from 'next';
import { User, UserRole } from './user';
import { ApiError, ValidationError, PaginationParams, SortOptions } from './common';

// Authenticated request
export interface AuthenticatedRequest extends NextApiRequest {
  userId: string;
  user?: User;
  userRole?: UserRole;
  sessionId?: string;
  requestId?: string;
}

// Validated request
export interface ValidatedRequest<TBody = unknown, TQuery = unknown> extends AuthenticatedRequest {
  validatedBody?: TBody;
  validatedQuery?: TQuery;
}

// API response types
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

export interface ErrorResponse {
  success: false;
  error: ApiError;
  errors?: ValidationError[];
  requestId?: string;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// Response metadata
export interface ResponseMeta {
  timestamp: Date;
  version: string;
  requestId: string;
  processingTime?: number;
  pagination?: PaginationMeta;
}

// Pagination metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Rate limiting
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

// Request context
export interface RequestContext {
  userId: string;
  requestId: string;
  ipAddress: string;
  userAgent: string;
  origin?: string;
  referer?: string;
  sessionId?: string;
  correlationId?: string;
}

// Security context
export interface SecurityContext {
  authenticated: boolean;
  userId?: string;
  role?: UserRole;
  permissions?: string[];
  ipAddress: string;
  userAgent: string;
  riskScore?: number;
  requiresMfa?: boolean;
}

// Webhook payload
export interface WebhookPayload<T = unknown> {
  id: string;
  type: string;
  created: Date;
  data: T;
  signature?: string;
  retryCount?: number;
}

// Webhook response
export interface WebhookResponse {
  received: boolean;
  processed?: boolean;
  error?: string;
}

// API health check
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: Date;

  services: {
    database: ServiceHealth;
    redis?: ServiceHealth;
    stripe?: ServiceHealth;
    basiq?: ServiceHealth;
    ai?: ServiceHealth;
  };

  metrics?: {
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

// Service health
export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  error?: string;
  lastCheck: Date;
}

// API metrics
export interface ApiMetrics {
  endpoint: string;
  method: string;

  performance: {
    count: number;
    avgDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
    maxDuration: number;
  };

  errors: {
    total: number;
    byStatus: Record<number, number>;
    byType: Record<string, number>;
  };

  period: {
    startDate: Date;
    endDate: Date;
  };
}

// Batch operation
export interface BatchRequest<T = unknown> {
  operations: BatchOperation<T>[];
  stopOnError?: boolean;
  parallel?: boolean;
}

export interface BatchOperation<T = unknown> {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: T;
  headers?: Record<string, string>;
}

export interface BatchResponse {
  results: BatchResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    duration: number;
  };
}

export interface BatchResult {
  id: string;
  status: number;
  data?: unknown;
  error?: ApiError;
  duration: number;
}

// File upload
export interface FileUploadRequest {
  file: Express.Multer.File | string; // File object or base64
  type: 'receipt' | 'document' | 'profile_image';
  metadata?: Record<string, unknown>;
}

export interface FileUploadResponse {
  fileId: string;
  url: string;
  thumbnailUrl?: string;
  size: number;
  mimeType: string;
  metadata?: Record<string, unknown>;
}

// Export request
export interface DataExportRequest {
  format: 'csv' | 'json' | 'pdf' | 'xlsx';
  type: 'transactions' | 'receipts' | 'tax_summary' | 'full_backup';
  filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    categories?: string[];
    accounts?: string[];
  };
  options?: {
    includeAttachments?: boolean;
    anonymize?: boolean;
    compress?: boolean;
  };
}

export interface DataExportResponse {
  exportId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: Date;
  size?: number;
  recordCount?: number;
}

// Search request
export interface SearchRequest {
  query: string;
  types?: ('transactions' | 'receipts' | 'goals' | 'merchants')[];
  filters?: Record<string, unknown>;
  pagination?: PaginationParams;
  sort?: SortOptions;
}

export interface SearchResult<T = unknown> {
  type: string;
  id: string;
  score: number;
  highlight?: Record<string, string[]>;
  data: T;
}
