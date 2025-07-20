"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
class ApiKeyManager {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        
        // Require encryption key from environment variable
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
    encrypt(text) {
        const iv = crypto_1.default.randomBytes(16);
        const cipher = crypto_1.default.createCipheriv(this.algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
        };
    }
    decrypt(encrypted, iv, authTag) {
        const decipher = crypto_1.default.createDecipheriv(this.algorithm, Buffer.from(this.encryptionKey, 'hex'), Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    getApiKey(service) {
        const envKey = `${service.toUpperCase()}_API_KEY`;
        const apiKey = process.env[envKey];
        if (!apiKey) {
            console.warn(`API key for ${service} not found in environment variables`);
            return undefined;
        }
        return apiKey;
    }
    validateApiKey(providedKey, service) {
        const storedKey = this.getApiKey(service);
        if (!storedKey) {
            return false;
        }
        // Use timing-safe comparison
        return crypto_1.default.timingSafeEqual(Buffer.from(providedKey), Buffer.from(storedKey));
    }
    rotateApiKey(service) {
        const newKey = crypto_1.default.randomBytes(32).toString('hex');
        console.log(`New API key generated for ${service}. Please update your environment variables.`);
        return newKey;
    }
    getSecureHeaders(service) {
        const apiKey = this.getApiKey(service);
        if (!apiKey) {
            throw new Error(`API key for ${service} not configured`);
        }
        const headers = {};
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
                headers['HTTP-Referer'] = process.env.NEXTAUTH_URL || 'https://taxreturnpro.com.au';
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
    async makeSecureRequest(service, url, options = {}) {
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
exports.apiKeyManager = new ApiKeyManager();
exports.default = exports.apiKeyManager;
