import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.join(__dirname, 'test.env') });

// Ensure test environment
process.env.NODE_ENV = 'test';

// Mock external services if flag is set
if (process.env.MOCK_EXTERNAL_SERVICES === 'true') {
  // Mock Stripe
  jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
      customers: {
        create: jest.fn().mockResolvedValue({ id: 'cus_test' }),
        retrieve: jest.fn().mockResolvedValue({ id: 'cus_test' }),
      },
      subscriptions: {
        create: jest.fn().mockResolvedValue({ id: 'sub_test' }),
        retrieve: jest.fn().mockResolvedValue({ id: 'sub_test' }),
        update: jest.fn().mockResolvedValue({ id: 'sub_test' }),
        cancel: jest.fn().mockResolvedValue({ id: 'sub_test' }),
      },
      checkout: {
        sessions: {
          create: jest
            .fn()
            .mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.com/test' }),
        },
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    }));
  });

  // Mock SendGrid
  jest.mock('@sendgrid/mail', () => ({
    setApiKey: jest.fn(),
    send: jest.fn().mockResolvedValue({}),
    sendMultiple: jest.fn().mockResolvedValue({}),
  }));

  // Mock AI services
  jest.mock('@anthropic-ai/sdk', () => ({
    Anthropic: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ text: 'Mock AI response' }],
        }),
      },
    })),
  }));

  jest.mock('openai', () => ({
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mock OpenAI response' } }],
          }),
        },
      },
    })),
  }));
}

// Set test timeouts
jest.setTimeout(30000);

// Suppress console logs in tests unless debugging
if (process.env.DEBUG_TESTS !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
