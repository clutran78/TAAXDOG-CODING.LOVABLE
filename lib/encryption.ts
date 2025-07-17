import crypto from 'crypto';

/**
 * Field-level encryption for sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */

// Get encryption key from environment or generate one
const ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

// Ensure key is properly formatted
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, 'hex').length === KEY_LENGTH 
  ? Buffer.from(ENCRYPTION_KEY, 'hex')
  : crypto.scryptSync(ENCRYPTION_KEY, 'salt', KEY_LENGTH);

interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  salt?: string;
}

/**
 * Encrypt a string value
 */
export function encrypt(text: string): string {
  if (!text) return text;

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    // Combine iv + tag + encrypted data
    const combined = Buffer.concat([iv, tag, encrypted]);
    
    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt a string value
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;

  try {
    const combined = Buffer.from(encryptedText, 'base64');
    
    // Extract components
    const iv = combined.slice(0, IV_LENGTH);
    const tag = combined.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.slice(IV_LENGTH + TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash a value (one-way, for values that don't need to be retrieved)
 */
export function hash(text: string): string {
  if (!text) return text;
  
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.pbkdf2Sync(text, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  
  // Combine salt + hash
  const combined = Buffer.concat([salt, hash]);
  return combined.toString('base64');
}

/**
 * Verify a hashed value
 */
export function verifyHash(text: string, hashedText: string): boolean {
  if (!text || !hashedText) return false;
  
  try {
    const combined = Buffer.from(hashedText, 'base64');
    const salt = combined.slice(0, SALT_LENGTH);
    const originalHash = combined.slice(SALT_LENGTH);
    
    const hash = crypto.pbkdf2Sync(text, salt, ITERATIONS, KEY_LENGTH, 'sha256');
    
    return crypto.timingSafeEqual(originalHash, hash);
  } catch (error) {
    return false;
  }
}

/**
 * Encrypt an object's sensitive fields
 */
export function encryptObject<T extends Record<string, any>>(
  obj: T, 
  fieldsToEncrypt: (keyof T)[]
): T {
  const encrypted = { ...obj };
  
  for (const field of fieldsToEncrypt) {
    if (encrypted[field] && typeof encrypted[field] === 'string') {
      encrypted[field] = encrypt(encrypted[field] as string) as any;
    }
  }
  
  return encrypted;
}

/**
 * Decrypt an object's encrypted fields
 */
export function decryptObject<T extends Record<string, any>>(
  obj: T, 
  fieldsToDecrypt: (keyof T)[]
): T {
  const decrypted = { ...obj };
  
  for (const field of fieldsToDecrypt) {
    if (decrypted[field] && typeof decrypted[field] === 'string') {
      try {
        decrypted[field] = decrypt(decrypted[field] as string) as any;
      } catch (error) {
        // If decryption fails, leave the field as-is
        console.error(`Failed to decrypt field ${String(field)}`);
      }
    }
  }
  
  return decrypted;
}

/**
 * Generate a new encryption key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Mask sensitive data for display (e.g., show only last 4 digits)
 */
export function maskSensitiveData(value: string, visibleChars: number = 4): string {
  if (!value || value.length <= visibleChars) return value;
  
  const masked = '*'.repeat(value.length - visibleChars);
  const visible = value.slice(-visibleChars);
  
  return masked + visible;
}

/**
 * Encrypt data for storage in database
 */
export class FieldEncryption {
  private static SENSITIVE_FIELDS = {
    user: ['tfn', 'password', 'twoFactorSecret'],
    bankAccount: ['accountNumber', 'bsb'],
    basiqUser: ['mobile'],
  };

  /**
   * Encrypt user data before saving
   */
  static encryptUserData(userData: any): any {
    return encryptObject(userData, FieldEncryption.SENSITIVE_FIELDS.user);
  }

  /**
   * Decrypt user data after reading
   */
  static decryptUserData(userData: any): any {
    return decryptObject(userData, FieldEncryption.SENSITIVE_FIELDS.user);
  }

  /**
   * Encrypt bank account data
   */
  static encryptBankAccountData(accountData: any): any {
    return encryptObject(accountData, FieldEncryption.SENSITIVE_FIELDS.bankAccount);
  }

  /**
   * Decrypt bank account data
   */
  static decryptBankAccountData(accountData: any): any {
    return decryptObject(accountData, FieldEncryption.SENSITIVE_FIELDS.bankAccount);
  }
}

// Export for use in Prisma middleware
export default {
  encrypt,
  decrypt,
  hash,
  verifyHash,
  encryptObject,
  decryptObject,
  generateEncryptionKey,
  maskSensitiveData,
  FieldEncryption
};