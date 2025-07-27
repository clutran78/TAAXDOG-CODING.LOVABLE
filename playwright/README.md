# TAAXDOG E2E Tests

Comprehensive end-to-end testing suite for the TAAXDOG finance application using
Playwright.

## Overview

This test suite covers all critical user journeys and business flows including:

- User authentication (registration, login, password reset)
- Dashboard functionality
- Financial goal management
- Transaction management
- Banking integration
- Subscription flows
- Tax preparation workflows

## Setup

1. Install dependencies:

```bash
npm install
npx playwright install
```

2. Set up environment variables:

```bash
cp .env.example .env.test
# Edit .env.test with your test environment values
```

3. Set up test database:

```bash
npm run test:db:setup
```

## Running Tests

### All tests

```bash
npm test
```

### Specific test suites

```bash
npm run test:auth          # Authentication tests
npm run test:dashboard     # Dashboard tests
npm run test:goals         # Goal management tests
npm run test:transactions  # Transaction tests
npm run test:journey       # Complete user journey tests
```

### By browser

```bash
npm run test:chrome
npm run test:firefox
npm run test:webkit
npm run test:mobile
```

### Test modes

```bash
npm run test:ui        # Run with UI mode
npm run test:debug     # Debug mode
npm run test:headed    # Run with browser visible
```

### Test categories

```bash
npm run test:smoke       # Quick smoke tests
npm run test:regression  # Full regression suite
npm run test:visual      # Visual regression tests
npm run test:a11y        # Accessibility tests
npm run test:performance # Performance tests
```

## Test Structure

```
playwright/
├── tests/
│   ├── auth.spec.ts           # Authentication tests
│   ├── dashboard.spec.ts      # Dashboard tests
│   ├── goals.spec.ts          # Goal management tests
│   ├── transactions.spec.ts   # Transaction tests
│   └── user-journey.spec.ts   # Complete user journeys
├── helpers/
│   ├── test-base.ts           # Custom test fixtures
│   └── pages/                 # Page object models
│       ├── auth-page.ts
│       ├── dashboard-page.ts
│       ├── goals-page.ts
│       ├── transactions-page.ts
│       ├── banking-page.ts
│       └── profile-page.ts
├── fixtures/
│   ├── test-data.json         # Test data
│   ├── test-helpers.ts        # Data generation utilities
│   └── .auth/                 # Authentication states
└── config/
    ├── global-setup.ts        # Global test setup
    └── global-teardown.ts     # Global test teardown
```

## Page Object Model

Each page has a corresponding page object with:

- Locators for page elements
- Action methods (click, fill, etc.)
- Assertion methods
- Utility methods

Example:

```typescript
const goalsPage = new GoalsPage(page);
await goalsPage.createGoal({
  name: 'Emergency Fund',
  targetAmount: 10000,
  dueDate: '2024-12-31',
});
await goalsPage.expectGoalToExist('Emergency Fund');
```

## Test Data

Test data is centralized in `fixtures/test-data.json`:

- Test users
- Sample transactions
- Goal templates
- Bank account data
- Categories and tax codes

Use `TestDataHelper` for dynamic data:

```typescript
const helper = new TestDataHelper(page);
const user = helper.getUser('premium');
const email = helper.generateUniqueEmail();
```

## Writing Tests

### Basic test structure

```typescript
test('should create a new goal', async ({ goalsPage }) => {
  await goalsPage.goto();

  await goalsPage.createGoal({
    name: 'Vacation Fund',
    targetAmount: 5000,
    dueDate: '2024-12-31',
  });

  await goalsPage.expectGoalToExist('Vacation Fund');
});
```

### Using custom fixtures

```typescript
test('authenticated user flow', async ({
  authenticatedPage,
  dashboardPage,
}) => {
  await dashboardPage.goto();
  await dashboardPage.expectToBeVisible();
});
```

### Test tags

```typescript
test('@smoke should login successfully', async ({ authPage }) => {
  // Quick smoke test
});

test('@visual dashboard layout', async ({ dashboardPage }) => {
  // Visual regression test
});
```

## CI/CD Integration

Tests run automatically on:

- Push to main/develop branches
- Pull requests
- Daily schedule (2 AM Sydney time)

GitHub Actions workflow includes:

- Multi-browser testing
- Mobile testing
- Visual regression
- Performance testing
- Accessibility testing

## Debugging

### View test reports

```bash
npm run report
```

### Debug specific test

```bash
npm run test:debug auth.spec.ts
```

### View trace

```bash
npm run trace trace.zip
```

### Generate code

```bash
npm run codegen
```

## Best Practices

1. **Use Page Objects**: Keep test logic separate from page interactions
2. **Data Independence**: Generate unique test data for each run
3. **Explicit Waits**: Use Playwright's auto-waiting, avoid arbitrary timeouts
4. **Descriptive Names**: Clear test and assertion descriptions
5. **Test Isolation**: Each test should be independent
6. **Error Screenshots**: Automatic on failure for debugging
7. **Parallel Execution**: Tests run in parallel by default

## Troubleshooting

### Tests failing locally

1. Check environment variables
2. Ensure test database is running
3. Clear browser state: `rm -rf playwright/.auth`
4. Update browsers: `npx playwright install`

### Flaky tests

1. Check for race conditions
2. Use proper wait strategies
3. Ensure data cleanup between tests
4. Check network stability

### Performance issues

1. Use test.describe.parallel()
2. Optimize test data setup
3. Reuse authentication state
4. Minimize page navigations

## Contributing

1. Follow existing patterns
2. Add page objects for new pages
3. Update test data fixtures
4. Include both positive and negative tests
5. Add appropriate test tags
6. Update documentation
