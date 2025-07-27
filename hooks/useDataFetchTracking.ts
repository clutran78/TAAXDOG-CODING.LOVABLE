import { useCallback, useRef } from 'react';
import { performanceMonitor } from '../lib/monitoring/performance';

/**
 * Metrics collected for each fetch operation
 *
 * @interface FetchMetrics
 * @property {string} url - The URL or operation name that was fetched
 * @property {string} method - HTTP method or operation type (GET, POST, QUERY, MUTATION)
 * @property {number} duration - Time taken for the operation in milliseconds
 * @property {number} [status] - HTTP status code or custom status code
 * @property {boolean} [error] - Whether the operation resulted in an error
 * @property {boolean} [cached] - Whether the result was served from cache
 */
interface FetchMetrics {
  url: string;
  method: string;
  duration: number;
  status?: number;
  error?: boolean;
  cached?: boolean;
}

/**
 * Custom hook for tracking and monitoring data fetch operations with performance metrics
 *
 * @returns {Object} Tracking functions for various fetch operations
 * @returns {Function} returns.trackFetchStart - Start tracking a fetch operation
 * @returns {Function} returns.trackFetchEnd - End tracking and record metrics
 * @returns {Function} returns.trackQuery - Track async query operations
 * @returns {Function} returns.trackMutation - Track async mutation operations
 *
 * @example
 * const { trackQuery, trackMutation } = useDataFetchTracking();
 *
 * // Track a data query
 * const data = await trackQuery('getUserData', async () => {
 *   return await fetch('/api/user').then(r => r.json());
 * }, {
 *   expectedDuration: 1000, // Expected to complete within 1 second
 *   cacheKey: 'user-data'
 * });
 *
 * // Track a mutation
 * await trackMutation('updateProfile', async () => {
 *   return await fetch('/api/profile', { method: 'PUT', body: data });
 * });
 *
 * @note Automatically tracks:
 * - Fetch duration and performance
 * - Slow operations (>3 seconds)
 * - Cache hits when cacheKey is provided
 * - Errors and their status codes
 * - Custom performance metrics
 */
export function useDataFetchTracking() {
  const fetchStartTimes = useRef<Map<string, number>>(new Map());

  /**
   * Starts tracking a fetch operation
   *
   * @param {string} fetchId - Unique identifier for this fetch operation
   * @param {string} url - URL or operation name being fetched
   * @param {string} [method='GET'] - HTTP method or operation type
   */
  const trackFetchStart = useCallback((fetchId: string, url: string, method: string = 'GET') => {
    fetchStartTimes.current.set(fetchId, performance.now());
    performanceMonitor.trackInteraction('fetch-start', `${method} ${url}`);
  }, []);

  /**
   * Ends tracking for a fetch operation and records performance metrics
   *
   * @param {string} fetchId - Unique identifier matching the one used in trackFetchStart
   * @param {number} [status] - HTTP status code or operation result code
   * @param {boolean} [error] - Whether the operation resulted in an error
   * @param {boolean} [cached] - Whether the result was served from cache
   *
   * @note Automatically identifies slow fetches (>3000ms) and tracks them separately
   */
  const trackFetchEnd = useCallback(
    (fetchId: string, status?: number, error?: boolean, cached?: boolean) => {
      const startTime = fetchStartTimes.current.get(fetchId);
      if (!startTime) return;

      const duration = Math.round(performance.now() - startTime);
      fetchStartTimes.current.delete(fetchId);

      // Track the fetch completion
      performanceMonitor.trackInteraction('fetch-end', `${fetchId} (${duration}ms)`);

      // Set custom metrics
      performanceMonitor.setCustomMetric(`fetch_${fetchId}_duration`, duration);

      if (status) {
        performanceMonitor.setCustomMetric(`fetch_${fetchId}_status`, status);
      }

      // Track slow fetches
      if (duration > 3000) {
        performanceMonitor.trackInteraction('slow-fetch', `${fetchId} (${duration}ms)`);
      }

      // Track errors
      if (error) {
        performanceMonitor.trackInteraction('fetch-error', fetchId);
      }

      // Track cache hits
      if (cached) {
        performanceMonitor.trackInteraction('cache-hit', fetchId);
      }
    },
    [],
  );

  /**
   * Tracks an async query operation with automatic performance monitoring
   *
   * @template T - The return type of the query function
   * @param {string} queryName - Name/identifier for the query operation
   * @param {Function} queryFn - Async function that performs the query
   * @param {Object} [options] - Additional tracking options
   * @param {string} [options.cacheKey] - Cache key if result might be cached
   * @param {number} [options.expectedDuration] - Expected duration in ms for performance alerts
   * @returns {Promise<T>} The result of the query function
   *
   * @example
   * const users = await trackQuery('fetchUsers',
   *   () => fetch('/api/users').then(r => r.json()),
   *   { expectedDuration: 2000 }
   * );
   *
   * @throws {Error} Re-throws any error from the query function after tracking
   */
  const trackQuery = useCallback(
    async <T>(
      queryName: string,
      queryFn: () => Promise<T>,
      options?: {
        cacheKey?: string;
        expectedDuration?: number;
      },
    ): Promise<T> => {
      const fetchId = `${queryName}_${Date.now()}`;
      trackFetchStart(fetchId, queryName, 'QUERY');

      try {
        const result = await queryFn();
        trackFetchEnd(fetchId, 200, false, !!options?.cacheKey);

        // Track if query was slower than expected
        if (options?.expectedDuration) {
          const duration = performance.now() - (fetchStartTimes.current.get(fetchId) || 0);
          if (duration > options.expectedDuration) {
            performanceMonitor.trackInteraction(
              'slow-query',
              `${queryName} (expected: ${options.expectedDuration}ms, actual: ${Math.round(duration)}ms)`,
            );
          }
        }

        return result;
      } catch (error) {
        trackFetchEnd(fetchId, 500, true);
        throw error;
      }
    },
    [trackFetchStart, trackFetchEnd],
  );

  /**
   * Tracks an async mutation operation with performance monitoring
   *
   * @template T - The return type of the mutation function
   * @param {string} mutationName - Name/identifier for the mutation operation
   * @param {Function} mutationFn - Async function that performs the mutation
   * @returns {Promise<T>} The result of the mutation function
   *
   * @example
   * const result = await trackMutation('createGoal', async () => {
   *   return await fetch('/api/goals', {
   *     method: 'POST',
   *     body: JSON.stringify(goalData)
   *   }).then(r => r.json());
   * });
   *
   * @note Uses performance.measure() API for detailed timing
   * @throws {Error} Re-throws any error from the mutation function after tracking
   */
  const trackMutation = useCallback(
    async <T>(mutationName: string, mutationFn: () => Promise<T>): Promise<T> => {
      const fetchId = `${mutationName}_${Date.now()}`;
      trackFetchStart(fetchId, mutationName, 'MUTATION');
      performanceMonitor.startMeasure(`mutation_${mutationName}`);

      try {
        const result = await mutationFn();
        performanceMonitor.endMeasure(`mutation_${mutationName}`);
        trackFetchEnd(fetchId, 200);
        return result;
      } catch (error) {
        performanceMonitor.endMeasure(`mutation_${mutationName}`);
        trackFetchEnd(fetchId, 500, true);
        throw error;
      }
    },
    [trackFetchStart, trackFetchEnd],
  );

  return {
    trackFetchStart,
    trackFetchEnd,
    trackQuery,
    trackMutation,
  };
}
