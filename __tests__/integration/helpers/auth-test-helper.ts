import { Session, User } from 'next-auth';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getTestPrisma } from '../setup/test-database';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  session?: Session;
  token?: string;
}

export class AuthTestHelper {
  private prisma = getTestPrisma();
  private testUsers: Map<string, TestUser> = new Map();

  /**
   * Create a test user in the database
   */
  async createTestUser(userData: Partial<TestUser> = {}): Promise<TestUser> {
    const defaultData = {
      id: `test-user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      password: 'Test123!@#',
      name: 'Test User',
      role: 'USER',
    };

    const user = { ...defaultData, ...userData };

    // Hash password
    const hashedPassword = await bcrypt.hash(user.password, 12);

    // Create user in database
    const dbUser = await this.prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        password: hashedPassword,
        name: user.name,
        role: user.role,
        emailVerified: new Date(),
      },
    });

    // Generate session and token
    const session = this.createSession(dbUser);
    const token = this.generateToken(dbUser);

    const testUser: TestUser = {
      ...user,
      session,
      token,
    };

    this.testUsers.set(user.id, testUser);
    return testUser;
  }

  /**
   * Create multiple test users
   */
  async createTestUsers(count: number): Promise<TestUser[]> {
    const users: TestUser[] = [];

    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser({
        email: `test-user-${i}@example.com`,
        name: `Test User ${i}`,
      });
      users.push(user);
    }

    return users;
  }

  /**
   * Create admin user
   */
  async createAdminUser(): Promise<TestUser> {
    return this.createTestUser({
      id: 'test-admin',
      email: 'admin@example.com',
      name: 'Test Admin',
      role: 'ADMIN',
    });
  }

  /**
   * Create session for user
   */
  createSession(user: any): Session {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Generate JWT token for user
   */
  generateToken(user: any): string {
    const secret = process.env.NEXTAUTH_SECRET || 'test-secret';

    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        iat: Math.floor(Date.now() / 1000),
      },
      secret,
      { expiresIn: '24h' },
    );
  }

  /**
   * Mock NextAuth session
   */
  mockSession(user?: TestUser | null): void {
    const mockUseSession = jest.fn(() => ({
      data: user?.session || null,
      status: user ? 'authenticated' : 'unauthenticated',
    }));

    jest.mock('next-auth/react', () => ({
      useSession: mockUseSession,
      SessionProvider: ({ children }: any) => children,
    }));
  }

  /**
   * Mock NextAuth for API routes
   */
  mockApiAuth(user?: TestUser | null): void {
    jest.mock('next-auth', () => ({
      getServerSession: jest.fn(() => Promise.resolve(user?.session || null)),
    }));
  }

  /**
   * Verify password
   */
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Get authorization header
   */
  getAuthHeader(user: TestUser): Record<string, string> {
    return {
      Authorization: `Bearer ${user.token}`,
    };
  }

  /**
   * Simulate login
   */
  async simulateLogin(email: string, password: string): Promise<TestUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    const isValid = await this.verifyPassword(password, user.password);
    if (!isValid) return null;

    const session = this.createSession(user);
    const token = this.generateToken(user);

    return {
      id: user.id,
      email: user.email,
      password,
      name: user.name || 'User',
      role: user.role,
      session,
      token,
    };
  }

  /**
   * Create password reset token
   */
  async createPasswordResetToken(userId: string): Promise<string> {
    const token = jwt.sign(
      { userId, type: 'password-reset' },
      process.env.NEXTAUTH_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );

    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    return token;
  }

  /**
   * Create email verification token
   */
  async createEmailVerificationToken(userId: string): Promise<string> {
    const token = jwt.sign(
      { userId, type: 'email-verification' },
      process.env.NEXTAUTH_SECRET || 'test-secret',
      { expiresIn: '24h' },
    );

    await this.prisma.verificationToken.create({
      data: {
        identifier: userId,
        token,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    return token;
  }

  /**
   * Clean up test users
   */
  async cleanup(): Promise<void> {
    const userIds = Array.from(this.testUsers.keys());

    if (userIds.length > 0) {
      await this.prisma.user.deleteMany({
        where: {
          id: { in: userIds },
        },
      });
    }

    this.testUsers.clear();
  }

  /**
   * Get test user by ID
   */
  getTestUser(userId: string): TestUser | undefined {
    return this.testUsers.get(userId);
  }

  /**
   * Get all test users
   */
  getAllTestUsers(): TestUser[] {
    return Array.from(this.testUsers.values());
  }
}

// Export singleton instance
export const authTest = new AuthTestHelper();

// Export convenience functions
export const createTestUser = (userData?: Partial<TestUser>) => authTest.createTestUser(userData);

export const createAdminUser = () => authTest.createAdminUser();

export const mockSession = (user?: TestUser | null) => authTest.mockSession(user);

export const mockApiAuth = (user?: TestUser | null) => authTest.mockApiAuth(user);

export const getAuthHeader = (user: TestUser) => authTest.getAuthHeader(user);

export const cleanupAuth = () => authTest.cleanup();
