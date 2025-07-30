# Authentication System Test Documentation

This document provides comprehensive test cases and expected behaviors for the TAAXDOG authentication system. Use these tests to verify the authentication system is working correctly after any changes.

## Table of Contents
1. [User Registration Tests](#user-registration-tests)
2. [Login Tests](#login-tests)
3. [Password Reset Tests](#password-reset-tests)
4. [Session Management Tests](#session-management-tests)
5. [Security Tests](#security-tests)
6. [Integration Tests](#integration-tests)

## Test Environment Setup

```bash
# Set test environment variables
export NODE_ENV=test
export DATABASE_URL="postgresql://test_user:test_pass@localhost:5432/taaxdog_test"
export NEXTAUTH_URL="http://localhost:3000"
export NEXTAUTH_SECRET="test-secret-key-for-testing-only"

# Run tests
npm test -- __tests__/auth/
```

## User Registration Tests

### Test 1: Successful Registration
**Endpoint**: `POST /api/auth/register`
**Input**:
```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "name": "Test User"
}
```
**Expected Response**: Status 201
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "newuser@example.com",
      "name": "Test User",
      "role": "USER"
    },
    "message": "Registration successful. Please check your email to verify your account."
  }
}
```
**Verification**:
- User created in database
- Password hashed with bcrypt (12 rounds)
- Email verification token generated
- Audit log entry created
- Verification email sent

### Test 2: Duplicate Email Registration
**Endpoint**: `POST /api/auth/register`
**Input**: Same email as existing user
**Expected Response**: Status 409
```json
{
  "success": false,
  "error": {
    "message": "An account with this email already exists"
  }
}
```

### Test 3: Invalid Password Registration
**Endpoint**: `POST /api/auth/register`
**Input**: Password less than 8 characters
**Expected Response**: Status 400
```json
{
  "success": false,
  "error": {
    "message": "Password must be at least 8 characters long"
  }
}
```

### Test 4: Rate Limiting
**Scenario**: More than 5 registration attempts from same IP in 1 hour
**Expected Response**: Status 429
```json
{
  "success": false,
  "error": {
    "message": "Too many registration attempts. Please try again in 1 hour."
  }
}
```

## Login Tests

### Test 5: Successful Login
**Endpoint**: `POST /api/auth/[...nextauth]` (signIn)
**Input**:
```json
{
  "email": "user@example.com",
  "password": "CorrectPassword123!"
}
```
**Expected Response**: 
- Session cookie set
- JWT token generated
- User redirected to dashboard
**Verification**:
- lastLoginAt updated
- failedLoginAttempts reset to 0
- Audit log entry created

### Test 6: Invalid Credentials
**Endpoint**: `POST /api/auth/[...nextauth]` (signIn)
**Input**: Incorrect password
**Expected Behavior**:
- failedLoginAttempts incremented
- After 4 failed attempts: account locked for 15 minutes
- Audit log entries created

### Test 7: Locked Account Login
**Scenario**: Attempt login on locked account
**Expected Response**: 
- Login rejected
- Error message about account being locked
- lockedUntil timestamp shown in logs

## Password Reset Tests

### Test 8: Request Password Reset
**Endpoint**: `POST /api/auth/forgot-password`
**Input**:
```json
{
  "email": "user@example.com"
}
```
**Expected Response**: Status 200
```json
{
  "success": true,
  "data": {
    "message": "If an account exists with this email, you will receive password reset instructions."
  }
}
```
**Verification**:
- SHA256 hashed token stored in user.passwordResetToken
- Token expires in 1 hour
- Email sent with reset link

### Test 9: Reset Password with Valid Token
**Endpoint**: `POST /api/auth/reset-password`
**Input**:
```json
{
  "token": "64-character-hex-token",
  "password": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```
**Expected Response**: Status 200
```json
{
  "success": true,
  "data": {
    "message": "Password has been reset successfully. You can now login with your new password."
  }
}
```
**Verification**:
- Password updated with bcrypt (12 rounds)
- passwordResetToken cleared
- All sessions invalidated
- Confirmation email sent

### Test 10: Reset Password with Invalid Token
**Endpoint**: `POST /api/auth/reset-password`
**Input**: Invalid or expired token
**Expected Response**: Status 400
```json
{
  "success": false,
  "error": {
    "message": "Invalid reset token. Please request a new password reset."
  }
}
```

### Test 11: Token Expiry
**Scenario**: Use token after 1 hour
**Expected Response**: Status 400
```json
{
  "success": false,
  "error": {
    "message": "Reset token has expired. Please request a new password reset."
  }
}
```

## Security Tests

### Test 12: SQL Injection Prevention
**Input**: Email with SQL injection attempt
```json
{
  "email": "admin@example.com'; DROP TABLE users; --",
  "password": "test"
}
```
**Expected**: Input sanitized, no database damage

### Test 13: XSS Prevention
**Input**: Name with script tags
```json
{
  "name": "<script>alert('xss')</script>",
  "email": "test@example.com",
  "password": "SecurePass123!"
}
```
**Expected**: Script tags stripped, safe string stored

### Test 14: CSRF Protection
**Scenario**: Request without CSRF token
**Expected**: Request rejected with 403 Forbidden

### Test 15: Timing Attack Prevention
**Scenario**: Compare login times for valid vs invalid users
**Expected**: Similar response times (within 50ms variance)

## Session Management Tests

### Test 16: Session Expiry
**Scenario**: Use session after 30 days
**Expected**: Session invalid, user redirected to login

### Test 17: Concurrent Sessions
**Scenario**: Login from multiple devices
**Expected**: All sessions valid until password change

### Test 18: Session Invalidation on Password Reset
**Scenario**: Reset password while logged in
**Expected**: All existing sessions invalidated

## Integration Tests

### Test 19: Full Registration Flow
1. Register new user
2. Verify email sent
3. Click verification link
4. Confirm email verified in database
5. Login with new account
6. Access protected routes

### Test 20: Full Password Reset Flow
1. Request password reset
2. Check email received
3. Click reset link with token
4. Submit new password
5. Confirm old password no longer works
6. Login with new password

## Common Test Utilities

### Helper Functions
```typescript
// Test user creation
export async function createTestUser(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 12);
  return prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: 'Test User',
      emailVerified: new Date(),
    },
  });
}

// Generate test token
export function generateTestToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Clean up test data
export async function cleanupTestData(email: string) {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.auditLog.deleteMany({ 
    where: { metadata: { path: ['email'], equals: email } } 
  });
}
```

## Test Data Requirements

### Valid Test Cases
- Email: valid format, lowercase
- Password: 8+ chars, uppercase, lowercase, number
- Name: 2-50 characters, no special chars

### Invalid Test Cases
- Email: missing @, invalid domain
- Password: <8 chars, no uppercase, common passwords
- Name: empty, too long, special characters

## Debugging Failed Tests

### Common Issues
1. **Token Mismatch**: Ensure SHA256 hashing in both endpoints
2. **Rate Limiting**: Clear rate limit cache between tests
3. **Database State**: Use transactions or cleanup after each test
4. **Email Service**: Mock email service in tests

### Debug Logging
Enable debug logs for troubleshooting:
```bash
export DEBUG=auth:*
export LOG_LEVEL=debug
npm test -- --verbose
```

## Performance Benchmarks

Expected response times:
- Registration: <500ms
- Login: <200ms
- Password Reset Request: <300ms
- Password Reset Completion: <400ms

## Compliance Checks

### Australian Requirements
- [ ] GST included in subscription tests
- [ ] ABN validation in business registration
- [ ] Privacy policy acceptance logged
- [ ] Data residency confirmed (Sydney region)

## Running Specific Test Suites

```bash
# Registration tests only
npm test -- __tests__/auth/register.test.ts

# Login tests only
npm test -- __tests__/auth/login.test.ts

# Password reset tests only
npm test -- __tests__/auth/password-reset.test.ts

# Security tests only
npm test -- __tests__/auth/security.test.ts

# All auth tests
npm test -- __tests__/auth/
```

## Test Coverage Requirements

Minimum coverage targets:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

Generate coverage report:
```bash
npm test -- --coverage __tests__/auth/
```

---

**Note**: Always run the full test suite before deploying authentication changes. Any modification to the authentication system should include corresponding test updates.