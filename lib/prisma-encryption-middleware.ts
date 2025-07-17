import { Prisma } from '@/generated/prisma';
import { encrypt, decrypt, encryptObject, decryptObject } from './encryption';

/**
 * Prisma middleware for automatic field-level encryption
 * Encrypts sensitive fields before writing to database
 * Decrypts sensitive fields after reading from database
 */

// Define which fields should be encrypted for each model
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  user: ['tfn', 'twoFactorSecret'], // password is hashed, not encrypted
  bankAccounts: ['accountNumber', 'bsb'],
  basiqUsers: ['mobile'],
  bankTransactions: ['description'], // Encrypt transaction descriptions for privacy
  receipts: ['taxInvoiceNumber', 'abn'], // Encrypt tax-sensitive data
};

// Models that contain encrypted fields
const MODELS_WITH_ENCRYPTION = Object.keys(ENCRYPTED_FIELDS);

/**
 * Create encryption middleware for Prisma
 */
export function createEncryptionMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    // Check if this model has encrypted fields
    const model = params.model?.toLowerCase();
    if (!model || !MODELS_WITH_ENCRYPTION.includes(model)) {
      return next(params);
    }

    const encryptedFields = ENCRYPTED_FIELDS[model];

    // Before writing to database - encrypt
    if (params.action === 'create' || params.action === 'update' || params.action === 'updateMany') {
      if (params.args.data) {
        params.args.data = encryptFields(params.args.data, encryptedFields);
      }
    }

    if (params.action === 'upsert') {
      if (params.args.create) {
        params.args.create = encryptFields(params.args.create, encryptedFields);
      }
      if (params.args.update) {
        params.args.update = encryptFields(params.args.update, encryptedFields);
      }
    }

    // Execute the query
    const result = await next(params);

    // After reading from database - decrypt
    if (result && (
      params.action === 'findUnique' ||
      params.action === 'findFirst' ||
      params.action === 'findMany' ||
      params.action === 'create' ||
      params.action === 'update' ||
      params.action === 'upsert'
    )) {
      if (Array.isArray(result)) {
        // Handle findMany
        return result.map(item => decryptFields(item, encryptedFields));
      } else {
        // Handle single results
        return decryptFields(result, encryptedFields);
      }
    }

    return result;
  };
}

/**
 * Encrypt specified fields in an object
 */
function encryptFields(data: any, fields: string[]): any {
  if (!data) return data;

  const encrypted = { ...data };
  
  for (const field of fields) {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      // Only encrypt if the field exists and is not null
      if (typeof encrypted[field] === 'string') {
        encrypted[field] = encrypt(encrypted[field]);
      }
    }
  }
  
  return encrypted;
}

/**
 * Decrypt specified fields in an object
 */
function decryptFields(data: any, fields: string[]): any {
  if (!data) return data;

  const decrypted = { ...data };
  
  for (const field of fields) {
    if (decrypted[field] !== undefined && decrypted[field] !== null) {
      // Only decrypt if the field exists and is not null
      if (typeof decrypted[field] === 'string') {
        try {
          decrypted[field] = decrypt(decrypted[field]);
        } catch (error) {
          // If decryption fails, log error but don't crash
          console.error(`Failed to decrypt field ${field}:`, error);
          // Leave the field as-is
        }
      }
    }
  }
  
  return decrypted;
}

/**
 * Helper to check if a value is already encrypted
 * (useful for migrations or data validation)
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  
  try {
    // Try to decode as base64
    const decoded = Buffer.from(value, 'base64');
    // Check if it has the expected structure (IV + TAG + data)
    return decoded.length >= 32; // Minimum length for encrypted data
  } catch {
    return false;
  }
}

/**
 * Batch encrypt multiple records
 * (useful for migrations)
 */
export async function batchEncryptRecords<T extends Record<string, any>>(
  records: T[],
  fieldsToEncrypt: string[]
): Promise<T[]> {
  return records.map(record => encryptFields(record, fieldsToEncrypt));
}

/**
 * Batch decrypt multiple records
 */
export async function batchDecryptRecords<T extends Record<string, any>>(
  records: T[],
  fieldsToDecrypt: string[]
): Promise<T[]> {
  return records.map(record => decryptFields(record, fieldsToDecrypt));
}

// Export configuration for reference
export const encryptionConfig = {
  encryptedFields: ENCRYPTED_FIELDS,
  modelsWithEncryption: MODELS_WITH_ENCRYPTION
};