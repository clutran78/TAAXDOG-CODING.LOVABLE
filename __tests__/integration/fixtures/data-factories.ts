import { faker } from '@faker-js/faker';
import {
  User,
  bank_transactions,
  Goal,
  Receipt,
  Budget,
  Subscription,
  bank_accounts,
  GoalStatus,
  ReceiptStatus,
  BudgetStatus,
  Plan,
  Role,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class DataFactory {
  /**
   * Create user data
   */
  static user(overrides: Partial<User> = {}): User {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpfQaX/jGFhIOa', // password123
      role: 'USER',
      emailVerified: new Date(),
      abn: null,
      tfn: null,
      stripeCustomerId: null,
      subscriptionStatus: null,
      subscriptionPlan: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Create transaction data
   */
  static transaction(overrides: Partial<bank_transactions> = {}): bank_transactions {
    const amount = faker.number.float({ min: 10, max: 1000, multipleOf: 0.01 });
    const type = faker.helpers.arrayElement(['income', 'expense']);

    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      amount: new Decimal(type === 'expense' ? -Math.abs(amount) : Math.abs(amount)),
      currency: 'AUD',
      description: faker.commerce.productName(),
      category: faker.helpers.arrayElement([
        'GROCERIES',
        'TRANSPORT',
        'UTILITIES',
        'ENTERTAINMENT',
        'HEALTHCARE',
        'OTHER',
      ]),
      type,
      date: faker.date.recent(),
      status: 'COMPLETED',
      receiptId: null,
      goalId: null,
      bankAccountId: null,
      taxCategory: null,
      isDeductible: false,
      gstAmount: amount * 0.1, // 10% GST
      notes: null,
      tags: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Create goal data
   */
  static goal(overrides: Partial<Goal> = {}): Goal {
    const targetAmount = faker.number.float({ min: 1000, max: 50000, multipleOf: 100 });
    const currentAmount = faker.number.float({ min: 0, max: targetAmount * 0.8, multipleOf: 0.01 });

    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      name: faker.helpers.arrayElement([
        'Emergency Fund',
        'Vacation',
        'New Car',
        'House Deposit',
        'Investment',
      ]),
      description: faker.lorem.sentence(),
      targetAmount,
      currentAmount,
      targetDate: faker.date.future(),
      status: currentAmount >= targetAmount ? 'COMPLETED' : ('ACTIVE' as GoalStatus),
      monthlyContribution: faker.number.float({ min: 100, max: 1000, multipleOf: 50 }),
      isAutoContribute: faker.datatype.boolean(),
      completedAt: currentAmount >= targetAmount ? new Date() : null,
      pausedAt: null,
      resumedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Create receipt data
   */
  static receipt(overrides: Partial<Receipt> = {}): Receipt {
    const totalAmount = faker.number.float({ min: 10, max: 500, multipleOf: 0.01 });

    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      fileName: `receipt-${Date.now()}.jpg`,
      fileUrl: faker.image.url(),
      totalAmount,
      merchantName: faker.company.name(),
      date: faker.date.recent(),
      status: 'PROCESSED' as ReceiptStatus,
      category: faker.helpers.arrayElement([
        'GROCERIES',
        'TRANSPORT',
        'DINING',
        'SHOPPING',
        'OTHER',
      ]),
      taxCategory: null,
      gstAmount: totalAmount * 0.1,
      extractedData: {
        items: [
          {
            name: faker.commerce.productName(),
            price: totalAmount * 0.6,
            quantity: 1,
          },
          {
            name: faker.commerce.productName(),
            price: totalAmount * 0.4,
            quantity: 1,
          },
        ],
      },
      error: null,
      processedAt: new Date(),
      isManual: false,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Create budget data
   */
  static budget(overrides: Partial<Budget> = {}): Budget {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      name: faker.helpers.arrayElement([
        'Monthly Groceries',
        'Transport Budget',
        'Entertainment',
        'Utilities',
      ]),
      amount: new Decimal(faker.number.float({ min: 100, max: 2000, multipleOf: 50 })),
      period: 'MONTHLY',
      category: faker.helpers.arrayElement([
        'GROCERIES',
        'TRANSPORT',
        'ENTERTAINMENT',
        'UTILITIES',
      ]),
      startDate: new Date(),
      endDate: faker.date.future(),
      spent: faker.number.float({ min: 0, max: 1000, multipleOf: 0.01 }),
      isActive: true,
      alertThreshold: 80,
      lastAlertSent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Create subscription data
   */
  static subscription(overrides: Partial<Subscription> = {}): Subscription {
    const plan = faker.helpers.arrayElement([Plan.SMART, Plan.PRO]);

    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      stripeSubscriptionId: `sub_${faker.string.alphanumeric(14)}`,
      stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
      plan,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: faker.date.future(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      cancelReason: null,
      cancelFeedback: null,
      trialStart: null,
      trialEnd: null,
      priceId: plan === 'TAAX_PRO' ? 'price_taax_pro' : 'price_taax_smart',
      amount: new Decimal(plan === Plan.PRO ? 18.99 : 9.99),
      currency: 'AUD',
      interval: 'month',
      paymentRetryAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Create bank account data
   */
  static bankAccount(overrides: Partial<bank_accounts> = {}): bank_accounts {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      basiqAccountId: `acc_${faker.string.alphanumeric(10)}`,
      accountNumber: faker.finance.accountNumber(),
      accountName: faker.helpers.arrayElement([
        'Everyday Account',
        'Savings Account',
        'Credit Card',
      ]),
      balance: new Decimal(faker.number.float({ min: 0, max: 50000, multipleOf: 0.01 })),
      available: faker.number.float({ min: 0, max: 50000, multipleOf: 0.01 }),
      currency: 'AUD',
      type: faker.helpers.arrayElement(['TRANSACTION', 'SAVINGS', 'CREDIT_CARD']),
      institution: faker.helpers.arrayElement(['Commonwealth Bank', 'Westpac', 'ANZ', 'NAB']),
      isActive: true,
      lastSyncedAt: faker.date.recent(),
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Create test scenario data
   */
  static createScenario(scenario: 'basic' | 'premium' | 'trial' | 'complete') {
    const user = this.user();

    switch (scenario) {
      case 'basic':
        return {
          user,
          transactions: Array.from({ length: 10 }, () => this.transaction({ userId: user.id })),
          goals: [this.goal({ userId: user.id })],
          receipts: Array.from({ length: 5 }, () => this.receipt({ userId: user.id })),
        };

      case 'premium':
        return {
          user: { ...user, subscriptionStatus: 'ACTIVE', subscriptionPlan: Plan.PRO },
          subscription: this.subscription({ userId: user.id, plan: Plan.PRO }),
          transactions: Array.from({ length: 50 }, () => this.transaction({ userId: user.id })),
          goals: Array.from({ length: 3 }, () => this.goal({ userId: user.id })),
          budgets: Array.from({ length: 4 }, () => this.budget({ userId: user.id })),
          bankAccounts: Array.from({ length: 2 }, () => this.bankAccount({ userId: user.id })),
        };

      case 'trial':
        return {
          user: { ...user, subscriptionStatus: 'TRIALING', subscriptionPlan: Plan.SMART },
          subscription: this.subscription({
            userId: user.id,
            plan: Plan.SMART,
            status: 'TRIALING',
            trialEnd: faker.date.future(),
          }),
          transactions: Array.from({ length: 20 }, () => this.transaction({ userId: user.id })),
        };

      case 'complete':
        return {
          user: { ...user, subscriptionStatus: 'ACTIVE', subscriptionPlan: Plan.PRO },
          subscription: this.subscription({ userId: user.id, plan: Plan.PRO }),
          transactions: Array.from({ length: 100 }, () => this.transaction({ userId: user.id })),
          goals: Array.from({ length: 5 }, () => this.goal({ userId: user.id })),
          budgets: Array.from({ length: 6 }, () => this.budget({ userId: user.id })),
          receipts: Array.from({ length: 30 }, () => this.receipt({ userId: user.id })),
          bankAccounts: Array.from({ length: 3 }, () => this.bankAccount({ userId: user.id })),
        };

      default:
        return { user };
    }
  }

  /**
   * Generate Australian-specific data
   */
  static australianData() {
    return {
      abn: faker.helpers.replaceSymbols('## ### ### ###'),
      tfn: faker.helpers.replaceSymbols('### ### ###'),
      bsb: faker.helpers.replaceSymbols('###-###'),
      accountNumber: faker.finance.accountNumber(8),
      medicare: faker.helpers.replaceSymbols('#### ##### #'),
      superFund: faker.helpers.arrayElement([
        'AustralianSuper',
        'REST',
        'Hostplus',
        'HESTA',
        'Cbus',
      ]),
      state: faker.helpers.arrayElement(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']),
    };
  }
}

// Export convenience functions
export const createUser = (overrides?: Partial<User>) => DataFactory.user(overrides);
export const createTransaction = (overrides?: Partial<bank_transactions>) =>
  DataFactory.transaction(overrides);
export const createGoal = (overrides?: Partial<Goal>) => DataFactory.goal(overrides);
export const createReceipt = (overrides?: Partial<Receipt>) => DataFactory.receipt(overrides);
export const createBudget = (overrides?: Partial<Budget>) => DataFactory.budget(overrides);
export const createSubscription = (overrides?: Partial<Subscription>) =>
  DataFactory.subscription(overrides);
export const createBankAccount = (overrides?: Partial<bank_accounts>) =>
  DataFactory.bankAccount(overrides);
export const createScenario = (scenario: 'basic' | 'premium' | 'trial' | 'complete') =>
  DataFactory.createScenario(scenario);
