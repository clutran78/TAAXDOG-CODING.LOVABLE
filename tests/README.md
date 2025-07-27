# Testing Infrastructure

This directory contains the comprehensive testing infrastructure for the TAAXDOG
project.

## Structure

```
tests/
├── utils/              # Testing utilities and helpers
│   ├── test-utils.tsx  # React testing utilities with providers
│   ├── db-helpers.ts   # Database mocking utilities
│   ├── api-mocks.ts    # API testing utilities
│   └── mock-providers.tsx # Mock context providers
├── integration/        # Integration tests
│   └── auth-flow.test.ts # Complete auth flow tests
└── README.md          # This file
```

## Component Tests

Component tests are colocated with their components:

- `components/auth/__tests__/` - Authentication component tests
- `components/Goal/__tests__/` - Goal component tests
- `lib/ai/__tests__/` - AI service tests
- `lib/auth/__tests__/` - Auth utility tests

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests in CI mode
npm run test:ci
```

## Writing Tests

### Component Tests

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/tests/utils/test-utils';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText('Expected text')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyComponent />);

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Updated text')).toBeInTheDocument();
  });
});
```

### API Tests

```typescript
import { createMockApiContext, apiAssertions } from '@/tests/utils/api-mocks';
import handler from '@/pages/api/my-endpoint';

describe('API: /api/my-endpoint', () => {
  it('handles POST request', async () => {
    const { req, res } = createMockApiContext('POST', {
      data: 'test',
    });

    await handler(req, res);

    const result = apiAssertions.expectSuccess(res);
    expect(result.data).toBe('test');
  });
});
```

### Service Tests

```typescript
import { MyService } from '../MyService';
import { createMockContext } from '@/tests/utils/db-helpers';

describe('MyService', () => {
  let service: MyService;
  let mockContext: MockContext;

  beforeEach(() => {
    mockContext = createMockContext();
    service = new MyService(mockContext.prisma);
  });

  it('performs operation', async () => {
    mockContext.prisma.user.findUnique.mockResolvedValueOnce(userData);

    const result = await service.getUser('user-id');

    expect(result).toEqual(userData);
  });
});
```

## Test Utilities

### renderWithProviders

Renders components with all necessary providers (SessionProvider, etc.):

```typescript
renderWithProviders(<Component />, {
  session: mockAdminSession, // Optional: custom session
});
```

### createMockApiContext

Creates mock Next.js API request/response objects:

```typescript
const { req, res } = createMockApiContext('POST', body, query, headers);
```

### testDataFactory

Creates consistent test data:

```typescript
const user = testDataFactory.user({ name: 'Custom Name' });
const transaction = testDataFactory.transaction({ amount: 100 });
```

### apiAssertions

Helper assertions for API responses:

```typescript
apiAssertions.expectSuccess(res, 201);
apiAssertions.expectError(res, 400, 'Error message');
apiAssertions.expectUnauthorized(res);
apiAssertions.expectValidationError(res, 'fieldName');
```

## Best Practices

1. **Test Organization**
   - Keep tests close to the code they test
   - Use descriptive test names
   - Group related tests with `describe` blocks

2. **Mocking**
   - Mock external dependencies (database, APIs)
   - Use factory functions for test data
   - Reset mocks between tests

3. **Assertions**
   - Test behavior, not implementation
   - Use specific assertions
   - Test error cases

4. **Performance**
   - Keep tests fast
   - Avoid real network calls
   - Use minimal test data

5. **Coverage**
   - Aim for >70% coverage
   - Focus on critical paths
   - Don't test implementation details

## CI/CD Integration

Tests run automatically on:

- Pull requests
- Main branch commits
- Pre-deployment

Coverage reports are generated and can be viewed at
`/coverage/lcov-report/index.html`.
