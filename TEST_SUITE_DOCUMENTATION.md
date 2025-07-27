# Comprehensive Test Suite Documentation

This document describes the complete test suite for the TAAXDOG application,
covering API endpoints, database performance, security, user isolation, and
error handling.

## Test Scripts Overview

### 1. API Endpoint Testing (`npm run test:api`)

**Script**: `scripts/test-api-endpoints.sh`

Tests all major API endpoints including:

- Health check endpoints
- Authentication (register, login, forgot password)
- Protected endpoints (goals, budgets, transactions)
- Security (unauthorized access, SQL injection, XSS)
- User isolation
- Rate limiting
- Error handling

**Usage**:

```bash
npm run test:api
```

### 2. Database Performance Testing (`npm run test:db-performance`)

**Script**: `scripts/test-database-performance.ts`

Tests query performance including:

- Simple user lookups
- Complex queries with relations
- Transaction aggregations
- Count queries
- Search operations
- Raw SQL queries
- Concurrent query handling
- Connection pooling

**Usage**:

```bash
npm run test:db-performance
```

### 3. Security Testing (`npm run test:security`)

**Script**: `scripts/test-security.ts`

Comprehensive security tests:

- SQL injection attempts
- XSS payload testing
- Authentication bypass attempts
- Authorization checks
- CSRF protection
- Input validation
- Rate limiting
- File upload security
- Encryption verification
- Security headers

**Usage**:

```bash
npm run test:security
```

### 4. User Isolation Testing (`npm run test:isolation`)

**Script**: `scripts/test-user-isolation.ts`

Verifies data isolation between users:

- Cross-user data access prevention
- List filtering by user
- Update/delete operation restrictions
- Dashboard data isolation
- Aggregation query isolation
- Search result filtering
- Admin access verification

**Usage**:

```bash
npm run test:isolation
```

### 5. Error Handling Testing (`npm run test:errors`)

**Script**: `scripts/test-error-handling.ts`

Tests application resilience:

- Invalid JSON handling
- Missing required fields
- Invalid data types
- Boundary values
- Null/undefined handling
- HTTP method validation
- Content-type validation
- Non-existent resources
- Concurrent requests
- Large payloads
- Special characters
- Timeout handling

**Usage**:

```bash
npm run test:errors
```

### 6. Run All Tests (`npm run test:all`)

Runs all test suites in sequence.

**Usage**:

```bash
npm run test:all
```

## API Testing Examples

The test suite generated comprehensive curl examples in `api-test-examples.md`.
Here are some key examples:

### Authentication

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123!","name":"Test User"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123!"}'
```

### Protected Endpoints

```bash
# Get Goals
curl -X GET http://localhost:3000/api/goals \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create Goal
curl -X POST http://localhost:3000/api/goals \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Save for Holiday","targetAmount":5000,"currentAmount":0,"targetDate":"2024-12-31","category":"SAVINGS"}'
```

## Performance Benchmarks

The database performance tests establish these benchmarks:

| Query Type               | Expected Time |
| ------------------------ | ------------- |
| Simple user lookup       | < 50ms        |
| User with relations      | < 100ms       |
| Recent transactions (50) | < 100ms       |
| Transaction aggregation  | < 200ms       |
| Complex dashboard query  | < 300ms       |

## Security Test Results

The security test suite validates:

✅ **SQL Injection Protection**: All parameterized queries prevent injection ✅
**XSS Protection**: Input sanitization and output encoding ✅
**Authentication**: Invalid tokens properly rejected ✅ **Authorization**:
Role-based access control enforced ✅ **Rate Limiting**: Brute force protection
active ✅ **Encryption**: Passwords hashed, sensitive data encrypted ✅
**Security Headers**: All required headers present

## User Isolation Verification

The isolation tests confirm:

✅ Users cannot access other users' goals, transactions, or budgets ✅ List
endpoints filter by authenticated user ✅ Update/delete operations restricted to
owner ✅ Aggregations calculated per user ✅ Search results filtered by user

## Error Handling Coverage

The error handling tests verify:

✅ Graceful handling of invalid JSON ✅ Proper validation messages for missing
fields ✅ Type validation for all inputs ✅ Boundary value handling ✅ Proper
HTTP status codes ✅ No server crashes on edge cases

## Running Tests in Different Environments

### Development

```bash
BASE_URL=http://localhost:3000 npm run test:all
```

### Staging

```bash
BASE_URL=https://staging.taxreturnpro.com.au npm run test:all
```

### Production (Read-only tests)

```bash
BASE_URL=https://taxreturnpro.com.au npm run test:api
```

## Continuous Integration

Add to your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run API Tests
  run: npm run test:api

- name: Run Security Tests
  run: npm run test:security

- name: Run Performance Tests
  run: npm run test:db-performance
```

## Test Maintenance

1. **Update test data**: Modify setup functions when schema changes
2. **Add new endpoints**: Update `test-api-endpoints.sh` with new routes
3. **Adjust benchmarks**: Update performance thresholds as needed
4. **Security updates**: Add new attack vectors to security tests
5. **Error scenarios**: Add new edge cases to error handling tests

## Troubleshooting

### Common Issues

1. **Authentication failures**
   - Ensure test users are created
   - Check JWT secret configuration
   - Verify token expiry settings

2. **Performance test failures**
   - Check database indexes
   - Verify connection pooling
   - Review query optimization

3. **Isolation test failures**
   - Check RLS policies
   - Verify middleware authentication
   - Review authorization logic

4. **Rate limiting issues**
   - Adjust rate limit thresholds
   - Clear rate limit cache between tests
   - Use different test user emails

## Summary

This comprehensive test suite provides:

- ✅ Full API endpoint coverage
- ✅ Performance benchmarking
- ✅ Security vulnerability testing
- ✅ Data isolation verification
- ✅ Error handling validation

Regular execution of these tests ensures the application remains secure,
performant, and reliable.
