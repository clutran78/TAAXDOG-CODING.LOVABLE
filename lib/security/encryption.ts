import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const KEY_LENGTH = 32; // 256 bits
const ITERATIONS = 100000; // PBKDF2 iterations

// Key rotation tracking
const CURRENT_KEY_VERSION = 1;
const KEY_ROTATION_DAYS = 90;

// Australian compliance constants
const TFN_LENGTH = 9;
const ABN_LENGTH = 11;
const BSB_LENGTH = 6;

// Encryption field types
export enum EncryptionFieldType {
  TFN = 'TFN',
  ABN = 'ABN',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  BSB = 'BSB',
  CREDIT_CARD = 'CREDIT_CARD',
  MEDICARE = 'MEDICARE',
  PASSPORT = 'PASSPORT',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  GENERIC_SENSITIVE = 'GENERIC_SENSITIVE',
}

// Compliance standards
export enum ComplianceStandard {
  AUSTRALIAN_PRIVACY_ACT = 'AUSTRALIAN_PRIVACY_ACT',
  ATO_REQUIREMENTS = 'ATO_REQUIREMENTS',
  PCI_DSS = 'PCI_DSS',
  APRA_STANDARDS = 'APRA_STANDARDS',
}

// Encrypted data format
export interface EncryptedData {
  version: number;
  algorithm: string;
  iv: string;
  tag: string;
  salt: string;
  data: string;
  fieldType?: EncryptionFieldType;
  metadata?: {
    encryptedAt: string;
    expiresAt?: string;
    compliance?: ComplianceStandard[];
  };
}

// Encryption result
export interface EncryptionResult {
  encrypted: string;
  keyVersion: number;
  fieldType?: EncryptionFieldType;
  metadata?: Record<string, any>;
}

// Validation schemas
const tfnSchema = z.string().regex(/^\d{9}$/, 'TFN must be exactly 9 digits');
const abnSchema = z.string().regex(/^\d{11}$/, 'ABN must be exactly 11 digits');
const bsbSchema = z.string().regex(/^\d{6}$/, 'BSB must be exactly 6 digits');
const accountNumberSchema = z.string().regex(/^\d{5,9}$/, 'Account number must be 5-9 digits');

/**
 * Encryption utility class for sensitive data with Australian compliance
 */
export class EncryptionService {
  private static instance: EncryptionService;
  private masterKey: Buffer;
  private keyCache: Map<string, Buffer> = new Map();

  private constructor() {
    // Get master key from environment
    const keyBase64 = process.env.FIELD_ENCRYPTION_KEY;
    if (!keyBase64) {
      throw new Error('FIELD_ENCRYPTION_KEY environment variable is not set');
    }

    try {
      this.masterKey = Buffer.from(keyBase64, 'base64');
      if (this.masterKey.length !== KEY_LENGTH) {
        throw new Error(
          `Invalid encryption key length: expected ${KEY_LENGTH}, got ${this.masterKey.length}`,
        );
      }
    } catch (error) {
      logger.error('Failed to initialize encryption service', { error });
      throw new Error('Failed to initialize encryption service');
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Encrypt sensitive data
   */
  public async encrypt(
    data: string,
    fieldType?: EncryptionFieldType,
    metadata?: Record<string, any>,
  ): Promise<EncryptionResult> {
    if (!data) {
      throw new Error('Cannot encrypt empty data');
    }

    try {
      // Validate data based on field type
      if (fieldType) {
        this.validateFieldData(data, fieldType);
      }

      // Generate random IV and salt
      const iv = crypto.randomBytes(IV_LENGTH);
      const salt = crypto.randomBytes(SALT_LENGTH);

      // Derive encryption key from master key and salt
      const key = await this.deriveKey(this.masterKey, salt);

      // Create cipher
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

      // Encrypt data
      const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);

      // Get authentication tag
      const tag = cipher.getAuthTag();

      // Build encrypted data structure
      const encryptedData: EncryptedData = {
        version: CURRENT_KEY_VERSION,
        algorithm: ENCRYPTION_ALGORITHM,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        salt: salt.toString('base64'),
        data: encrypted.toString('base64'),
        fieldType,
        metadata: {
          encryptedAt: new Date().toISOString(),
          compliance: this.getComplianceStandards(fieldType),
          ...metadata,
        },
      };

      // Serialize to string
      const serialized = JSON.stringify(encryptedData);
      const encoded = Buffer.from(serialized).toString('base64');

      logger.debug('Data encrypted successfully', {
        fieldType,
        keyVersion: CURRENT_KEY_VERSION,
        dataLength: data.length,
      });

      return {
        encrypted: encoded,
        keyVersion: CURRENT_KEY_VERSION,
        fieldType,
        metadata,
      };
    } catch (error) {
      logger.error('Encryption failed', { error, fieldType });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  public async decrypt(encryptedData: string): Promise<string> {
    if (!encryptedData) {
      throw new Error('Cannot decrypt empty data');
    }

    try {
      // Decode and parse encrypted data
      const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
      const parsed: EncryptedData = JSON.parse(decoded);

      // Validate structure
      if (!parsed.version || !parsed.iv || !parsed.tag || !parsed.salt || !parsed.data) {
        throw new Error('Invalid encrypted data structure');
      }

      // Check key version
      if (parsed.version > CURRENT_KEY_VERSION) {
        throw new Error(`Unsupported key version: ${parsed.version}`);
      }

      // Convert from base64
      const iv = Buffer.from(parsed.iv, 'base64');
      const tag = Buffer.from(parsed.tag, 'base64');
      const salt = Buffer.from(parsed.salt, 'base64');
      const encrypted = Buffer.from(parsed.data, 'base64');

      // Derive decryption key
      const key = await this.deriveKey(this.masterKey, salt);

      // Create decipher
      const decipher = crypto.createDecipheriv(parsed.algorithm || ENCRYPTION_ALGORITHM, key, iv);
      (decipher as any).setAuthTag(tag);

      // Decrypt data
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      const result = decrypted.toString('utf8');

      logger.debug('Data decrypted successfully', {
        fieldType: parsed.fieldType,
        keyVersion: parsed.version,
      });

      return result;
    } catch (error) {
      logger.error('Decryption failed', { error });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt TFN with validation
   */
  public async encryptTFN(tfn: string): Promise<EncryptionResult> {
    // Remove spaces and validate
    const cleanTFN = tfn.replace(/\s/g, '');

    if (!this.validateTFN(cleanTFN)) {
      throw new Error('Invalid TFN format or checksum');
    }

    return this.encrypt(cleanTFN, EncryptionFieldType.TFN, {
      validatedAt: new Date().toISOString(),
      checksum: this.calculateTFNChecksum(cleanTFN),
    });
  }

  /**
   * Encrypt ABN with validation
   */
  public async encryptABN(abn: string): Promise<EncryptionResult> {
    // Remove spaces and validate
    const cleanABN = abn.replace(/\s/g, '');

    if (!this.validateABN(cleanABN)) {
      throw new Error('Invalid ABN format or checksum');
    }

    return this.encrypt(cleanABN, EncryptionFieldType.ABN, {
      validatedAt: new Date().toISOString(),
      checksum: this.calculateABNChecksum(cleanABN),
    });
  }

  /**
   * Encrypt bank account details
   */
  public async encryptBankAccount(bsb: string, accountNumber: string): Promise<EncryptionResult> {
    // Clean and validate
    const cleanBSB = bsb.replace(/[-\s]/g, '');
    const cleanAccount = accountNumber.replace(/\s/g, '');

    bsbSchema.parse(cleanBSB);
    accountNumberSchema.parse(cleanAccount);

    const combined = `${cleanBSB}|${cleanAccount}`;

    return this.encrypt(combined, EncryptionFieldType.BANK_ACCOUNT, {
      validatedAt: new Date().toISOString(),
      bsbBank: this.getBankFromBSB(cleanBSB),
    });
  }

  /**
   * Mask sensitive data for display
   */
  public mask(data: string, fieldType: EncryptionFieldType): string {
    if (!data) return '';

    switch (fieldType) {
      case EncryptionFieldType.TFN:
        // Show: XXX XXX 789
        return data.length >= 3 ? `XXX XXX ${data.slice(-3)}` : 'XXX XXX XXX';

      case EncryptionFieldType.ABN:
        // Show: XX XXX XXX 901
        return data.length >= 3 ? `XX XXX XXX ${data.slice(-3)}` : 'XX XXX XXX XXX';

      case EncryptionFieldType.BANK_ACCOUNT:
        // Show: ***-*** ****1234
        const parts = data.split('|');
        if (parts.length === 2 && parts[1].length >= 4) {
          return `***-*** ****${parts[1].slice(-4)}`;
        }
        return '***-*** ********';

      case EncryptionFieldType.CREDIT_CARD:
        // Show: **** **** **** 1234
        return data.length >= 4 ? `**** **** **** ${data.slice(-4)}` : '**** **** **** ****';

      case EncryptionFieldType.MEDICARE:
        // Show: XXXX XXXXX 1
        return data.length >= 1 ? `XXXX XXXXX ${data.slice(-1)}` : 'XXXX XXXXX X';

      default:
        // Generic masking - show last 3 characters
        return data.length > 3
          ? '*'.repeat(data.length - 3) + data.slice(-3)
          : '*'.repeat(data.length);
    }
  }

  /**
   * Generate secure hash of sensitive data for indexing
   */
  public async hash(data: string, fieldType?: EncryptionFieldType): Promise<string> {
    if (!data) {
      throw new Error('Cannot hash empty data');
    }

    // Use HMAC with field type as additional context
    const hmac = crypto.createHmac('sha256', this.masterKey);
    hmac.update(data);

    if (fieldType) {
      hmac.update(fieldType);
    }

    return hmac.digest('hex');
  }

  /**
   * Validate field data based on type
   */
  private validateFieldData(data: string, fieldType: EncryptionFieldType): void {
    switch (fieldType) {
      case EncryptionFieldType.TFN:
        tfnSchema.parse(data);
        if (!this.validateTFN(data)) {
          throw new Error('Invalid TFN checksum');
        }
        break;

      case EncryptionFieldType.ABN:
        abnSchema.parse(data);
        if (!this.validateABN(data)) {
          throw new Error('Invalid ABN checksum');
        }
        break;

      case EncryptionFieldType.BSB:
        bsbSchema.parse(data);
        break;

      case EncryptionFieldType.BANK_ACCOUNT:
        // Expect format: BSB|AccountNumber
        const parts = data.split('|');
        if (parts.length !== 2) {
          throw new Error('Invalid bank account format');
        }
        bsbSchema.parse(parts[0]);
        accountNumberSchema.parse(parts[1]);
        break;
    }
  }

  /**
   * Validate TFN using ATO algorithm
   */
  private validateTFN(tfn: string): boolean {
    if (tfn.length !== TFN_LENGTH) return false;

    const weights = [1, 4, 3, 7, 5, 8, 6, 9, 10];
    let sum = 0;

    for (let i = 0; i < TFN_LENGTH; i++) {
      sum += parseInt(tfn[i]) * weights[i];
    }

    return sum % 11 === 0;
  }

  /**
   * Calculate TFN checksum
   */
  private calculateTFNChecksum(tfn: string): string {
    const weights = [1, 4, 3, 7, 5, 8, 6, 9, 10];
    let sum = 0;

    for (let i = 0; i < TFN_LENGTH; i++) {
      sum += parseInt(tfn[i]) * weights[i];
    }

    return (sum % 11).toString();
  }

  /**
   * Validate ABN using ATO algorithm
   */
  private validateABN(abn: string): boolean {
    if (abn.length !== ABN_LENGTH) return false;

    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    let sum = 0;

    // Subtract 1 from first digit
    const firstDigit = parseInt(abn[0]) - 1;
    sum += firstDigit * weights[0];

    // Process remaining digits
    for (let i = 1; i < ABN_LENGTH; i++) {
      sum += parseInt(abn[i]) * weights[i];
    }

    return sum % 89 === 0;
  }

  /**
   * Calculate ABN checksum
   */
  private calculateABNChecksum(abn: string): string {
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    let sum = 0;

    const firstDigit = parseInt(abn[0]) - 1;
    sum += firstDigit * weights[0];

    for (let i = 1; i < ABN_LENGTH; i++) {
      sum += parseInt(abn[i]) * weights[i];
    }

    return (sum % 89).toString();
  }

  /**
   * Get bank name from BSB (simplified)
   */
  private getBankFromBSB(bsb: string): string {
    const firstTwo = bsb.substring(0, 2);

    const bankMap: Record<string, string> = {
      '01': 'ANZ',
      '03': 'Westpac',
      '06': 'Commonwealth Bank',
      '08': 'National Australia Bank',
      '11': 'St George Bank',
      '30': 'BankWest',
      '48': 'Macquarie Bank',
      '73': 'ING',
      '94': 'Bank of Queensland',
    };

    return bankMap[firstTwo] || 'Unknown Bank';
  }

  /**
   * Derive encryption key from master key and salt
   */
  private async deriveKey(masterKey: Buffer, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }

  /**
   * Get compliance standards for field type
   */
  private getComplianceStandards(fieldType?: EncryptionFieldType): ComplianceStandard[] {
    if (!fieldType) return [ComplianceStandard.AUSTRALIAN_PRIVACY_ACT];

    const standards: Record<EncryptionFieldType, ComplianceStandard[]> = {
      [EncryptionFieldType.TFN]: [
        ComplianceStandard.AUSTRALIAN_PRIVACY_ACT,
        ComplianceStandard.ATO_REQUIREMENTS,
      ],
      [EncryptionFieldType.ABN]: [
        ComplianceStandard.AUSTRALIAN_PRIVACY_ACT,
        ComplianceStandard.ATO_REQUIREMENTS,
      ],
      [EncryptionFieldType.BANK_ACCOUNT]: [
        ComplianceStandard.AUSTRALIAN_PRIVACY_ACT,
        ComplianceStandard.APRA_STANDARDS,
      ],
      [EncryptionFieldType.BSB]: [
        ComplianceStandard.AUSTRALIAN_PRIVACY_ACT,
        ComplianceStandard.APRA_STANDARDS,
      ],
      [EncryptionFieldType.CREDIT_CARD]: [
        ComplianceStandard.AUSTRALIAN_PRIVACY_ACT,
        ComplianceStandard.PCI_DSS,
      ],
      [EncryptionFieldType.MEDICARE]: [ComplianceStandard.AUSTRALIAN_PRIVACY_ACT],
      [EncryptionFieldType.PASSPORT]: [ComplianceStandard.AUSTRALIAN_PRIVACY_ACT],
      [EncryptionFieldType.DRIVERS_LICENSE]: [ComplianceStandard.AUSTRALIAN_PRIVACY_ACT],
      [EncryptionFieldType.GENERIC_SENSITIVE]: [ComplianceStandard.AUSTRALIAN_PRIVACY_ACT],
    };

    return standards[fieldType] || [ComplianceStandard.AUSTRALIAN_PRIVACY_ACT];
  }

  /**
   * Check if key rotation is needed
   */
  public isKeyRotationNeeded(): boolean {
    const keyCreatedAt = process.env.ENCRYPTION_KEY_CREATED_AT;
    if (!keyCreatedAt) return true;

    const createdDate = new Date(keyCreatedAt);
    const daysSinceCreation = Math.floor(
      (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return daysSinceCreation >= KEY_ROTATION_DAYS;
  }

  /**
   * Generate new encryption key for rotation
   */
  public generateNewKey(): string {
    const newKey = crypto.randomBytes(KEY_LENGTH);
    return newKey.toString('base64');
  }

  /**
   * Re-encrypt data with new key
   */
  public async reencrypt(encryptedData: string, newKey: Buffer): Promise<string> {
    // Decrypt with current key
    const decrypted = await this.decrypt(encryptedData);

    // Temporarily switch to new key
    const oldKey = this.masterKey;
    this.masterKey = newKey;

    try {
      // Encrypt with new key
      const result = await this.encrypt(decrypted);
      return result.encrypted;
    } finally {
      // Restore old key
      this.masterKey = oldKey;
    }
  }

  /**
   * Generate compliance report
   */
  public generateComplianceReport(): {
    encryptionAlgorithm: string;
    keyLength: number;
    keyRotationDays: number;
    currentKeyVersion: number;
    keyRotationNeeded: boolean;
    supportedFieldTypes: string[];
    complianceStandards: string[];
  } {
    return {
      encryptionAlgorithm: ENCRYPTION_ALGORITHM,
      keyLength: KEY_LENGTH * 8, // Convert to bits
      keyRotationDays: KEY_ROTATION_DAYS,
      currentKeyVersion: CURRENT_KEY_VERSION,
      keyRotationNeeded: this.isKeyRotationNeeded(),
      supportedFieldTypes: Object.values(EncryptionFieldType),
      complianceStandards: Object.values(ComplianceStandard),
    };
  }
}

// Export singleton instance
export const encryptionService = EncryptionService.getInstance();

// Export helper functions for backward compatibility
export async function encryptField(data: string, fieldType?: EncryptionFieldType): Promise<string> {
  const result = await encryptionService.encrypt(data, fieldType);
  return result.encrypted;
}

export async function decryptField(encryptedData: string): Promise<string> {
  return encryptionService.decrypt(encryptedData);
}

export function maskSensitiveData(data: string, fieldType: EncryptionFieldType): string {
  return encryptionService.mask(data, fieldType);
}

export async function hashSensitiveData(
  data: string,
  fieldType?: EncryptionFieldType,
): Promise<string> {
  return encryptionService.hash(data, fieldType);
}

// Utility functions for specific use cases
export const tfnUtils = {
  encrypt: (tfn: string) => encryptionService.encryptTFN(tfn),
  mask: (tfn: string) => encryptionService.mask(tfn, EncryptionFieldType.TFN),
  hash: (tfn: string) => encryptionService.hash(tfn, EncryptionFieldType.TFN),
};

export const abnUtils = {
  encrypt: (abn: string) => encryptionService.encryptABN(abn),
  mask: (abn: string) => encryptionService.mask(abn, EncryptionFieldType.ABN),
  hash: (abn: string) => encryptionService.hash(abn, EncryptionFieldType.ABN),
};

export const bankAccountUtils = {
  encrypt: (bsb: string, accountNumber: string) =>
    encryptionService.encryptBankAccount(bsb, accountNumber),
  mask: (combined: string) => encryptionService.mask(combined, EncryptionFieldType.BANK_ACCOUNT),
  hash: (combined: string) => encryptionService.hash(combined, EncryptionFieldType.BANK_ACCOUNT),
};
