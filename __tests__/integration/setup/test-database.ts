import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

export class TestDatabase {
  private static instance: TestDatabase;
  private prisma: PrismaClient;
  private databaseUrl: string;
  private databaseName: string;

  private constructor() {
    // Generate unique test database name
    this.databaseName = `taaxdog_test_${uuidv4().slice(0, 8)}`;

    // Use test database URL from environment or create one
    const baseUrl =
      process.env.TEST_DATABASE_URL ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432';
    this.databaseUrl = `${baseUrl.split('/').slice(0, -1).join('/')}/${this.databaseName}`;

    // Set DATABASE_URL for Prisma
    process.env.DATABASE_URL = this.databaseUrl;

    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: this.databaseUrl,
        },
      },
      log: process.env.DEBUG_TESTS ? ['query', 'info', 'warn', 'error'] : [],
    });
  }

  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  async setup(): Promise<void> {
    try {
      // Create test database
      await this.createDatabase();

      // Run migrations
      await this.runMigrations();

      // Seed with test data if needed
      await this.seedDatabase();

      console.log(`✓ Test database ${this.databaseName} setup complete`);
    } catch (error) {
      console.error('Failed to setup test database:', error);
      throw error;
    }
  }

  async teardown(): Promise<void> {
    try {
      // Disconnect Prisma
      await this.prisma.$disconnect();

      // Drop test database
      await this.dropDatabase();

      console.log(`✓ Test database ${this.databaseName} cleaned up`);
    } catch (error) {
      console.error('Failed to teardown test database:', error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    // Clean all tables without dropping database
    const tables = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE '_prisma%'
    `;

    for (const { tablename } of tables) {
      await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
    }
  }

  async transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  getPrisma(): PrismaClient {
    return this.prisma;
  }

  private async createDatabase(): Promise<void> {
    const adminUrl =
      process.env.TEST_DATABASE_URL ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/postgres';
    const adminPrisma = new PrismaClient({
      datasources: { db: { url: adminUrl } },
    });

    try {
      await adminPrisma.$executeRawUnsafe(`CREATE DATABASE "${this.databaseName}"`);
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    } finally {
      await adminPrisma.$disconnect();
    }
  }

  private async dropDatabase(): Promise<void> {
    const adminUrl =
      process.env.TEST_DATABASE_URL ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/postgres';
    const adminPrisma = new PrismaClient({
      datasources: { db: { url: adminUrl } },
    });

    try {
      // Terminate all connections to the test database
      await adminPrisma.$executeRawUnsafe(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '${this.databaseName}'
        AND pid <> pg_backend_pid()
      `);

      await adminPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${this.databaseName}"`);
    } finally {
      await adminPrisma.$disconnect();
    }
  }

  private async runMigrations(): Promise<void> {
    try {
      execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: this.databaseUrl },
      });
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  private async seedDatabase(): Promise<void> {
    // Basic seed data for tests
    await this.prisma.user.createMany({
      data: [
        {
          id: 'test-user-1',
          email: 'test1@example.com',
          name: 'Test User 1',
          password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpfQaX/jGFhIOa', // password123
          emailVerified: new Date(),
          role: 'USER',
        },
        {
          id: 'test-user-2',
          email: 'test2@example.com',
          name: 'Test User 2',
          password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpfQaX/jGFhIOa',
          emailVerified: new Date(),
          role: 'USER',
        },
        {
          id: 'test-admin',
          email: 'admin@example.com',
          name: 'Test Admin',
          password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpfQaX/jGFhIOa',
          emailVerified: new Date(),
          role: 'ADMIN',
        },
      ],
    });
  }
}

// Global setup and teardown functions for Jest
export async function setupTestDatabase(): Promise<void> {
  const db = TestDatabase.getInstance();
  await db.setup();
}

export async function teardownTestDatabase(): Promise<void> {
  const db = TestDatabase.getInstance();
  await db.teardown();
}

export async function cleanTestDatabase(): Promise<void> {
  const db = TestDatabase.getInstance();
  await db.clean();
}

export function getTestPrisma(): PrismaClient {
  return TestDatabase.getInstance().getPrisma();
}
