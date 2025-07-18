# API Security Middleware Documentation

## Overview

This security middleware provides comprehensive protection for your API endpoints including:
- Rate limiting
- Request validation and sanitization
- Security headers (CSP, HSTS, etc.)
- CSRF protection
- API key management for external services

## Usage Examples

### 1. Basic Secured Endpoint

```typescript
import { secureApiEndpoint } from '@/lib/middleware/security';

export default secureApiEndpoint(async (req, res) => {
  // Your handler code
});
```

### 2. Auth Endpoint with Rate Limiting

```typescript
import { secureAuthEndpoint } from '@/lib/middleware/security';

export default secureAuthEndpoint(async (req, res) => {
  // 5 requests/minute rate limit applied automatically
});
```

### 3. Endpoint with Custom Validation

```typescript
import { withSecurity } from '@/lib/middleware/security';
import { body } from 'express-validator';

const validations = [
  body('email').isEmail().normalizeEmail(),
  body('amount').isFloat({ min: 0 }),
];

export default withSecurity(async (req, res) => {
  // Handler with validated inputs
}, { validations });
```

### 4. Public Endpoint (No Auth Required)

```typescript
import { securePublicEndpoint } from '@/lib/middleware/security';

export default securePublicEndpoint(async (req, res) => {
  // Public API endpoint
});
```

### 5. Custom Rate Limiting

```typescript
import { withSecurity } from '@/lib/middleware/security';

export default withSecurity(async (req, res) => {
  // Receipt processing with 10 req/min limit
}, { rateLimit: 'receipts' });
```

## Rate Limits

- **auth**: 5 requests/minute
- **goals**: 30 requests/minute
- **receipts**: 10 requests/minute
- **general**: 100 requests/minute (default)

## Common Validations

```typescript
import { commonValidations } from '@/lib/middleware/validation';

// Available validations:
- commonValidations.email
- commonValidations.password
- commonValidations.amount
- commonValidations.description
- commonValidations.abn (Australian Business Number)
- commonValidations.phoneNumber (Australian format)
- commonValidations.postcode (Australian 4-digit)
```

## External API Integration

```typescript
import { apiKeyManager } from '@/lib/services/apiKeyManager';

// Make secure API request
const response = await apiKeyManager.makeSecureRequest(
  'basiq', // service name
  'https://api.example.com/endpoint',
  { method: 'GET' }
);

// Get secure headers for manual requests
const headers = apiKeyManager.getSecureHeaders('stripe');
```

## Security Headers Applied

- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security (HSTS)
- Content-Security-Policy (CSP)
- Referrer-Policy
- Permissions-Policy

## Environment Variables Required

```env
# API Keys (store securely)
BASIQ_API_KEY=your-basiq-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENROUTER_API_KEY=your-openrouter-api-key
GEMINI_API_KEY=your-gemini-api-key
STRIPE_SECRET_KEY=your-stripe-secret-key

# Optional encryption secret for API keys
API_KEY_ENCRYPTION_SECRET=32-byte-hex-string
```