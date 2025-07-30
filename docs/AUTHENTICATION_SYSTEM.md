# 🔒 TAAXDOG Authentication System Documentation

## ⚠️ CRITICAL: DO NOT MODIFY WITHOUT THOROUGH REVIEW

This document describes the authentication system implementation. These patterns MUST be maintained to ensure system security and functionality.

## Table of Contents
1. [Overview](#overview)
2. [User Registration](#user-registration)
3. [User Login](#user-login)
4. [Password Reset](#password-reset)
5. [Security Features](#security-features)
6. [Critical Implementation Details](#critical-implementation-details)
7. [Common Pitfalls](#common-pitfalls)

## Overview

The TAAXDOG authentication system uses:
- **NextAuth.js** for session management
- **bcrypt** for password hashing (12 rounds)
- **SHA256** for password reset token hashing
- **PostgreSQL** with Prisma ORM for data storage
- **Rate limiting** on all authentication endpoints

## User Registration

### Flow
1. User submits email, password, and name
2. Input validation and sanitization
3. Check for existing user
4. Hash password with bcrypt (12 rounds)
5. Create user record
6. Generate email verification token
7. Send verification email
8. Create audit log entry

### Critical Code
```typescript
// Password hashing - DO NOT CHANGE
const BCRYPT_ROUNDS = 12;
const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
```

### Database Fields
- `user.password` - bcrypt hashed password
- `user.emailVerified` - timestamp when email was verified
- `user.emailVerificationToken` - verification token (if using email verification)

## User Login

### Flow
1. User submits email and password
2. Rate limiting check
3. Find user by email
4. Check account lock status
5. Verify password with bcrypt
6. Update failed attempts counter
7. Create session with NextAuth
8. Log authentication event

### Critical Configuration
```typescript
// Account locking - DO NOT CHANGE
const MAX_FAILED_ATTEMPTS = 4;
const ACCOUNT_LOCK_DURATION_MINUTES = 15;
```

### Session Management
- JWT strategy with 30-day max age
- Secure cookies in production
- Session includes: user ID, email, role, emailVerified

## Password Reset

### ⚠️ CRITICAL: Token Generation and Validation

The password reset system uses SHA256 hashing. This MUST NOT be changed to bcrypt or any other algorithm.

### Token Generation Flow
```typescript
// CRITICAL: Must use SHA256, not bcrypt!
const token = crypto.randomBytes(32).toString('hex');
const hashedToken = crypto
  .createHash('sha256')
  .update(token)
  .digest('hex');

// Store in user table
await prisma.user.update({
  where: { id: user.id },
  data: {
    passwordResetToken: hashedToken,
    passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour
  },
});
```

### Token Validation Flow
```typescript
// Hash the provided token
const hashedToken = crypto
  .createHash('sha256')
  .update(providedToken)
  .digest('hex');

// Find user with matching token
const user = await prisma.user.findFirst({
  where: {
    passwordResetToken: hashedToken,
    passwordResetExpires: { gt: new Date() },
  },
});
```

### Database Fields
- `user.passwordResetToken` - SHA256 hashed token
- `user.passwordResetExpires` - Token expiration timestamp

## Security Features

### Rate Limiting
All authentication endpoints use rate limiting:
- Login: 5 attempts per 15 minutes
- Registration: 3 per hour
- Password Reset: 5 per hour
- Reset Password: 5 per 5 minutes

### Input Sanitization
- Email: Lowercase, trimmed, validated format
- Name: HTML stripped, trimmed
- Password: Minimum requirements enforced

### Audit Logging
All authentication events are logged:
- Login attempts (success/failure)
- Registration
- Password reset requests
- Password changes
- Account locks

## Critical Implementation Details

### 1. Password Hashing
```typescript
// ALWAYS use bcrypt with 12 rounds
const BCRYPT_ROUNDS = 12;
const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
const hashedPassword = await bcrypt.hash(password, salt);
```

### 2. Token Storage
```typescript
// Tokens MUST be stored in user table fields:
// - user.passwordResetToken
// - user.passwordResetExpires
// NOT in a separate passwordResetToken table
```

### 3. Rate Limiter Response Handling
```typescript
// Rate limiter MUST have try-catch for response methods
if (res && typeof res.setHeader === 'function') {
  try {
    res.setHeader('Retry-After', retryAfter.toString());
    res.status(429).json({ error: 'Too Many Requests' });
  } catch (responseError) {
    logger.error('Rate limiter response error:', responseError);
  }
}
```

### 4. API Response Methods
The `apiResponse` helper includes these methods:
- `success()`
- `error()` 
- `internalError()` - Added for backward compatibility
- `badRequest()`
- `unauthorized()`
- `forbidden()`
- `notFound()`
- `tooManyRequests()`

## Common Pitfalls

### ❌ DO NOT:
1. Change bcrypt rounds from 12
2. Use bcrypt for reset token hashing (MUST use SHA256)
3. Store reset tokens in a separate table
4. Remove rate limiting from auth endpoints
5. Change the token generation pattern
6. Modify account locking thresholds
7. Remove audit logging

### ✅ ALWAYS:
1. Use SHA256 for reset token hashing
2. Store tokens in user.passwordResetToken field
3. Set 1-hour expiry for reset tokens
4. Hash passwords with bcrypt (12 rounds)
5. Implement rate limiting on all auth endpoints
6. Log all authentication events
7. Sanitize all user inputs

## Testing Checklist

When modifying authentication:
1. Verify password hashing uses bcrypt with 12 rounds
2. Confirm reset tokens use SHA256 (NOT bcrypt)
3. Check tokens are stored in user table
4. Test rate limiting works correctly
5. Verify account locking after 4 failed attempts
6. Ensure audit logs are created
7. Test email sending functionality

## File Locations

- **Registration**: `/pages/api/auth/register.ts`
- **Login**: `/pages/api/auth/[...nextauth].ts`, `/lib/auth.ts`
- **Forgot Password**: `/pages/api/auth/forgot-password.ts`, `/pages/api/auth/simple-forgot-password.ts`
- **Reset Password**: `/pages/api/auth/reset-password.ts`
- **Rate Limiter**: `/lib/security/rateLimiter.ts`
- **Response Helper**: `/lib/api/response.ts`

---

**Last Updated**: November 2024
**Critical Version**: This documentation reflects the working authentication system as of the password reset fix.