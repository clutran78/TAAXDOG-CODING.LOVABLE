/**
 * Common type definitions used across the application
 */

// Generic status types
export type Status = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'CANCELLED' | 'COMPLETED';

// Common metadata structure
export interface Metadata {
  [key: string]: string | number | boolean | null;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Date range types
export interface DateRange {
  startDate: Date | string;
  endDate: Date | string;
}

// Australian state codes
export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT';

// Address type
export interface Address {
  street: string;
  suburb: string;
  state: AustralianState;
  postcode: string;
  country?: string;
}

// Error response types
export interface ApiError {
  error: string;
  message?: string;
  code?: string;
  field?: string;
  details?: unknown;
  requestId?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Success response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  errors?: ValidationError[];
}

// Audit types
export interface AuditInfo {
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version?: number;
}

// Currency types
export interface Money {
  amount: number;
  currency: 'AUD';
}

// File types
export interface FileInfo {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: Date;
}

// Sort options
export type SortOrder = 'asc' | 'desc';

export interface SortOptions {
  field: string;
  order: SortOrder;
}

// Filter options
export interface FilterOptions {
  search?: string;
  status?: Status;
  dateRange?: DateRange;
  categories?: string[];
  tags?: string[];
}
