import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '@/lib/logger';

export interface SSLConfig {
  rejectUnauthorized: boolean;
  ca?: string;
  checkServerIdentity?: () => undefined;
}

export function getProductionSSLConfig(): SSLConfig {
  // DigitalOcean managed databases use self-signed certificates
  // We need to configure SSL properly for production
  const sslConfig: SSLConfig = {
    rejectUnauthorized: false, // Required for DigitalOcean managed databases
  };

  // If you have a CA certificate from DigitalOcean, uncomment and use:
  // try {
  //   sslConfig.ca = readFileSync(join(__dirname, 'ca-certificate.crt')).toString();
  //   sslConfig.rejectUnauthorized = true;
  // } catch (error) {
  //   logger.warn('CA certificate not found, using rejectUnauthorized: false');
  // }

  return sslConfig;
}

export function getDevelopmentSSLConfig(): SSLConfig | false {
  // No SSL for local development
  return false;
}
