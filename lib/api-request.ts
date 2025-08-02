/**
 * API request utility for making authenticated requests to the backend
 */

import { getSession } from 'next-auth/react';

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  includeAuth?: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Make an authenticated API request
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {}, includeAuth = true } = options;

  // Get session for authentication
  const session = includeAuth ? await getSession() : null;

  const requestHeaders: Record<string, string> = {
    ...headers,
  };

  // Add auth header if session exists
  if (session?.user) {
    requestHeaders['Authorization'] = `Bearer ${session.user.id}`;
  }

  // Add content type for JSON bodies
  if (body && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(endpoint, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include', // Include cookies
    });

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(
        responseData?.error || `Request failed with status ${response.status}`,
        response.status,
        responseData?.details,
      );
    }

    return responseData;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new ApiError(error.message, 500);
    }

    throw new ApiError('An unexpected error occurred', 500);
  }
}

/**
 * GET request helper
 */
export async function apiGet<T = any>(
  endpoint: string,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * POST request helper
 */
export async function apiPost<T = any>(
  endpoint: string,
  body?: any,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'POST', body });
}

/**
 * PUT request helper
 */
export async function apiPut<T = any>(
  endpoint: string,
  body?: any,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'PUT', body });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T = any>(
  endpoint: string,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
}

/**
 * PATCH request helper
 */
export async function apiPatch<T = any>(
  endpoint: string,
  body?: any,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'PATCH', body });
}
