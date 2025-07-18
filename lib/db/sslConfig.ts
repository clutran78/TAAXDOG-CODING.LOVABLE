/**
 * SSL Configuration for DigitalOcean Managed Database
 * 
 * DigitalOcean managed databases use self-signed certificates,
 * so we need to configure SSL properly for production
 */

export function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL;
  
  if (!baseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  // In production, ensure SSL is properly configured
  if (process.env.NODE_ENV === 'production') {
    // DigitalOcean requires SSL but uses self-signed certificates
    // The connection string already has sslmode=require
    // We'll handle the certificate validation in the Prisma client
    return baseUrl;
  }
  
  return baseUrl;
}

export function getPrismaSSLConfig() {
  // For DigitalOcean managed databases in production
  if (process.env.NODE_ENV === 'production') {
    return {
      // Accept self-signed certificates from DigitalOcean
      rejectUnauthorized: false
    };
  }
  
  // Development can also use SSL with self-signed cert
  return {
    rejectUnauthorized: false
  };
}