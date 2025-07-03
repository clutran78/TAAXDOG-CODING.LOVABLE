import crypto from 'crypto';

// Encryption configuration
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  tagLength: 16,
  saltLength: 32,
  iterations: 100000,
};

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!key) {
    throw new Error('Encryption key not configured');
  }
  
  // Derive a proper key from the secret
  return crypto.pbkdf2Sync(
    key,
    'taaxdog-encryption-salt',
    ENCRYPTION_CONFIG.iterations,
    ENCRYPTION_CONFIG.keyLength,
    'sha256',
  );
}

// Encrypt sensitive data (e.g., TFN, bank details)
export function encryptData(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
  
  const cipher = crypto.createCipheriv(
    ENCRYPTION_CONFIG.algorithm,
    key,
    iv,
  );
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  const tag = cipher.getAuthTag();
  
  // Combine iv + tag + encrypted data
  const combined = Buffer.concat([iv, tag, encrypted]);
  
  return combined.toString('base64');
}

// Decrypt sensitive data
export function decryptData(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');
  
  // Extract components
  const iv = combined.slice(0, ENCRYPTION_CONFIG.ivLength);
  const tag = combined.slice(
    ENCRYPTION_CONFIG.ivLength,
    ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.tagLength,
  );
  const encrypted = combined.slice(
    ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.tagLength,
  );
  
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_CONFIG.algorithm,
    key,
    iv,
  );
  
  decipher.setAuthTag(tag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  
  return decrypted.toString('utf8');
}

// Hash sensitive data for comparison (e.g., API keys)
export function hashData(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

// Generate secure random tokens
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// Mask sensitive data for display
export function maskSensitiveData(
  data: string,
  showFirst: number = 4,
  showLast: number = 4,
): string {
  if (data.length <= showFirst + showLast) {
    return '*'.repeat(data.length);
  }
  
  const first = data.slice(0, showFirst);
  const last = data.slice(-showLast);
  const masked = '*'.repeat(data.length - showFirst - showLast);
  
  return `${first}${masked}${last}`;
}

// Encrypt TFN specifically (with additional validation)
export function encryptTFN(tfn: string): string | null {
  // Remove spaces and validate format
  const cleanTFN = tfn.replace(/\s/g, '');
  if (!/^\d{8,9}$/.test(cleanTFN)) {
    return null;
  }
  
  return encryptData(cleanTFN);
}

// Decrypt TFN
export function decryptTFN(encryptedTFN: string): string | null {
  try {
    const tfn = decryptData(encryptedTFN);
    // Re-validate after decryption
    if (!/^\d{8,9}$/.test(tfn)) {
      return null;
    }
    return tfn;
  } catch (error) {
    console.error('TFN decryption failed:', error);
    return null;
  }
}

// Encrypt bank account details
export interface BankAccountDetails {
  accountNumber: string;
  bsb: string;
}

export function encryptBankAccount(details: BankAccountDetails): string {
  const combined = `${details.bsb}|${details.accountNumber}`;
  return encryptData(combined);
}

// Decrypt bank account details
export function decryptBankAccount(encrypted: string): BankAccountDetails | null {
  try {
    const decrypted = decryptData(encrypted);
    const [bsb, accountNumber] = decrypted.split('|');
    
    if (!bsb || !accountNumber) {
      return null;
    }
    
    return { bsb, accountNumber };
  } catch (error) {
    console.error('Bank account decryption failed:', error);
    return null;
  }
}

// API key encryption/decryption for storage
export function encryptAPIKey(apiKey: string): {
  encrypted: string;
  keyHash: string;
} {
  return {
    encrypted: encryptData(apiKey),
    keyHash: hashData(apiKey),
  };
}

export function decryptAPIKey(encrypted: string): string | null {
  try {
    return decryptData(encrypted);
  } catch (error) {
    console.error('API key decryption failed:', error);
    return null;
  }
}

// Password strength validation
export function validatePasswordStrength(password: string): {
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;
  
  // Length check
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  else feedback.push('Use at least 12 characters');
  
  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Include lowercase letters');
  
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Include uppercase letters');
  
  if (/\d/.test(password)) score += 1;
  else feedback.push('Include numbers');
  
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else feedback.push('Include special characters');
  
  // Common patterns check
  const commonPatterns = [
    /123/,
    /abc/i,
    /password/i,
    /qwerty/i,
    /admin/i,
  ];
  
  if (!commonPatterns.some(pattern => pattern.test(password))) {
    score += 1;
  } else {
    feedback.push('Avoid common patterns');
  }
  
  return {
    score: Math.min(score, 5), // Max score of 5
    feedback,
  };
}

// Time-based one-time password (TOTP) for 2FA
export function generateTOTPSecret(): {
  secret: string;
  qrCode: string;
} {
  const secret = generateSecureToken(20);
  const appName = 'TaxReturnPro';
  const qrCode = `otpauth://totp/${appName}?secret=${secret}`;
  
  return { secret, qrCode };
}

export function verifyTOTP(token: string, secret: string): boolean {
  // Simplified TOTP verification
  // In production, use a proper TOTP library like 'speakeasy'
  const time = Math.floor(Date.now() / 30000);
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(Buffer.from([0, 0, 0, 0, time]));
  const hash = hmac.digest();
  const offset = hash[hash.length - 1] & 0xf;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, '0') === token;
}