import crypto from 'crypto';

export interface ApiKeyConfig {
  name: string;
  key: string;
  encrypted?: boolean;
  lastRotated?: Date;
  expiresAt?: Date;
}

class ApiKeyManager {
  private encryptionKey: string;
  private algorithm = 'aes-256-gcm';

  constructor() {
    const encryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET;
    
    if (!encryptionSecret) {
      throw new Error(
        'CRITICAL: API_KEY_ENCRYPTION_SECRET environment variable is not set. ' +
        'This is required for persistent encryption of API keys. ' +
        'Please set this variable to a 64-character hex string (32 bytes). ' +
        'You can generate one using: openssl rand -hex 32'
      );
    }
    
    // Validate the encryption key format
    if (!/^[0-9a-fA-F]{64}$/.test(encryptionSecret)) {
      throw new Error(
        'CRITICAL: API_KEY_ENCRYPTION_SECRET must be a 64-character hexadecimal string (32 bytes). ' +
        'Current value has incorrect format. ' +
        'Generate a valid key using: openssl rand -hex 32'
      );
    }
    
    this.encryptionKey = encryptionSecret;
  }

  private validateEncryptionKey(): void {
    if (!this.encryptionKey) {
      throw new Error('Encryption key is not set');
    }
    
    if (!/^[0-9a-fA-F]{64}$/.test(this.encryptionKey)) {
      throw new Error(
        'Invalid encryption key format. Expected 64-character hexadecimal string (32 bytes).'
      );
    }
  }

  private encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
    // Validate encryption key before use
    this.validateEncryptionKey();
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.encryptionKey, 'hex'), iv) as crypto.CipherGCM;
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  private decrypt(encrypted: string, iv: string, authTag: string): string {
    // Validate encryption key before use
    this.validateEncryptionKey();
    
    const decipher = crypto.createDecipheriv(
      this.algorithm, 
      Buffer.from(this.encryptionKey, 'hex'), 
      Buffer.from(iv, 'hex')
    ) as crypto.DecipherGCM;
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  public getApiKey(service: string): string | undefined {
    const envKey = `${service.toUpperCase()}_API_KEY`;
    const apiKey = process.env[envKey];
    
    if (!apiKey) {
      console.warn(`API key for ${service} not found in environment variables`);
      return undefined;
    }
    
    return apiKey;
  }

  public validateApiKey(providedKey: string, service: string): boolean {
    const storedKey = this.getApiKey(service);
    
    if (!storedKey) {
      return false;
    }

    
    // Convert keys to buffers for encryption
    const providedKeyBuffer = Buffer.from(providedKey, 'utf8');
    const storedKeyBuffer = Buffer.from(storedKey, 'utf8');
    
    // Check if lengths are equal to prevent timing attacks
    // timingSafeEqual requires buffers of equal length
    if (providedKeyBuffer.length !== storedKeyBuffer.length) {
      return false;
    }
    
    // Use timing-safe comparison for equal-length buffers
    return crypto.timingSafeEqual(providedKeyBuffer, storedKeyBuffer);
  }

  public rotateApiKey(service: string): string {
    const newKey = crypto.randomBytes(32).toString('hex');
    console.log(`New API key generated for ${service}. Please update your environment variables.`);
    return newKey;
  }

  public getSecureHeaders(service: string): Record<string, string> {
    const apiKey = this.getApiKey(service);
    
    if (!apiKey) {
      throw new Error(`API key for ${service} not configured`);
    }
    
    const headers: Record<string, string> = {};
    
    switch (service.toLowerCase()) {
      case 'basiq':
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['Accept'] = 'application/json';
        headers['Content-Type'] = 'application/json';
        headers['basiq-version'] = '3.0';
        break;
        
      case 'anthropic':
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['Content-Type'] = 'application/json';
        break;
        
      case 'openrouter':
        headers['Authorization'] = `Bearer ${apiKey}`;
        // Use public-facing URL to avoid exposing internal URLs
        headers['HTTP-Referer'] = 'https://taxreturnpro.com.au';
        headers['X-Title'] = 'TaxReturnPro';
        headers['Content-Type'] = 'application/json';
        break;
        
      case 'gemini':
        headers['x-goog-api-key'] = apiKey;
        headers['Content-Type'] = 'application/json';
        break;
        
      case 'stripe':
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['Stripe-Version'] = '2023-10-16';
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        break;
        
      default:
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['Content-Type'] = 'application/json';
    }
    
    return headers;
  }

  public async makeSecureRequest(
    service: string, 
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    const headers = this.getSecureHeaders(service);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    });
    
    if (!response.ok) {
      console.error(`API request to ${service} failed:`, response.status, response.statusText);
    }
    
    return response;
  }
}

export const apiKeyManager = new ApiKeyManager();
export default apiKeyManager;