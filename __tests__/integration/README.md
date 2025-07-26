# Integration Testing Framework

This directory contains the integration testing framework for the TAAXDOG
application. The tests are designed to verify end-to-end functionality and
ensure all components work together correctly.

## Directory Structure

```
__tests__/integration/
├── setup/                 # Test environment setup
│   ├── test-database.ts   # Database setup and teardown
│   ├── test.env          # Test environment variables
│   ├── test-env.ts       # Environment configuration
│   └── jest.*.ts         # Jest configuration files
├── helpers/              # Testing utilities
│   ├── api-test-helper.ts    # API request helpers
│   └── auth-test-helper.ts   # Authentication helpers
├── fixtures/             # Test data factories
│   └── data-factories.ts     # Data generation utilities
├── scenarios/            # E2E test scenarios
│   ├── user-registration.e2e.test.ts  # Registration flow
│   └── financial-management.e2e.test.ts # Financial features
└── utils/                # Utility functions
    └── cleanup.ts            # Test cleanup utilities
```

## Running Integration Tests

### Prerequisites

1. PostgreSQL database running locally or accessible
2. Node.js and npm installed
3. Test environment variables configured

### Setup

1. Copy the test environment file:

```bash
cp __tests__/integration/setup/test.env .env.test
```

2. Update database connection in `.env.test`:

```
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/taaxdog_test
```

3. Install dependencies:

```bash
npm install
```

### Running Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npm run test:integration -- user-registration

# Run with coverage
npm run test:integration -- --coverage

# Run in watch mode
npm run test:integration -- --watch

# Run with debugging
DEBUG_TESTS=true npm run test:integration
```

## Writing Integration Tests

### Basic Test Structure

```typescript
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanTestDatabase,
} from '../setup/test-database';
import { apiTest, makeApiRequest } from '../helpers/api-test-helper';
import { authTest } from '../helpers/auth-test-helper';

describe('Feature E2E Test', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestDatabase();
  });

  it('should complete user flow', async () => {
    // Create test user
    const user = await authTest.createTestUser();

    // Make authenticated request
    const response = await makeAuthenticatedApiRequest(handler, user.id, {
      method: 'POST',
      body: data,
    });

    // Assert response
    apiTest.expectSuccess(response);
    expect(response.data).toMatchObject(expected);
  });
});
```

### Test Helpers

#### API Testing

```typescript
// Create API context
const { req, res } = createApiContext({
  method: 'POST',
  body: { data: 'test' },
  headers: { 'X-Custom': 'value' },
});

// Make request
const response = await makeApiRequest(handler, options);

// Make authenticated request
const response = await makeAuthenticatedApiRequest(handler, userId, options);

// Assert responses
apiTest.expectSuccess(response, 201);
apiTest.expectError(response, 400, 'Error message');
apiTest.expectUnauthorized(response);
apiTest.expectValidationError(response, 'field');
```

#### Authentication

```typescript
// Create test users
const user = await authTest.createTestUser({
  email: 'custom@example.com',
  role: 'ADMIN',
});

// Create multiple users
const users = await authTest.createTestUsers(5);

// Mock session
authTest.mockSession(user);

// Get auth headers
const headers = authTest.getAuthHeader(user);

// Cleanup
await authTest.cleanup();
```

#### Data Factories

```typescript
// Create test data
const user = DataFactory.user({ name: 'Custom Name' });
const transaction = DataFactory.transaction({ amount: 100 });
const goal = DataFactory.goal({ targetAmount: 5000 });

// Create scenarios
const scenario = DataFactory.createScenario('premium');
// Returns user with transactions, goals, budgets, etc.

// Australian-specific data
const ausData = DataFactory.australianData();
// Returns ABN, TFN, BSB, etc.
```

### Test Database

The test database is automatically created and managed:

- Unique database per test run
- Automatic migrations
- Seed data included
- Cleanup after tests

```typescript
// Manual database operations
const prisma = getTestPrisma();
const user = await prisma.user.create({ data });

// Transactions
await prisma.$transaction([
  prisma.user.create({ data: userData }),
  prisma.goal.create({ data: goalData }),
]);
```

### Environment Variables

Test-specific environment variables are loaded from `test.env`:

- `MOCK_EXTERNAL_SERVICES=true` - Mock Stripe, SendGrid, AI services
- `SKIP_EMAIL_SENDING=true` - Disable actual email sending
- `DEBUG_TESTS=true` - Enable debug logging

## Best Practices

1. **Isolation**: Each test should be independent and not rely on others
2. **Cleanup**: Always clean up test data after tests
3. **Real Database**: Tests use a real PostgreSQL database for accuracy
4. **Mock External Services**: External APIs are mocked by default
5. **Descriptive Names**: Use clear, descriptive test names
6. **Error Cases**: Test both success and failure scenarios

## Common Patterns

### Testing API Endpoints

```typescript
it('should create resource', async () => {
  const response = await makeApiRequest(handler, {
    method: 'POST',
    body: validData,
  });

  apiTest.expectSuccess(response, 201);
  expect(response.data.id).toBeValidUUID();
});
```

### Testing Authentication Flows

```typescript
it('should require authentication', async () => {
  const response = await makeApiRequest(handler);
  apiTest.expectUnauthorized(response);
});
```

### Testing Validation

```typescript
it('should validate input', async () => {
  const response = await makeApiRequest(handler, {
    method: 'POST',
    body: invalidData,
  });

  apiTest.expectValidationError(response, 'fieldName');
});
```

### Testing Transactions

```typescript
it('should handle database transactions', async () => {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data });
    const goal = await tx.goal.create({
      data: { ...goalData, userId: user.id },
    });

    expect(goal.userId).toBe(user.id);
  });
});
```

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Test connection
psql -h localhost -U postgres -c "SELECT 1"
```

### Test Failures

1. Check test database exists
2. Verify migrations are up to date
3. Check for leftover test data
4. Review test logs with `DEBUG_TESTS=true`

### Performance Issues

- Use `maxWorkers: 1` for sequential execution
- Implement proper indexes in database
- Use transaction rollback for faster cleanup

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Setup PostgreSQL
  uses: harmon758/postgresql-action@v1
  with:
    postgresql version: '14'
    postgresql db: 'taaxdog_test'
    postgresql user: 'postgres'
    postgresql password: 'postgres'

- name: Run Integration Tests
  env:
    TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/taaxdog_test
  run: npm run test:integration -- --ci --coverage
```

## Maintenance

### Cleanup Old Test Data

```typescript
import { cleanOldTestData } from './utils/cleanup';

// Clean test data older than 7 days
await cleanOldTestData(7);
```

### Update Test Fixtures

When schema changes:

1. Update data factories
2. Update test scenarios
3. Run all tests to verify

### Performance Monitoring

```typescript
// Log slow tests
jest.setTimeout(10000); // 10 second timeout

// Monitor test duration
console.time('test-duration');
// ... test code
console.timeEnd('test-duration');
```
