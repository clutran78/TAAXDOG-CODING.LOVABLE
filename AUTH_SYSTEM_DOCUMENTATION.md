# Authentication System Documentation

## Overview

A complete authentication system for the TAAXDOG Next.js application with PostgreSQL, implementing secure user registration, login, password reset, and email verification.

## Features

- **User Registration** with email verification
- **Secure Login** with JWT tokens and HttpOnly cookies
- **Password Reset** via email tokens
- **Email Verification** with expiring tokens
- **Account Lockout** after failed login attempts
- **Rate Limiting** on all auth endpoints
- **CSRF Protection** for state-changing operations
- **Role-Based Access Control** (USER, ADMIN, ACCOUNTANT, SUPPORT)
- **Session Management** with automatic cleanup
- **Comprehensive Audit Logging**

## Security Features

### Password Security
- Bcrypt hashing with 12 salt rounds
- Password strength validation:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
- Password history check (prevents reuse)

### Rate Limiting
- **Auth endpoints**: 5 requests per minute
- **Password reset**: 3 requests per hour
- **Email verification**: 3 requests per minute
- **General API**: 100 requests per minute

### Account Security
- Account lockout after 5 failed login attempts
- Exponential backoff for lockout duration
- Email verification required for login
- IP tracking for all auth events
- Comprehensive audit logging

## API Endpoints

### 1. Register - `POST /api/auth/register`
```json
// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "phone": "+61412345678", // Optional
  "abn": "12345678901", // Optional
  "taxResidency": "RESIDENT", // Optional
  "privacyConsent": { // Optional
    "termsAccepted": true,
    "privacyPolicyAccepted": true,
    "dataCollectionConsent": true,
    "marketingOptIn": false
  }
}

// Response
{
  "message": "Account created successfully. Please check your email to verify your account.",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "requiresVerification": true
}
```

### 2. Login - `POST /api/auth/login`
```json
// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

// Response
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  },
  "requiresTwoFactor": false
}
```

### 3. Logout - `POST /api/auth/logout`
```json
// Request
{} // No body required

// Response
{
  "message": "Logout successful"
}
```

### 4. Forgot Password - `POST /api/auth/forgot-password`
```json
// Request
{
  "email": "user@example.com"
}

// Response
{
  "message": "If an account exists with this email, you will receive password reset instructions."
}
```

### 5. Reset Password - `POST /api/auth/reset-password`
```json
// Request
{
  "token": "reset-token-from-email",
  "password": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}

// Response
{
  "message": "Password reset successfully. You can now login with your new password.",
  "success": true
}
```

### 6. Verify Email - `POST /api/auth/verify-email`
```json
// Request
{
  "token": "verification-token-from-email"
}

// Response
{
  "message": "Email verified successfully! You can now access all features.",
  "success": true
}
```

## Middleware Usage

### Protected Routes
```typescript
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

// Basic authentication
export default withAuth(async (req: AuthenticatedRequest, res) => {
  // req.user is available here
  const userId = req.user.id;
  // ... your handler logic
});

// With role restrictions
export default withAuth(async (req: AuthenticatedRequest, res) => {
  // Only ADMIN users can access
  // ... your handler logic
}, { allowedRoles: [Role.ADMIN] });

// Without email verification requirement
export default withAuth(async (req: AuthenticatedRequest, res) => {
  // ... your handler logic
}, { requireVerifiedEmail: false });
```

### Role-Based Shortcuts
```typescript
import { withUser, withAdmin, withAccountant } from '@/lib/auth/middleware';

// User role (any authenticated user)
export default withUser(async (req, res) => {
  // ... handler logic
});

// Admin only
export default withAdmin(async (req, res) => {
  // ... handler logic
});

// Accountant or Admin
export default withAccountant(async (req, res) => {
  // ... handler logic
});
```

### CSRF Protection
```typescript
import { csrfProtection } from '@/lib/auth/csrf-protection';

// Automatic CSRF protection
export default withAuth(async (req, res) => {
  // CSRF is automatically validated for POST/PUT/PATCH/DELETE
  // ... handler logic
});

// Manual CSRF protection
export default csrfProtection(async (req, res) => {
  // ... handler logic
});
```

## Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Database
DATABASE_URL=postgresql://user:pass@host:port/db
PRODUCTION_DATABASE_URL=postgresql://user:pass@host:port/db

# Email Service
SENDGRID_API_KEY=your-sendgrid-key

# Application
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
NODE_ENV=development
```

## Database Schema

The authentication system adds the following fields to the User model:

```prisma
model User {
  // ... existing fields ...
  
  // Email verification
  emailVerificationToken String?   @unique
  emailVerificationExpires DateTime?
  
  // Password reset
  passwordResetToken String?       @unique
  passwordResetExpires DateTime?
  
  // Security fields (existing)
  failedLoginAttempts Int         @default(0)
  lockedUntil     DateTime?
  lastLoginAt     DateTime?
  lastLoginIp     String?
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "errors": { // Optional validation errors
    "field": ["Error message 1", "Error message 2"]
  }
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (authenticated but not authorized)
- `404` - Not Found
- `409` - Conflict (e.g., email already exists)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Testing

Use the test script to verify the authentication system:

```bash
npm run test:auth
```

Or test individual endpoints:

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

## Migration Notes

1. Run Prisma migrations to add new fields:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

2. Update any existing authentication code to use the new endpoints

3. Configure email service for verification and password reset emails

4. Set up environment variables for production

## Security Best Practices

1. Always use HTTPS in production
2. Set secure cookie flags in production
3. Implement proper CORS configuration
4. Monitor failed login attempts and suspicious activity
5. Regularly review audit logs
6. Keep dependencies updated
7. Use strong JWT secrets (minimum 32 characters)
8. Implement proper session timeout
9. Enable 2FA for admin accounts
10. Regular security audits