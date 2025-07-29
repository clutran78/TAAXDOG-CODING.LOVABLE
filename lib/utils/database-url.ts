import { logger } from '@/lib/logger';

interface DatabaseUrlOptions {
  allowInsecure?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Parses and validates a PostgreSQL connection URL
 * Properly encodes special characters in the password
 * Enhanced with better error handling and logging
 */
export function sanitizeDatabaseUrl(url: string | undefined, options: DatabaseUrlOptions = {}): string {
  const { logLevel = 'info' } = options;
  
  if (!url) {
    const error = new Error('DATABASE_URL is not defined');
    logger.error('Missing DATABASE_URL', {
      availableEnvVars: Object.keys(process.env).filter(key => key.includes('DATABASE')),
      nodeEnv: process.env.NODE_ENV,
    });
    throw error;
  }

  // Remove all whitespace, newlines, and tabs from the URL
  // This handles cases where environment variables might have line breaks
  const cleanedUrl = url.replace(/[\s\n\r\t]+/g, '');
  
  // Log if we had to clean the URL
  if (cleanedUrl !== url) {
    logger[logLevel]('Cleaned whitespace/newlines from DATABASE_URL', {
      originalLength: url.length,
      cleanedLength: cleanedUrl.length,
      removedChars: url.length - cleanedUrl.length,
    });
  }

  try {
    // First try to parse the cleaned URL to see if it's valid
    try {
      const testUrl = new URL(cleanedUrl);
      logger.debug('DATABASE_URL parsed successfully without modification', {
        protocol: testUrl.protocol,
        host: testUrl.hostname,
        port: testUrl.port,
        pathname: testUrl.pathname,
      });
      // If it parses successfully, return the cleaned URL
      return cleanedUrl;
    } catch (parseError) {
      // If initial parse fails, try to fix the URL
      logger.warn('URL needs sanitization, attempting to fix', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
    }

    // More flexible regex that handles complex passwords
    const urlRegex = /^(postgresql|postgres):\/\/([^:]+):(.+)@([^:\/]+):(\d+)\/([^?]+)(\?.*)?$/;
    const match = cleanedUrl.match(urlRegex);

    if (!match) {
      // If regex fails, try a simple approach - just URL encode the whole thing after protocol
      if (cleanedUrl.startsWith('postgresql://') || cleanedUrl.startsWith('postgres://')) {
        logger.warn('Using fallback URL approach - letting Prisma handle parsing', {
          urlPrefix: cleanedUrl.substring(0, 20) + '...',
        });
        return cleanedUrl; // Return cleaned URL and let Prisma handle it
      }
      
      logger.error('Invalid PostgreSQL URL format', {
        urlPrefix: cleanedUrl.substring(0, 20) + '...',
        startsWithPostgres: cleanedUrl.startsWith('postgres'),
        urlLength: cleanedUrl.length,
      });
      throw new Error('Invalid PostgreSQL URL format - must start with postgresql:// or postgres://');
    }

    const [, protocol, username, password, host, port, database, queryString] = match;
    const safeQueryString = queryString || '';

    // URL-encode only the password to handle special characters
    const encodedPassword = encodeURIComponent(password);

    // Reconstruct the URL with the encoded password
    const sanitizedUrl = `${protocol}://${username}:${encodedPassword}@${host}:${port}/${database}${safeQueryString}`;

    // Validate the reconstructed URL
    try {
      const validatedUrl = new URL(sanitizedUrl);
      logger[logLevel]('Successfully sanitized DATABASE_URL', {
        protocol: validatedUrl.protocol,
        host: validatedUrl.hostname,
        port: validatedUrl.port,
        database: validatedUrl.pathname.substring(1),
        hasSSL: validatedUrl.searchParams.has('sslmode'),
        sslMode: validatedUrl.searchParams.get('sslmode'),
      });
      return sanitizedUrl;
    } catch (validationError) {
      // If encoding fails, return original URL and let Prisma handle it
      logger.warn('URL encoding produced invalid URL, returning cleaned URL', { 
        error: validationError instanceof Error ? validationError.message : String(validationError),
        attemptedUrl: sanitizedUrl.replace(/:([^@]+)@/, ':***@'), // Hide password
      });
      return cleanedUrl;
    }

  } catch (error) {
    logger.error('Failed to sanitize DATABASE_URL', {
      error: error instanceof Error ? error.message : String(error),
      urlLength: cleanedUrl.length,
      startsWithPostgres: cleanedUrl.startsWith('postgres'),
    });
    // Return the cleaned URL instead of throwing - let Prisma give a more specific error
    return cleanedUrl;
  }
}

/**
 * Gets the database URL with proper encoding
 * Falls back to different environment variables based on NODE_ENV
 * Enhanced with better development fallbacks and detailed logging
 */
export function getDatabaseUrl(options: DatabaseUrlOptions = {}): string {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isDevelopment = nodeEnv === 'development';
  const isTest = nodeEnv === 'test';

  logger.debug('Getting database URL', {
    nodeEnv,
    isProduction,
    isDevelopment,
    isTest,
  });

  // Try different environment variables in priority order
  const possibleUrls = [
    // Primary - what most deployment platforms set
    process.env['DATABASE_URL'],
    
    // Environment-specific URLs
    isProduction && process.env['PRODUCTION_DATABASE_URL'],
    isProduction && process.env['DATABASE_URL_PRODUCTION'],
    isDevelopment && process.env['DATABASE_URL_DEVELOPMENT'],
    isDevelopment && process.env['DEV_DATABASE_URL'],
    isDevelopment && process.env['LOCAL_DATABASE_URL'],
    isTest && process.env['TEST_DATABASE_URL'],
    isTest && process.env['DATABASE_URL_TEST'],
    
    // Pooling URLs (might be set instead of direct URLs)
    process.env['DATABASE_POOLING_URL'],
    isProduction && process.env['DATABASE_POOL_URL'],
    
    // Legacy or alternative names
    process.env['POSTGRES_URL'],
    process.env['POSTGRESQL_URL'],
    process.env['PG_CONNECTION_STRING'],
  ].filter(Boolean); // Remove falsy values

  // Find the first defined URL and trim it
  const rawUrl = possibleUrls
    .filter(url => url !== undefined && url !== '')
    .map(url => url!.trim())
    .find(url => url.length > 0);

  // Development fallback
  if (!rawUrl && isDevelopment) {
    const defaultDevUrl = 'postgresql://postgres:postgres@localhost:5432/taaxdog_development';
    logger.warn('No DATABASE_URL found in development, using default', {
      defaultUrl: defaultDevUrl,
      hint: 'Set DATABASE_URL or DATABASE_URL_DEVELOPMENT in your .env.local file',
    });
    
    // In development, we can provide a helpful default
    if (options.allowInsecure !== false) {
      return sanitizeDatabaseUrl(defaultDevUrl, { ...options, logLevel: 'warn' });
    }
  }

  if (!rawUrl) {
    const availableDbVars = Object.keys(process.env)
      .filter(key => key.toLowerCase().includes('database') || key.toLowerCase().includes('postgres'))
      .sort();
    
    const errorMsg = `No database URL found. Please set DATABASE_URL environment variable.`;
    logger.error(errorMsg, { 
      nodeEnv,
      availableDbVars,
      checkedVars: [
        'DATABASE_URL',
        'DATABASE_URL_DEVELOPMENT',
        'DATABASE_URL_PRODUCTION',
        'DATABASE_POOLING_URL',
      ],
      hint: isDevelopment 
        ? 'In development, set DATABASE_URL in your .env.local file' 
        : 'In production, ensure DATABASE_URL is set in your deployment platform',
    });
    
    throw new Error(errorMsg + (isDevelopment 
      ? '\n\nHint: Add DATABASE_URL="postgresql://user:pass@host:port/dbname" to your .env.local file' 
      : '\n\nHint: Check your deployment platform environment variables'));
  }

  logger.info('Found database URL', {
    source: possibleUrls.indexOf(rawUrl) === 0 ? 'DATABASE_URL' : 'fallback',
    urlLength: rawUrl.length,
    hasSSL: rawUrl.includes('sslmode'),
  });
  
  // Sanitize and return the URL
  return sanitizeDatabaseUrl(rawUrl, options);
}

/**
 * Validates that the database URL has required components for production
 * Enhanced with warnings and detailed checks
 */
export function validateProductionDatabaseUrl(url: string): { 
  valid: boolean; 
  errors: string[]; 
  warnings: string[];
  details: Record<string, any>;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: Record<string, any> = {};

  try {
    const parsedUrl = new URL(url);
    const searchParams = new URLSearchParams(parsedUrl.search);
    
    // Extract details for logging
    details.protocol = parsedUrl.protocol;
    details.host = parsedUrl.hostname;
    details.port = parsedUrl.port || '5432';
    details.database = parsedUrl.pathname.substring(1);
    details.username = parsedUrl.username;
    details.hasPassword = !!parsedUrl.password;
    details.sslMode = searchParams.get('sslmode');
    details.poolingMode = searchParams.get('pgbouncer');

    // Check for SSL mode in production - be more flexible
    if (process.env.NODE_ENV === 'production') {
      const sslMode = searchParams.get('sslmode');
      const knownSecureHosts = [
        'ondigitalocean.com',
        'amazonaws.com',
        'azure.com',
        'googleapis.com',
        'supabase.co',
        'neon.tech',
      ];
      
      const isKnownSecureHost = knownSecureHosts.some(host => parsedUrl.hostname.includes(host));
      
      // Allow 'require' or if it's a known secure host
      if (sslMode !== 'require' && !isKnownSecureHost) {
        warnings.push('Production database URL should include sslmode=require for security');
        logger.warn('Production database URL missing SSL', {
          host: parsedUrl.hostname,
          currentSSLMode: sslMode,
          recommendation: 'Add ?sslmode=require to your DATABASE_URL',
        });
      }
      
      // Check for connection pooling in production
      if (!parsedUrl.hostname.includes('pool') && !searchParams.has('pgbouncer')) {
        warnings.push('Consider using connection pooling for production databases');
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

    // Check for valid port
    const port = parseInt(parsedUrl.port || '5432', 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`Invalid port number: ${parsedUrl.port}`);
    }

    // Check protocol
    if (!['postgresql:', 'postgres:'].includes(parsedUrl.protocol)) {
      errors.push(`Invalid protocol: ${parsedUrl.protocol}. Must be postgresql:// or postgres://`);
    }

    // Additional checks for common issues
    if (parsedUrl.hostname === 'localhost' && process.env.NODE_ENV === 'production') {
      warnings.push('Using localhost in production environment - this may not work in deployed environments');
    }

    if (parsedUrl.username === 'postgres' && process.env.NODE_ENV === 'production') {
      warnings.push('Using default postgres user in production - consider creating a dedicated user');
    }

  } catch (error) {
    errors.push(`Invalid URL format: ${error instanceof Error ? error.message : String(error)}`);
    logger.error('Failed to parse database URL for validation', {
      error: error instanceof Error ? error.message : String(error),
      urlLength: url.length,
    });
  }

  const valid = errors.length === 0;
  
  // Log validation results
  if (!valid) {
    logger.error('Database URL validation failed', { errors, warnings, details });
  } else if (warnings.length > 0) {
    logger.warn('Database URL validation passed with warnings', { warnings, details });
  } else {
    logger.debug('Database URL validation passed', { details });
  }

  return {
    valid,
    errors,
    warnings,
    details,
  };
}

/**
 * Logs database connection info (without sensitive data)
 * Enhanced with more detailed information and environment context
 */
export function logDatabaseConnectionInfo(url: string, context?: string): void {
  try {
    const parsedUrl = new URL(url);
    const searchParams = new URLSearchParams(parsedUrl.search);
    
    const connectionInfo = {
      context: context || 'database-connection',
      environment: process.env.NODE_ENV || 'development',
      connection: {
        host: parsedUrl.hostname,
        port: parsedUrl.port || '5432',
        database: parsedUrl.pathname.substring(1),
        username: parsedUrl.username,
        protocol: parsedUrl.protocol.replace(':', ''),
      },
      security: {
        ssl: searchParams.get('sslmode') || 'none',
        hasPassword: !!parsedUrl.password,
      },
      features: {
        pooling: searchParams.has('pgbouncer') || parsedUrl.hostname.includes('pool'),
        statementTimeout: searchParams.get('statement_timeout'),
        connectTimeout: searchParams.get('connect_timeout'),
      },
      metadata: {
        isLocalhost: parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1',
        isDigitalOcean: parsedUrl.hostname.includes('ondigitalocean.com'),
        isAWS: parsedUrl.hostname.includes('amazonaws.com'),
        urlLength: url.length,
      },
    };
    
    logger.info('Database connection configured', connectionInfo);
    
    // Log warnings for development
    if (process.env.NODE_ENV === 'development' && connectionInfo.metadata.isLocalhost) {
      logger.debug('Using local database for development', {
        hint: 'Ensure PostgreSQL is running locally',
      });
    }
    
    // Log info for production
    if (process.env.NODE_ENV === 'production') {
      logger.info('Production database connection established', {
        host: connectionInfo.connection.host,
        ssl: connectionInfo.security.ssl,
        pooling: connectionInfo.features.pooling,
      });
    }
    
  } catch (error) {
    logger.error('Failed to parse database URL for logging', {
      error: error instanceof Error ? error.message : String(error),
      urlLength: url.length,
      context,
    });
  }
}

/**
 * Helper function to get a safe database URL for logging (hides password)
 */
export function getSafeDatabaseUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.password) {
      parsedUrl.password = '***';
    }
    return parsedUrl.toString();
  } catch {
    // If URL parsing fails, just hide everything after username
    return url.replace(/:([^@]+)@/, ':***@');
  }
}

/**
 * Checks if a database URL is for a production database
 * Useful for adding extra safety checks
 */
export function isProductionDatabaseUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const productionIndicators = [
      'prod',
      'production',
      'live',
      'ondigitalocean.com',
      'amazonaws.com',
      'azure.com',
      'googleapis.com',
      'supabase.co',
      'neon.tech',
    ];
    
    return productionIndicators.some(indicator => 
      parsedUrl.hostname.toLowerCase().includes(indicator) ||
      parsedUrl.pathname.toLowerCase().includes(indicator)
    );
  } catch {
    return false;
  }
}

/**
 * Gets database connection options based on environment
 * Returns recommended settings for Prisma/connection pools
 */
export function getDatabaseConnectionOptions(url: string): Record<string, any> {
  const isProduction = process.env.NODE_ENV === 'production';
  const isProdUrl = isProductionDatabaseUrl(url);
  
  const options: Record<string, any> = {
    // Basic options
    connectionTimeoutMillis: isProduction ? 10000 : 5000,
    idleTimeoutMillis: isProduction ? 10000 : 30000,
    
    // Pool settings
    max: isProduction ? 25 : 10, // connection pool size
    min: isProduction ? 5 : 2,
    
    // Statement timeout (prevent long-running queries)
    statement_timeout: isProduction ? '30s' : '60s',
    
    // Lock timeout
    lock_timeout: '10s',
    
    // Idle in transaction timeout
    idle_in_transaction_session_timeout: isProduction ? '30s' : '60s',
  };
  
  // Add SSL settings if needed
  if (isProdUrl || isProduction) {
    options.ssl = {
      rejectUnauthorized: !url.includes('sslmode=disable'),
    };
  }
  
  logger.debug('Database connection options configured', {
    environment: process.env.NODE_ENV,
    isProductionUrl: isProdUrl,
    poolSize: `${options.min}-${options.max}`,
    timeouts: {
      connection: options.connectionTimeoutMillis,
      statement: options.statement_timeout,
      idle: options.idleTimeoutMillis,
    },
  });
  
  return options;
}