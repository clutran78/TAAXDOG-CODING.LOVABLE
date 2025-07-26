module.exports = {
  displayName: 'Integration Tests',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/__tests__/integration/**/*.test.ts',
    '<rootDir>/__tests__/integration/**/*.e2e.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFiles: ['<rootDir>/__tests__/integration/setup/test-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/integration/setup/jest.setup.ts'],
  globalSetup: '<rootDir>/__tests__/integration/setup/global-setup.ts',
  globalTeardown: '<rootDir>/__tests__/integration/setup/global-teardown.ts',
  testTimeout: 30000,
  maxWorkers: 1, // Run tests sequentially for database isolation
  collectCoverageFrom: [
    'pages/api/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};
