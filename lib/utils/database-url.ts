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
    // First try to parse as-is to see if it's already valid
    try {
      new URL(url);
      // If it parses successfully, return it as-is
      return url;
    } catch {
      // If initial parse fails, try to fix the URL
      logger.warn('URL needs sanitization, attempting to fix');
    }

    // More flexible regex that handles complex passwords
    const urlRegex = /^postgresql:\/\/([^:]+):(.+)@([^:\/]+):(\d+)\/([^?]+)(\?.*)?$/;
    const match = url.match(urlRegex);

    if (!match) {
      // If regex fails, try a simple approach - just URL encode the whole thing after protocol
      if (url.startsWith('postgresql://')) {
        logger.warn('Using fallback URL encoding approach');
        return url; // Return as-is and let Prisma handle it
      }
      throw new Error('Invalid PostgreSQL URL format');
    }

    const [, username, password, host, port, database, queryString] = match;
    const safeQueryString = queryString || '';

    // URL-encode only the password to handle special characters
    const encodedPassword = encodeURIComponent(password);

    // Reconstruct the URL with the encoded password
    const sanitizedUrl = `postgresql://${username}:${encodedPassword}@${host}:${port}/${database}${safeQueryString}`;

    // Validate the reconstructed URL
    try {
      new URL(sanitizedUrl);
      logger.info('Successfully sanitized DATABASE_URL');
      return sanitizedUrl;
    } catch (e) {
      // If encoding fails, return original URL and let Prisma handle it
      logger.warn('URL encoding failed, returning original URL:', { error: e });
      return url;
    }

  } catch (error) {
    logger.error('Failed to sanitize DATABASE_URL:', error);
    // Return the original URL instead of throwing - let Prisma give a more specific error
    return url;
  }
}

/**
 * Gets the database URL with proper encoding
 * Falls back to different environment variables based on NODE_ENV
 */
export function getDatabaseUrl(): string {
  const isProduction = process.env.NODE_ENV === 'production';

  // Try different environment variables in priority order
  const possibleUrls = [
    process.env['DATABASE_URL'], // Primary - what DigitalOcean sets
    isProduction ? process.env['PRODUCTION_DATABASE_URL'] : process.env['DATABASE_URL_DEVELOPMENT'],
    isProduction ? process.env['DATABASE_URL_PRODUCTION'] : process.env['DEV_DATABASE_URL'],
  ];

  // Find the first defined URL
  const rawUrl = possibleUrls.find(url => url !== undefined && url.trim() !== '');

  if (!rawUrl) {
    const errorMsg = `No database URL found. Please set DATABASE_URL environment variable.`;
    logger.error(errorMsg, { 
      NODE_ENV: process.env.NODE_ENV,
      availableVars: Object.keys(process.env).filter(key => key.toLowerCase().includes('database'))
    });
    throw new Error(errorMsg);
  }

  logger.info('Found DATABASE_URL, attempting to sanitize...');
  
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

    // Check for SSL mode in production - be more flexible
    if (process.env.NODE_ENV === 'production') {
      const searchParams = new URLSearchParams(parsedUrl.search);
      const sslMode = searchParams.get('sslmode');
      
      // Allow 'require' or if it's a known secure host
      if (sslMode !== 'require' && !parsedUrl.hostname.includes('ondigitalocean.com')) {
        logger.warn('Production database URL should include sslmode=require');
        // Don't fail validation, just warn
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
    errors.push(`Invalid URL format: ${String(error)}`);
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