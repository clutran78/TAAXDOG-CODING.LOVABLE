import { logger } from '@/lib/logger';

/**
 * Parses and validates a PostgreSQL connection URL
 * Properly encodes special characters in the password
 */
export function sanitizeDatabaseUrl(url: string | undefined): string {
  if (!url) {
    throw new Error('DATABASE_URL is not defined');
  }

  try {
    // Parse the URL to validate its structure
    const urlRegex = /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?$/;
    const match = url.match(urlRegex);

    if (!match) {
      throw new Error('Invalid PostgreSQL URL format');
    }

    const [, username, password, host, port, database, queryString = ''] = match;

    // URL-encode the password to handle special characters
    const encodedPassword = encodeURIComponent(password);

    // Reconstruct the URL with the encoded password
    const sanitizedUrl = `postgresql://${username}:${encodedPassword}@${host}:${port}/${database}${queryString}`;

    // Validate the reconstructed URL
    try {
      new URL(sanitizedUrl);
    } catch (e) {
      throw new Error(`Invalid URL after encoding: ${e}`);
    }

    return sanitizedUrl;
  } catch (error) {
    logger.error('Failed to sanitize DATABASE_URL:', error);
    throw error;
  }
}

/**
 * Gets the database URL with proper encoding
 * Falls back to different environment variables based on NODE_ENV
 */
export function getDatabaseUrl(): string {
  const isProduction = process.env.NODE_ENV === 'production';

  // Try different environment variables
  const possibleUrls = [
    process.env.DATABASE_URL,
    isProduction ? process.env.DATABASE_URL_PRODUCTION : process.env.DATABASE_URL_DEVELOPMENT,
    isProduction ? process.env.PRODUCTION_DATABASE_URL : process.env.DEV_DATABASE_URL,
  ];

  // Find the first defined URL
  const rawUrl = possibleUrls.find(url => url !== undefined);

  if (!rawUrl) {
    const errorMsg = `No database URL found. Please set ${
      isProduction ? 'DATABASE_URL or DATABASE_URL_PRODUCTION' : 'DATABASE_URL or DATABASE_URL_DEVELOPMENT'
    }`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Sanitize and return the URL
  return sanitizeDatabaseUrl(rawUrl);
}

/**
 * Validates that the database URL has required components for production
 */
export function validateProductionDatabaseUrl(url: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const parsedUrl = new URL(url);

    // Check for SSL mode in production
    if (process.env.NODE_ENV === 'production') {
      const searchParams = new URLSearchParams(parsedUrl.search);
      if (searchParams.get('sslmode') !== 'require') {
        errors.push('Production database must use sslmode=require');
      }
    }

    // Check for required components
    if (!parsedUrl.username) {
      errors.push('Database URL must include a username');
    }

    if (!parsedUrl.password) {
      errors.push('Database URL must include a password');
    }

    if (!parsedUrl.hostname) {
      errors.push('Database URL must include a hostname');
    }

    if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
      errors.push('Database URL must include a database name');
    }

  } catch (error) {
    errors.push(`Invalid URL format: ${error}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Logs database connection info (without sensitive data)
 */
export function logDatabaseConnectionInfo(url: string): void {
  try {
    const parsedUrl = new URL(url);
    logger.info('Database connection info:', {
      host: parsedUrl.hostname,
      port: parsedUrl.port,
      database: parsedUrl.pathname.substring(1),
      ssl: parsedUrl.searchParams.get('sslmode') || 'none',
      username: parsedUrl.username,
      // Never log the password
    });
  } catch (error) {
    logger.error('Failed to parse database URL for logging:', error);
  }
}